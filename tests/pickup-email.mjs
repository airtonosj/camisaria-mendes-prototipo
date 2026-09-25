import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { testEnvironment } from './test-environment.mjs';

Object.assign(process.env, testEnvironment());
const { pool } = await import('../api/database.mjs');
const { emailHistory } = await import('../api/email-history.mjs');
const { config } = await import('../api/config.mjs');
const { pickupSettings, pickupInfo, previewPickup, confirmPickup, processPickupEmails } = await import('../api/pickup-email.mjs');
assert.match(config.database.database, /_test$/);
const code = `PICKUP-${randomUUID().slice(0, 8)}`;
let campaignId;
const settings = { instructions: 'Retirada na coordenação, das 14h às 18h.', representative: 'Airton Jr', phone: '(98) 99999-1234', groupUrl: 'https://chat.whatsapp.com/Abcdefghijklmnopqrstuv' };
try {
  for (const groupUrl of ['https://evil.example/Abcdefghijklmnopqrstuv', 'https://chat.whatsapp.com.evil.example/Abcdefghijklmnopqrstuv', 'javascript:alert(1)', '']) assert.throws(() => pickupSettings({ ...settings, groupUrl }));
  assert.throws(() => pickupSettings({ ...settings, phone: '123' }));
  const [[staff]] = await pool.execute('SELECT id FROM users LIMIT 1');
  const [c] = await pool.execute("INSERT INTO campaigns (code, title, phase, deadline_at, pickup_instructions, representative_name, representative_whatsapp) VALUES (?, 'Campanha QA retirada', 'ready_for_delivery', '2026-12-31', ?, ?, ?)", [code, settings.instructions, settings.representative, '5598999991234']);
  campaignId = c.insertId;
  const [[variant]] = await pool.execute('SELECT shirt_model_id, color_id FROM campaign_variants LIMIT 1');
  const [v] = await pool.execute('INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents) VALUES (?, ?, ?, 5000)', [campaignId, variant.shirt_model_id, variant.color_id]);
  const [[size]] = await pool.execute('SELECT id FROM sizes LIMIT 1');
  const ids = [];
  for (let i = 0; i < 8; i++) {
    const [o] = await pool.execute(`INSERT INTO orders (order_number, idempotency_key, campaign_id, customer_name, customer_whatsapp, customer_email, payment_status, delivery_status, status, total_cents, subtotal_cents)
      VALUES (?, ?, ?, 'Comprador de teste', '5598999994321', ?, ?, ?, ?, 10000, 10000)`, [`QA-${randomUUID().slice(0, 16)}`, randomUUID(), campaignId, i === 7 ? 'invalid' : `qa${i}@example.com`, i === 5 ? 'pending' : 'paid', i === 6 ? 'delivered' : 'ready', i === 4 ? 'cancelled' : 'active']);
    ids.push(o.insertId);
    await pool.execute('INSERT INTO order_items (order_id, campaign_variant_id, size_id, quantity, unit_price_cents) VALUES (?, ?, ?, 2, 5000)', [o.insertId, v.insertId, size.id]);
  }
  assert.equal((await pickupInfo(code)).eligible, 4);
  const draft = await previewPickup(code, settings, staff.id);
  assert.equal(draft.count, 4);
  assert.match(draft.text, /2x /); assert.match(draft.text, /https:\/\/wa.me\/5598999991234/);
  assert.match(draft.text, /\(98\) 99999-1234/);
  const [[before]] = await pool.execute('SELECT COUNT(*) AS count FROM order_email_notifications WHERE order_id = ?', [ids[0]]);
  assert.equal(Number(before.count), 0, 'Prévia não cria envio');
  await assert.rejects(confirmPickup(code, draft.batchId, staff.id), /não está configurado/);
  // In-memory test config only; all deliveries below use a stub, never SMTP.
  Object.assign(config.smtp, { host: 'invalid.test', user: 'test', password: 'test', from: 'qa@example.com' });
  await assert.rejects(confirmPickup(code, draft.batchId, staff.id + 100000), /não encontrada/);
  await pool.execute('UPDATE pickup_email_batches SET created_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 31 MINUTE) WHERE id = ?', [draft.batchId]);
  await assert.rejects(confirmPickup(code, draft.batchId, staff.id), /expirou/);
  await pool.execute('UPDATE pickup_email_batches SET created_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [draft.batchId]);
  await pool.execute("UPDATE orders SET delivery_status = 'delivered' WHERE id = ?", [ids[3]]);
  const concurrent = await Promise.all([confirmPickup(code, draft.batchId, staff.id), confirmPickup(code, draft.batchId, staff.id)]);
  assert.equal(concurrent.reduce((sum, r) => sum + r.queued, 0), 3);
  assert.equal(concurrent.filter(r => r.alreadyConfirmed).length, 1);
  await pool.execute("UPDATE campaigns SET representative_name = 'Outro representante' WHERE id = ?", [campaignId]);
  await pool.execute("UPDATE orders SET status = 'cancelled' WHERE id = ?", [ids[2]]);
  const sent = [];
  await Promise.all([processPickupEmails({ send: async m => sent.push(m) }), processPickupEmails({ send: async m => sent.push(m) })]);
  assert.equal(sent.length, 2, 'Workers concorrentes e cancelamento não duplicam nem enviam inelegíveis');
  assert.match(sent[0].text, /Airton Jr/, 'Snapshot preserva o representante confirmado');
  const [[cancelled]] = await pool.execute('SELECT status FROM order_email_notifications WHERE order_id = ?', [ids[2]]);
  assert.equal(cancelled.status, 'cancelled');
  await pool.execute("UPDATE order_email_notifications SET status = 'pending', attempts = 0 WHERE order_id = ?", [ids[0]]);
  await processPickupEmails({ send: async () => { throw new Error('SMTP interrompido após DATA'); } });
  const [[uncertain]] = await pool.execute('SELECT status FROM order_email_notifications WHERE order_id = ?', [ids[0]]);
  assert.equal(uncertain.status, 'uncertain');
  await processPickupEmails({ send: async () => assert.fail('Resultado incerto não pode ser repetido') });
  await pool.execute("UPDATE order_email_notifications SET status = 'pending', attempts = 0 WHERE order_id = ?", [ids[1]]);
  for (let i = 0; i < 4; i++) {
    await pool.execute('UPDATE order_email_notifications SET available_at = CURRENT_TIMESTAMP(3) WHERE order_id = ?', [ids[1]]);
    await processPickupEmails({ send: async () => { const e = new Error('Conexão recusada'); e.deliveryUncertain = false; throw e; } });
  }
  const [[failed]] = await pool.execute('SELECT status, attempts FROM order_email_notifications WHERE order_id = ?', [ids[1]]);
  assert.equal(failed.status, 'failed'); assert.equal(failed.attempts, 3);
  await pool.execute("UPDATE order_email_notifications SET status = 'sending', locked_at = DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 11 MINUTE) WHERE order_id = ?", [ids[1]]);
  await processPickupEmails({ send: async () => assert.fail('Lock obsoleto não deve reenviar') });
  const [[stale]] = await pool.execute('SELECT status FROM order_email_notifications WHERE order_id = ?', [ids[1]]);
  assert.equal(stale.status, 'uncertain');
  await pool.execute("UPDATE campaigns SET phase = 'production' WHERE id = ?", [campaignId]);
  await assert.rejects(previewPickup(code, settings, staff.id), /pronta para entrega/);
  const history = await emailHistory(code);
  assert.equal(history.total, 3);
  assert.ok(history.items.every(item => item.orderNumber.startsWith('QA-')));
  assert.ok(history.items.every(item => item.text.includes('Airton Jr')));
  assert.equal((await emailHistory(code, new URLSearchParams({ status: 'cancelled' }))).total, 1);
  assert.equal((await emailHistory(code, new URLSearchParams({ search: 'qa0@example.com' }))).total, 1);
  assert.equal((await emailHistory(code, new URLSearchParams({ search: "' OR 1=1 --" }))).total, 0);
  assert.equal((await emailHistory(code, new URLSearchParams({ page: '999' }))).page, 1);
  const otherCode = 'OTHER-' + randomUUID().slice(0, 8);
  const [other] = await pool.execute("INSERT INTO campaigns (code, title, phase, deadline_at, pickup_instructions, representative_name, representative_whatsapp) VALUES (?, 'Outra', 'production', '2026-12-31', 'Local', 'Rep', '5598999991234')", [otherCode]);
  try { assert.equal((await emailHistory(otherCode)).total, 0); } finally { await pool.execute('DELETE FROM campaigns WHERE id = ?', [other.insertId]); }
  await assert.rejects(emailHistory(code, new URLSearchParams({ status: 'invalid' })), /Status inválido/);
  await assert.rejects(emailHistory('missing-campaign'), /não encontrada/);
  console.log('✓ Histórico: filtros, isolamento por campanha, snapshot, paginação e validação.');
  console.log('✓ Avisos: validação, elegibilidade, prévia sem envio, SMTP ausente, concorrência, duplicidade, snapshot, cancelamento, falha, limite e reinício.');
} finally {
  if (campaignId) {
    await pool.execute('DELETE n FROM order_email_notifications n JOIN orders o ON o.id = n.order_id WHERE o.campaign_id = ?', [campaignId]);
    await pool.execute('DELETE FROM pickup_email_batches WHERE campaign_id = ?', [campaignId]);
    await pool.execute('DELETE FROM orders WHERE campaign_id = ?', [campaignId]);
    await pool.execute('DELETE FROM campaigns WHERE id = ?', [campaignId]);
  }
  await pool.end();
}
