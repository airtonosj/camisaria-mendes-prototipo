import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testEnvironment } from './test-environment.mjs';

// Recebedores por campanha: o link sai na conta do recebedor, a conferência usa a
// conta gravada no checkout e a troca de conta é recusada com link pendente.
const environment = testEnvironment();
const { prepareDatabase } = await import('./helpers/environment.mjs');
await prepareDatabase(environment);
Object.assign(process.env, environment);
const { fakeInfinitePay, startFakeInfinitePay } = await import('./helpers/infinitepay.mjs');
const { pool } = await import('../api/database.mjs');
const { config } = await import('../api/config.mjs');
const receivers = await import('../api/modules/receivers/service.mjs');
const campaigns = await import('../api/modules/campaigns/service.mjs');
const payments = await import('../api/infinitepay-payments.mjs');
assert.match(config.database.database, /_test$/);
assert.equal(config.payments.infinitePay.handle, 'smoke-infinitepay');

let holdLink = null;
const provider = await startFakeInfinitePay(environment, {
  beforeLinkResponse: async (body) => { if (holdLink) await holdLink(body); },
});
const suffix = randomUUID().slice(0, 6).toUpperCase();
const whatsapp = '5598999994321';

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (error) => { assert.equal(error.code, code); return true; });
}

async function createCampaign(code, receiverId) {
  const [result] = await pool.execute(
    `INSERT INTO campaigns (code, title, phase, deadline_at, pickup_instructions, representative_name, representative_whatsapp, mockup_enabled, receiver_id)
     VALUES (?, 'Campanha QA recebedor', 'receiving_orders', '2026-12-31', 'Retirada na coordenação', 'Representante QA', ?, FALSE, ?)`,
    [code, whatsapp, receiverId],
  );
  const [[variant]] = await pool.execute('SELECT shirt_model_id, color_id FROM campaign_variants LIMIT 1');
  const [variantResult] = await pool.execute('INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents) VALUES (?, ?, ?, 5000)', [result.insertId, variant.shirt_model_id, variant.color_id]);
  return { id: result.insertId, variantId: variantResult.insertId };
}

async function createOrder(campaign) {
  const number = `CM-2026-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const [[size]] = await pool.execute('SELECT id FROM sizes LIMIT 1');
  const [order] = await pool.execute(
    `INSERT INTO orders (order_number, idempotency_key, campaign_id, customer_name, customer_whatsapp, customer_email, payment_status, delivery_status, status, total_cents, subtotal_cents)
     VALUES (?, ?, ?, 'Comprador de teste', ?, 'comprador@example.com', 'pending', 'waiting_campaign', 'active', 10000, 10000)`,
    [number, randomUUID(), campaign.id, whatsapp],
  );
  await pool.execute('INSERT INTO order_items (order_id, campaign_variant_id, size_id, quantity, unit_price_cents) VALUES (?, ?, ?, 2, 5000)', [order.insertId, campaign.variantId, size.id]);
  return number;
}

async function payOrder(orderNumber) {
  const transactionNsu = randomUUID();
  fakeInfinitePay.checks.set(transactionNsu, { success: true, paid: true, amount: 10000, capture_method: 'pix' });
  await payments.enqueueInfinitePayEvent({ transaction_nsu: transactionNsu, order_nsu: orderNumber, invoice_slug: `qa-${transactionNsu}` }, 'webhook');
  const before = fakeInfinitePay.checkRequests.length;
  await payments.processInfinitePayEvents();
  const [[order]] = await pool.execute('SELECT payment_status FROM orders WHERE order_number = ?', [orderNumber]);
  assert.equal(order.payment_status, 'paid');
  return fakeInfinitePay.checkRequests.slice(before);
}

try {
  const [[staff]] = await pool.execute("SELECT id FROM users WHERE role = 'camisaria' LIMIT 1");

  // Cadastro: o handle é formatado como na tela e salvo sem o cifrão.
  const ana = await receivers.createReceiver({ staff, body: { name: 'Ana Recebedora', email: 'Ana@Example.com', phone: '(98) 98888-1234', infinitepayHandle: '$Ana Conta' } });
  assert.equal(ana.infinitepayHandle, 'anaconta');
  assert.equal(ana.email, 'ana@example.com');
  assert.equal(ana.phone, '5598988881234');
  assert.equal(ana.active, true);
  await rejectsWith(receivers.createReceiver({ staff, body: { name: 'Outra pessoa', infinitepayHandle: 'ANACONTA' } }), 'HANDLE_IN_USE');
  await rejectsWith(receivers.createReceiver({ staff, body: { name: 'Sem conta', infinitepayHandle: '$' } }), 'VALIDATION_ERROR');
  await rejectsWith(receivers.createReceiver({ staff, body: { name: 'E-mail ruim', email: 'nao-e-email', infinitepayHandle: 'emailruim' } }), 'VALIDATION_ERROR');
  const bruno = await receivers.createReceiver({ staff, body: { name: 'Bruno Recebedor', infinitepayHandle: 'bruno_conta' } });
  assert.equal(bruno.email, null);

  // Campanha com recebedor: o link sai na conta dele e o handle fica gravado.
  const withReceiver = await createCampaign(`QA-REC-${suffix}`, ana.id);
  const firstOrder = await createOrder(withReceiver);
  // Bloqueia o provedor antes de devolver o link: a conta já deve estar
  // reservada, e nenhuma edição pode ultrapassar esse intervalo.
  let releaseLink;
  let linkArrived;
  const arrived = new Promise((resolve) => { linkArrived = resolve; });
  const released = new Promise((resolve) => { releaseLink = resolve; });
  holdLink = async () => { linkArrived(); await released; };
  const creating = payments.createCheckoutForOrder(firstOrder, whatsapp);
  try {
    await arrived;
    const [[reserved]] = await pool.execute('SELECT pc.handle, pc.checkout_url FROM payment_checkouts pc JOIN orders o ON o.id = pc.order_id WHERE o.order_number = ?', [firstOrder]);
    assert.equal(reserved.handle, 'anaconta');
    assert.equal(reserved.checkout_url, null);
    await rejectsWith(campaigns.updateCampaign({ body: { receiverId: bruno.id } }, `QA-REC-${suffix}`), 'RECEIVER_IN_USE');
    await rejectsWith(receivers.updateReceiver({ body: { infinitepayHandle: 'ana_nova' } }, ana.id), 'RECEIVER_IN_USE');
    await rejectsWith(payments.createCheckoutForOrder(firstOrder, whatsapp), 'CHECKOUT_IN_PROGRESS');
  } finally {
    holdLink = null;
    releaseLink();
    await creating;
  }
  const linksBeforeReuse = fakeInfinitePay.links.length;
  assert.equal((await payments.createCheckoutForOrder(firstOrder, whatsapp)).reused, true);
  assert.equal(fakeInfinitePay.links.length, linksBeforeReuse);
  assert.equal(fakeInfinitePay.links.at(-1).handle, 'anaconta');
  const [[firstCheckout]] = await pool.execute('SELECT pc.handle FROM payment_checkouts pc JOIN orders o ON o.id = pc.order_id WHERE o.order_number = ?', [firstOrder]);
  assert.equal(firstCheckout.handle, 'anaconta');
  const detail = await campaigns.getCampaign(`QA-REC-${suffix}`, { includeReceiver: true });
  assert.equal(detail.receiver.infinitepayHandle, 'anaconta');
  const publicDetail = await campaigns.getCampaign(`QA-REC-${suffix}`);
  assert.equal('receiver' in publicDetail, false, 'Página pública não recebe a conta de destino');
  const listed = (await campaigns.listCampaigns()).find((campaign) => campaign.code === `QA-REC-${suffix}`);
  assert.equal(listed.receiver.name, 'Ana Recebedora');

  // Link pendente trava a troca de conta, pela campanha e pelo handle do recebedor.
  await rejectsWith(campaigns.updateCampaign({ body: { receiverId: bruno.id } }, `QA-REC-${suffix}`), 'RECEIVER_IN_USE');
  await rejectsWith(campaigns.updateCampaign({ body: { receiverId: null } }, `QA-REC-${suffix}`), 'RECEIVER_IN_USE');
  await rejectsWith(receivers.updateReceiver({ body: { infinitepayHandle: 'ana_nova' } }, ana.id), 'RECEIVER_IN_USE');
  const renamed = await receivers.updateReceiver({ body: { name: 'Ana Maria Recebedora' } }, ana.id);
  assert.equal(renamed.name, 'Ana Maria Recebedora', 'Nome e contato mudam mesmo com link pendente');

  // O pagamento é conferido na conta que emitiu o link.
  const firstChecks = await payOrder(firstOrder);
  assert.equal(firstChecks.at(-1).handle, 'anaconta');

  // Pago o pedido, a troca é liberada; o próximo link sai na nova conta.
  await campaigns.updateCampaign({ body: { receiverId: bruno.id } }, `QA-REC-${suffix}`);
  const secondOrder = await createOrder(withReceiver);
  await payments.createCheckoutForOrder(secondOrder, whatsapp);
  assert.equal(fakeInfinitePay.links.at(-1).handle, 'bruno_conta');

  // Mesmo que a campanha mude depois (via banco), a conferência segue o checkout.
  await pool.execute('UPDATE campaigns SET receiver_id = ? WHERE id = ?', [ana.id, withReceiver.id]);
  const secondChecks = await payOrder(secondOrder);
  assert.equal(secondChecks.at(-1).handle, 'bruno_conta');
  await receivers.updateReceiver({ body: { infinitepayHandle: '$Ana_Nova' } }, ana.id);

  // Recebedor desativado não pode ser escolhido por outra campanha.
  await receivers.updateReceiver({ body: { active: false } }, bruno.id);
  const withoutReceiver = await createCampaign(`QA-PAD-${suffix}`, null);
  await rejectsWith(campaigns.updateCampaign({ body: { receiverId: bruno.id } }, `QA-PAD-${suffix}`), 'RECEIVER_INVALID');
  await rejectsWith(campaigns.updateCampaign({ body: { receiverId: 999999 } }, `QA-PAD-${suffix}`), 'RECEIVER_INVALID');

  // Sem recebedor, vale a conta padrão; checkout legado sem handle também.
  const defaultOrder = await createOrder(withoutReceiver);
  await payments.createCheckoutForOrder(defaultOrder, whatsapp);
  assert.equal(fakeInfinitePay.links.at(-1).handle, 'smoke-infinitepay');
  await pool.execute('UPDATE payment_checkouts pc JOIN orders o ON o.id = pc.order_id SET pc.handle = NULL WHERE o.order_number = ?', [defaultOrder]);
  await campaigns.updateCampaign({ body: { receiverId: null } }, `QA-PAD-${suffix}`);
  await rejectsWith(campaigns.updateCampaign({ body: { receiverId: ana.id } }, `QA-PAD-${suffix}`), 'RECEIVER_IN_USE');
  const legacyChecks = await payOrder(defaultOrder);
  assert.equal(legacyChecks.at(-1).handle, 'smoke-infinitepay');

  const list = await receivers.listReceivers();
  assert.deepEqual(list.map((receiver) => [receiver.infinitepayHandle, receiver.active]), [['ana_nova', true], ['bruno_conta', false]]);
  assert.deepEqual(list[0].campaigns.map((campaign) => campaign.code), [`QA-REC-${suffix}`]);
  console.log('Recebedores por campanha: cadastro, checkout, conferência e travas validados.');
} finally {
  provider.close();
  await pool.end();
}
