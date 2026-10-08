import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { testEnvironment } from './test-environment.mjs';
import { prepareDatabase, runNode } from './helpers/environment.mjs';
const env = testEnvironment();
await prepareDatabase(env);
Object.assign(process.env, env);
const { pool } = await import('../api/database.mjs');
const campaigns = await import('../api/modules/campaigns/service.mjs');
const orders = await import('../api/modules/orders/service.mjs');
try {
  const seed = await campaigns.getCampaign('MENDES-ENG-26');
  const variant = seed.variants[0];
  const size = seed.sizes.find(item => item.model.code === variant.model.code).code;
  const [[staff]] = await pool.execute('SELECT id FROM users LIMIT 1');
  const body = {
    code: 'MENDES-DELIVERY-26', title: 'Entrega da campanha QA', deadlineAt: '2026-10-20T23:59:59Z',
    pickupInstructions: 'Retirada com o representante da turma', representative: { name: 'Lucas Pereira', whatsapp: '98999990000' },
    deliveryExpectedOn: '2026-11-10', deliveryNote: 'Camisas entregues ao representante de turma',
    artFrontUrl: '/uploads/00000000-0000-4000-8000-000000000001.png', presentationConfig: { mockupEnabled: true, realPhotosEnabled: false },
    models: [{ modelCode: variant.model.code, unitPriceCents: 5990, colors: [variant.color], sizes: [size] }],
  };
  const created = await campaigns.createCampaign({ staff, body });
  assert.equal(created.deliveryExpectedOn, body.deliveryExpectedOn);
  assert.equal(created.deliveryNote, body.deliveryNote);
  const publicCampaign = await campaigns.getCampaign(body.code);
  assert.equal(publicCampaign.deliveryExpectedOn, '2026-11-10');
  const input = { campaignCode: body.code, customer: { name: 'Cliente QA', whatsapp: '98999990000', email: 'delivery@example.test' }, items: [{ variantId: created.variants[0].id, size, quantity: 1 }] };
  const idempotencyKey = randomUUID();
  const placed = await orders.createOrder({ idempotencyKey, body: input });
  const lookup = new URL('http://localhost/?whatsapp=98999990000');
  let tracked = await orders.trackOrder(lookup, placed.order.order_number);
  assert.deepEqual(tracked.deliveryForecastAtPurchase, { expectedOn: '2026-11-10', note: body.deliveryNote });
  await campaigns.updateCampaign({ body: { title: 'Entrega QA corrigida' } }, body.code);
  assert.equal((await campaigns.getCampaign(body.code)).deliveryExpectedOn, '2026-11-10');
  await campaigns.updateCampaign({ body: { deliveryExpectedOn: '2026-11-15' } }, body.code);
  tracked = await orders.trackOrder(lookup, placed.order.order_number);
  assert.equal(tracked.campaign.deliveryExpectedOn, '2026-11-15');
  assert.equal(tracked.deliveryForecastAtPurchase.expectedOn, '2026-11-10');
  assert.equal((await orders.createOrder({ idempotencyKey, body: input })).created, false);
  for (const value of ['2026-02-29', '2026-04-31', '2026-11-10T23:00:00Z', 123]) {
    await assert.rejects(campaigns.updateCampaign({ body: { deliveryExpectedOn: value } }, body.code), error => error.code === 'VALIDATION_ERROR');
  }
  await assert.rejects(campaigns.updateCampaign({ body: { deliveryNote: 'a'.repeat(256) } }, body.code), error => error.code === 'VALIDATION_ERROR');
  await campaigns.updateCampaign({ body: { deliveryExpectedOn: null, deliveryNote: null } }, body.code);
  const withoutDate = await orders.createOrder({ idempotencyKey: randomUUID(), body: input });
  assert.deepEqual((await orders.trackOrder(lookup, withoutDate.order.order_number)).deliveryForecastAtPurchase, { expectedOn: null, note: null });
  // Replay does not overwrite purchase data or campaign fields.
  const sql = await fs.readFile('database/migrations/026_campaign_delivery.sql', 'utf8');
  const connection = await mysql.createConnection({ host: env.DB_HOST, port: +env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, multipleStatements: true });
  try { await connection.query(sql); } finally { await connection.end(); }
  assert.equal((await orders.trackOrder(lookup, placed.order.order_number)).deliveryForecastAtPurchase.expectedOn, '2026-11-10');
  // Upgrade a populated 025 schema: old IDs and orders survive without a false snapshot.
  await pool.execute('ALTER TABLE campaigns DROP COLUMN delivery_expected_on, DROP COLUMN delivery_note');
  await pool.execute('ALTER TABLE orders DROP COLUMN delivery_expected_on, DROP COLUMN delivery_note, DROP COLUMN delivery_forecast_recorded');
  await pool.execute("DELETE FROM schema_migrations WHERE version='026_campaign_delivery'");
  runNode(env, 'api/migrate.mjs');
  tracked = await orders.trackOrder(lookup, placed.order.order_number);
  assert.equal(tracked.number, placed.order.order_number);
  assert.equal(tracked.deliveryForecastAtPurchase, null);
  assert.equal(tracked.campaign.deliveryExpectedOn, null);
  console.log('✓ Entrega: cadastro, edição, datas inválidas, sem data, snapshot, idempotência e migração da 025 preservando pedidos.');
} finally { await pool.end(); }
