import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { testEnvironment } from './test-environment.mjs';
import { prepareDatabase } from './helpers/environment.mjs';
import { fakeInfinitePay, startFakeInfinitePay } from './helpers/infinitepay.mjs';

const env = testEnvironment();
// The integration runner is sequential: reuse the explicitly configured _test
// database so restricted TEST_DB_* accounts need no additional grants.
await prepareDatabase(env);
Object.assign(process.env, env);
const { pool } = await import('../api/database.mjs');
const payments = await import('../api/infinitepay-payments.mjs');
const campaigns = await import('../api/modules/campaigns/service.mjs');
const orders = await import('../api/modules/orders/service.mjs');
let checkHook;
const provider = await startFakeInfinitePay(env, { beforeCheckResponse: async body => checkHook?.(body) });
const phone = '5598999994321';
const campaign = await campaigns.getCampaign('MENDES-ENG-26');
const variant = campaign.variants[0];
const size = campaign.sizes.find(item => item.model.code === variant.model.code).code;

async function createOrder() {
  const result = await orders.createOrder({ idempotencyKey: randomUUID(), body: {
    campaignCode: campaign.code,
    customer: { name: 'Segurança QA', whatsapp: phone, email: 'security@example.test' },
    items: [{ variantId: variant.id, size, quantity: 1 }],
  } });
  await payments.createCheckoutForOrder(result.order.order_number, phone);
  return result.order;
}
function event(order, transaction = randomUUID()) {
  return { order_nsu: order.order_number, transaction_nsu: transaction, invoice_slug: `qa-${transaction}` };
}
function confirm(order, payload) {
  fakeInfinitePay.checks.set(payload.transaction_nsu, { success: true, paid: true, amount: order.total_cents, capture_method: 'pix' });
}
async function rows(order) {
  const [result] = await pool.execute('SELECT pe.* FROM payment_events pe JOIN orders o ON o.id=pe.order_id WHERE o.order_number=?', [order.order_number]);
  return result;
}
async function legacy(order, payload) {
  await pool.execute(`INSERT INTO payment_events
    (provider,order_id,provider_event_id,event_type,signature_valid,payload,available_at)
    SELECT 'infinitepay',id,?,'payment_approved',FALSE,?,DATE_ADD(NOW(3), INTERVAL 1 DAY)
    FROM orders WHERE order_number=?`, [payload.transaction_nsu, JSON.stringify(payload), order.order_number]);
}
async function rejects(promise, code) {
  await assert.rejects(promise, error => error.code === code);
}

try {
  const order = await createOrder();
  for (let index = 0; index < 12; index += 1) {
    const forged = event(order);
    await rejects(payments.enqueueInfinitePayEvent(forged, index % 2 ? 'browser_return' : 'webhook'), 'PAYMENT_NOT_CONFIRMED');
  }
  assert.equal((await rows(order)).length, 0, 'Tentativas falsas não consomem cota pendente ou diária.');
  const valid = event(order);
  confirm(order, valid);
  // Stale pre-deploy traffic must not deny a new provider-confirmed payment.
  for (let index = 0; index < 8; index += 1) await legacy(order, event(order));
  const accepted = await payments.enqueueInfinitePayEvent(valid);
  assert.equal(accepted.duplicate, false);
  const duplicate = await payments.enqueueInfinitePayEvent({ ...valid, invoice_slug: undefined, slug: valid.invoice_slug }, 'browser_return');
  assert.equal(duplicate.duplicate, true);
  assert.equal((await rows(order)).filter(row => row.event_type.startsWith('verified_')).length, 1);
  await payments.processInfinitePayEvents({ limit: 1 });
  assert.equal((await orders.trackOrder(phone, order.order_number)).paymentStatus, 'paid');
  assert.equal((await rows(order)).filter(row => row.processed_at).length, 1, 'Prioridade da confirmação sobre a fila antiga.');
  await payments.enqueueInfinitePayEvent(valid); // replay after terminal paid state

  const concurrent = await createOrder();
  const concurrentEvent = event(concurrent);
  confirm(concurrent, concurrentEvent);
  await Promise.all(Array.from({ length: 4 }, () => payments.enqueueInfinitePayEvent(concurrentEvent)));
  assert.equal((await rows(concurrent)).length, 1, 'Admissão concorrente é idempotente.');
  await payments.processInfinitePayEvents({ limit: 1 });
  assert.equal((await orders.trackOrder(phone, concurrent.order_number)).paymentStatus, 'paid');

  const oldCheckout = await createOrder();
  await pool.execute('UPDATE payment_checkouts pc JOIN orders o ON o.id=pc.order_id SET pc.handle=NULL WHERE o.order_number=?', [oldCheckout.order_number]);
  const oldEvent = event(oldCheckout);
  await legacy(oldCheckout, { ...oldEvent, invoice_slug: 'forjado-anterior-ao-deploy' });
  confirm(oldCheckout, oldEvent);
  const before = fakeInfinitePay.checkRequests.length;
  await payments.enqueueInfinitePayEvent(oldEvent);
  assert.equal(fakeInfinitePay.checkRequests[before].handle, 'smoke-infinitepay');
  const legacyPayload = (await rows(oldCheckout))[0].payload;
  assert.equal((typeof legacyPayload === 'string' ? JSON.parse(legacyPayload) : legacyPayload).invoice_slug, oldEvent.invoice_slug);
  await payments.processInfinitePayEvents({ limit: 1 });
  assert.equal((await orders.trackOrder(phone, oldCheckout.order_number)).paymentStatus, 'paid');

  const mismatch = await createOrder();
  const wrongAmount = event(mismatch);
  fakeInfinitePay.checks.set(wrongAmount.transaction_nsu, { success: true, paid: true, amount: mismatch.total_cents + 1 });
  await rejects(payments.enqueueInfinitePayEvent(wrongAmount), 'PAYMENT_AMOUNT_MISMATCH');
  assert.equal((await rows(mismatch)).length, 0);
  await rejects(payments.enqueueInfinitePayEvent({ ...concurrentEvent, order_nsu: mismatch.order_number }), 'PAYMENT_TRANSACTION_IN_USE');

  const retry = event(mismatch);
  confirm(mismatch, retry);
  checkHook = async () => ({ status: 503, body: { error: 'temporarily_unavailable' } });
  await rejects(payments.enqueueInfinitePayEvent(retry), 'PAYMENT_VERIFICATION_UNAVAILABLE');
  assert.equal((await rows(mismatch)).length, 0);
  checkHook = undefined;
  await payments.enqueueInfinitePayEvent(retry);
  // Durable admission survives a later provider outage; existing worker retries.
  checkHook = async () => ({ status: 503, body: { error: 'temporarily_unavailable' } });
  await payments.processInfinitePayEvents({ limit: 1 });
  const retryRow = (await rows(mismatch))[0];
  assert.equal(retryRow.processed_at, null);
  assert.equal(retryRow.dead_lettered_at, null);
  assert.equal(Number(retryRow.attempts), 1);
  checkHook = undefined;
  await pool.execute('UPDATE payment_events SET available_at=NOW(3) WHERE id=?', [retryRow.id]);
  await payments.processInfinitePayEvents({ limit: 1 });
  assert.equal((await orders.trackOrder(phone, mismatch.order_number)).paymentStatus, 'paid');

  const cancelled = await createOrder();
  const cancellation = event(cancelled);
  confirm(cancelled, cancellation);
  checkHook = async body => {
    if (body.transaction_nsu === cancellation.transaction_nsu) {
      await pool.execute("UPDATE orders SET status='cancelled' WHERE order_number=?", [cancelled.order_number]);
    }
  };
  await rejects(payments.enqueueInfinitePayEvent(cancellation), 'PAYMENT_EVENT_NOT_EXPECTED');
  assert.equal((await rows(cancelled)).length, 0);
  checkHook = undefined;

  const changed = await createOrder();
  const changedEvent = event(changed);
  confirm(changed, changedEvent);
  checkHook = async () => {
    await pool.execute("UPDATE payment_checkouts pc JOIN orders o ON o.id=pc.order_id SET pc.handle='changed_account' WHERE o.order_number=?", [changed.order_number]);
  };
  await rejects(payments.enqueueInfinitePayEvent(changedEvent), 'PAYMENT_CHECKOUT_CHANGED');
  assert.equal((await rows(changed)).length, 0);
  checkHook = undefined;
  const legacyOwner = await createOrder();
  const recoveredOwner = await createOrder();
  const recoveredEvent = event(recoveredOwner);
  await legacy(legacyOwner, { ...recoveredEvent, order_nsu: legacyOwner.order_number });
  confirm(recoveredOwner, recoveredEvent);
  await payments.enqueueInfinitePayEvent(recoveredEvent);
  assert.equal((await rows(recoveredOwner)).length, 1, 'Reserva legada de outra ordem não bloqueia o pagamento real.');
  assert.equal((await rows(legacyOwner)).length, 1, 'Histórico da entrada antiga foi preservado.');
  await payments.processInfinitePayEvents({ limit: 1 });
  assert.equal((await orders.trackOrder(phone, recoveredOwner.order_number)).paymentStatus, 'paid');
  console.log('✓ Segurança: eventos falsos, fila legada, prioridade, replay, concorrência, valor, conta, cancelamento e indisponibilidade.');
} finally {
  provider.close();
  await once(provider, 'close');
  await pool.end();
}
