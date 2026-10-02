import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { testEnvironment } from './test-environment.mjs';
import { prepareDatabase } from './helpers/environment.mjs';
import { validApiResponse } from '../shared/response-contracts.mjs';

// All fixtures and mode changes stay on a dedicated local database.
const env = testEnvironment();
env.DB_CONNECTION_LIMIT = '4';
await prepareDatabase(env);
Object.assign(process.env, env);
const { pool } = await import('../api/database.mjs');
const { listCampaigns } = await import('../api/modules/campaigns/service.mjs');
const { listCampaignsQuery1 } = await import('../api/modules/campaigns/repository.mjs');
const expected = new Map();
const phases = ['receiving_orders', 'orders_closed', 'production', 'ready_for_delivery', 'completed'];
const paymentStatuses = ['pending', 'paid', 'failed', 'refunded', 'partially_refunded'];
let orderSequence = 0;

async function campaign(code, receiverId = null, phase = phases[0]) {
  const [result] = await pool.execute(`INSERT INTO campaigns
    (code, title, phase, deadline_at, pickup_instructions, representative_name, receiver_id, created_at)
    VALUES (?, ?, ?, '2027-12-31', 'Retirada QA', 'Representante QA', ?, ?)`,
  [code, `Campanha ${code}`, phase, receiverId, new Date(Date.UTC(2026, 0, expected.size + 1))]);
  const item = { id: result.insertId, code, phase, receiver: receiverId === null ? null : receivers.get(receiverId),
    orderCount: 0, paidTotalCents: 0, canDelete: true, artFrontUrl: null, activeCouponCode: null, couponCodes: [] };
  expected.set(code, item);
  return item;
}

async function orders(item, fixtures) {
  if (!fixtures.length) return [];
  const rows = fixtures.map(({ paymentStatus, status = 'active', total = 1000 }) => {
    const key = `QA-LIST-${++orderSequence}`;
    if (status === 'active') {
      item.orderCount++;
      if (paymentStatus === 'paid') item.paidTotalCents += total;
    }
    item.canDelete = false;
    return [key, key, item.id, 'Comprador QA', '5598999994321', paymentStatus, status, total, total];
  });
  const [result] = await pool.query(`INSERT INTO orders
    (order_number, idempotency_key, campaign_id, customer_name, customer_whatsapp, payment_status, status, total_cents, subtotal_cents)
    VALUES ?`, [rows]);
  // Do not infer IDs from auto-increment: engines can use different increment policies.
  const [saved] = await pool.query('SELECT id FROM orders WHERE campaign_id = ? ORDER BY id', [item.id]);
  assert.equal(saved.length, fixtures.length);
  assert.equal(result.affectedRows, fixtures.length);
  return saved.map(row => row.id);
}

async function variant(item, colorId) {
  const [result] = await pool.execute(`INSERT INTO campaign_variants
    (campaign_id, shirt_model_id, color_id, unit_price_cents) VALUES (?, ?, ?, 5000)`, [item.id, modelId, colorId]);
  return result.insertId;
}

function verify(list) {
  assert.equal(validApiResponse('/admin/campaigns', 'GET', JSON.parse(JSON.stringify({ campaigns: list }))), true,
    'The real service output satisfies the browser contract after JSON serialization');
  assert.equal(list.length, expected.size);
  assert.equal(new Set(list.map(item => item.id)).size, list.length, 'Each campaign appears once');
  assert.deepEqual(list.map(item => item.code), [...expected.keys()].reverse(), 'Newest campaigns first');
  for (const actual of list) {
    const wanted = expected.get(actual.code);
    for (const field of ['id', 'code', 'phase', 'receiver', 'orderCount', 'paidTotalCents', 'canDelete', 'artFrontUrl']) {
      assert.deepEqual(actual[field], wanted[field], `${actual.code}: ${field}`);
    }
    assert.ok(Number.isSafeInteger(actual.orderCount));
    assert.ok(Number.isSafeInteger(actual.paidTotalCents));
    assert.equal(actual.activeCoupon?.code ?? null, wanted.activeCouponCode, `${actual.code}: coupon isolation`);
    assert.deepEqual(actual.couponHistory.map(coupon => coupon.code), wanted.couponCodes, `${actual.code}: coupon history`);
  }
}

const receivers = new Map();
let modelId;
try {
  const [[version]] = await pool.query('SELECT VERSION() AS engine');
  // Remove seeded campaigns using their normal FK cascade, only in the local test DB.
  await pool.execute('DELETE FROM campaigns');
  assert.deepEqual(await listCampaigns(), [], 'An empty database returns an empty list');
  [[{ id: modelId }]] = await pool.query('SELECT id FROM shirt_models ORDER BY id LIMIT 1');
  const [colors] = await pool.query('SELECT id FROM colors ORDER BY id LIMIT 2');
  for (const active of [true, false]) {
    const name = active ? "Recebedor Ágil d'Ávila" : 'Recebedor inativo';
    const infinitepayHandle = active ? 'agil.conta-qa' : 'inativo_qa';
    const [result] = await pool.execute('INSERT INTO payment_receivers (name, infinitepay_handle, active) VALUES (?, ?, ?)', [name, infinitepayHandle, active]);
    receivers.set(result.insertId, { id: result.insertId, name, infinitepayHandle, active });
  }
  const [enabled, disabled] = [...receivers.keys()];
  await campaign('QA-EMPTY');
  await campaign('QA-EMPTY-RECEIVER', enabled);
  await campaign('QA-DISABLED', disabled);
  const cancelled = await campaign('QA-CANCELLED', enabled);
  await orders(cancelled, paymentStatuses.map(paymentStatus => ({ paymentStatus, status: 'cancelled' })));
  const mixed = await campaign('QA-MIXED', enabled);
  const mixedFixtures = ['active', 'cancelled'].flatMap(status => paymentStatuses.map((paymentStatus, index) => ({
    status, paymentStatus, total: 1234 + index * 137,
  })));
  const mixedOrders = await orders(mixed, mixedFixtures);
  const large = await campaign('QA-LARGE-TOTAL', disabled);
  await orders(large, Array.from({ length: 3 }, () => ({ paymentStatus: 'paid', total: 2_000_000_000 })));
  assert.equal(large.paidTotalCents, 6_000_000_000, 'Totals can exceed a 32-bit integer');

  // Coupon joins must not multiply campaign orders or receipts.
  const [coupon] = await pool.execute("INSERT INTO campaign_coupons (campaign_id, code, active) VALUES (?, 'QA-ACTIVE', TRUE)", [mixed.id]);
  await pool.execute('INSERT INTO campaign_coupon_discounts (coupon_id, shirt_model_id, discount_cents) VALUES (?, ?, 100)', [coupon.insertId, modelId]);
  for (const id of mixedOrders) await pool.execute(`INSERT INTO coupon_redemptions
    (coupon_id, order_id, coupon_code, total_discount_cents) VALUES (?, ?, 'QA-ACTIVE', 100)`, [coupon.insertId, id]);
  await pool.execute("INSERT INTO campaign_coupons (campaign_id, code, active) VALUES (?, 'QA-OLD', FALSE)", [mixed.id]);
  mixed.activeCouponCode = 'QA-ACTIVE';
  mixed.couponCodes = ['QA-OLD', 'QA-ACTIVE'];

  // Artwork precedence and selection must survive multiple photos/variants.
  const base = await campaign('QA-BASE');
  await pool.execute("UPDATE campaigns SET art_front_url='/uploads/base.png', art_back_url='/uploads/base-back.png' WHERE id=?", [base.id]);
  base.artFrontUrl = '/uploads/base.png';
  await orders(base, [{ paymentStatus: 'paid' }, { paymentStatus: 'pending' }]);
  await pool.execute("INSERT INTO campaign_color_photos (campaign_id, color_id, photo_url, sort_order) VALUES (?, ?, '/uploads/ignored.png', 0)", [base.id, colors[0].id]);
  const photo = await campaign('QA-PHOTO', enabled);
  await pool.execute(`INSERT INTO campaign_color_photos (campaign_id, color_id, photo_url, sort_order)
    VALUES (?, ?, '/uploads/later.jpg', 2), (?, ?, '/uploads/first.jpg', 0), (?, ?, '/uploads/tied.jpg', 0)`,
  [photo.id, colors[0].id, photo.id, colors[0].id, photo.id, colors[1].id]);
  photo.artFrontUrl = '/uploads/first.jpg';
  await orders(photo, [{ paymentStatus: 'paid' }, { paymentStatus: 'paid' }, { paymentStatus: 'failed' }]);
  await pool.execute(`INSERT INTO campaign_variant_artworks (campaign_variant_id, artwork_mode, front_url)
    VALUES (?, 'variant_mockup', '/uploads/behind-photo.png')`, [await variant(photo, colors[0].id)]);
  const front = await campaign('QA-VARIANT');
  const frontVariant = await variant(front, colors[0].id);
  await pool.execute(`INSERT INTO campaign_variant_artworks (campaign_variant_id, artwork_mode, front_url, back_url)
    VALUES (?, 'variant_mockup', '/uploads/front.png', '/uploads/back.png')`, [frontVariant]);
  front.artFrontUrl = '/uploads/front.png';
  const back = await campaign('QA-BACK');
  const backVariant = await variant(back, colors[0].id);
  await pool.execute(`INSERT INTO campaign_variant_artworks (campaign_variant_id, artwork_mode, front_url, back_url)
    VALUES (?, 'variant_mockup', '', '/uploads/back-only.png')`, [backVariant]);
  back.artFrontUrl = '/uploads/back-only.png';
  const hidden = await campaign('QA-INACTIVE-ART');
  const hiddenVariant = await variant(hidden, colors[0].id);
  await pool.execute('UPDATE campaign_variants SET active=FALSE WHERE id=?', [hiddenVariant]);
  await pool.execute(`INSERT INTO campaign_variant_artworks (campaign_variant_id, artwork_mode, front_url)
    VALUES (?, 'variant_mockup', '/uploads/hidden.png')`, [hiddenVariant]);
  const overlay = await campaign('QA-OVERLAY');
  await pool.execute(`INSERT INTO campaign_variant_artworks (campaign_variant_id, artwork_mode, front_url)
    VALUES (?, 'overlay', '/uploads/overlay.png')`, [await variant(overlay, colors[0].id)]);

  // Unequal prices, all payment states and campaign phases, shared receivers, and large totals.
  for (let n = 0; n < 40; n++) {
    const item = await campaign(`QA-VOLUME-${n}`, [null, enabled, disabled][n % 3], phases[n % phases.length]);
    await orders(item, Array.from({ length: 60 }, (_, index) => ({
      status: index % 7 === 0 ? 'cancelled' : 'active',
      paymentStatus: paymentStatuses[(index + n) % paymentStatuses.length],
      total: 10_000_000 + index * 113 + n,
    })));
    const couponCode = `QA-VOLUME-COUPON-${n}`;
    const couponActive = n % 3 !== 0;
    const [volumeCoupon] = await pool.execute('INSERT INTO campaign_coupons (campaign_id, code, active) VALUES (?, ?, ?)',
      [item.id, couponCode, couponActive]);
    await pool.execute('INSERT INTO campaign_coupon_discounts (coupon_id, shirt_model_id, discount_cents) VALUES (?, ?, 137)',
      [volumeCoupon.insertId, modelId]);
    item.activeCouponCode = couponActive ? couponCode : null;
    item.couponCodes = [couponCode];
  }
  const timings = [];
  for (const mode of ['STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION', 'STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ENGINE_SUBSTITUTION']) {
    for (const collation of ['utf8mb4_general_ci', 'utf8mb4_unicode_ci']) {
      // Configure every pooled connection, including ones used by simultaneous reads.
      const connections = await Promise.all(Array.from({ length: 4 }, () => pool.getConnection()));
      try {
        for (const connection of connections) {
          await connection.query('SET SESSION sql_mode=?', [mode]);
          await connection.query(`SET NAMES utf8mb4 COLLATE ${collation}`);
        }
      } finally { for (const connection of connections) connection.release(); }
      const start = performance.now();
      const list = await listCampaigns();
      verify(list);
      const coupons = list.find(item => item.code === mixed.code);
      assert.equal(coupons.activeCoupon.code, 'QA-ACTIVE');
      assert.equal(coupons.activeCoupon.usedCount, 5);
      assert.equal(coupons.couponHistory.length, 2);
      const activeHistory = coupons.couponHistory.find(item => item.code === 'QA-ACTIVE');
      assert.deepEqual([activeHistory.usedCount, activeHistory.paidCount, activeHistory.pendingCount,
        activeHistory.cancelledCount, activeHistory.refundedCount, activeHistory.failedCount], [5, 1, 1, 5, 2, 1]);
      timings.push(Math.round(performance.now() - start));
      console.log(`✓ listagem: ${mode.includes('ONLY_FULL_GROUP_BY') ? 'strict grouping' : 'default grouping'}, ${collation}`);
    }
  }
  for (const list of await Promise.all(Array.from({ length: 10 }, () => listCampaigns()))) verify(list);
  const [rename] = await pool.execute('UPDATE payment_receivers SET name=? WHERE id=?', ['Recebedor atualizado', enabled]);
  assert.equal(rename.affectedRows, 1);
  receivers.get(enabled).name = 'Recebedor atualizado';
  verify(await listCampaigns());
  await assert.rejects(pool.execute('DELETE FROM payment_receivers WHERE id=?', [enabled]),
    error => error.code === 'ER_ROW_IS_REFERENCED_2', 'FK prevents a campaign from referencing a deleted receiver');
  // Repository must propagate outages, never fabricate a successful empty list.
  const outage = Object.assign(new Error('test outage'), { code: 'ECONNRESET' });
  await assert.rejects(listCampaignsQuery1({ execute: async () => { throw outage; } }, []), error => error === outage);
  console.log(JSON.stringify({ engine: version.engine, campaigns: expected.size, orders: orderSequence,
    matrixRuns: timings.length, concurrentReads: 10, durationsMs: timings }));
} finally {
  await pool.end();
}
