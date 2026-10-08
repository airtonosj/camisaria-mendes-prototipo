/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery1(executor, values) {
  return executor.execute("SELECT order_number, total_cents, payment_status FROM orders WHERE idempotency_key = ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery2(executor, values) {
  return executor.execute("SELECT id, phase, DATE_FORMAT(delivery_expected_on, '%Y-%m-%d') AS delivery_expected_on, delivery_note FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery3(executor, values, fragment0) {
  return executor.execute(`SELECT id, shirt_model_id, unit_price_cents FROM campaign_variants
        WHERE campaign_id = ? AND active = TRUE AND id IN (${fragment0}) FOR UPDATE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery4(executor, values) {
  return executor.execute(`SELECT cms.shirt_model_id, cms.size_id, sz.code
         FROM campaign_model_sizes cms
         JOIN sizes sz ON sz.id = cms.size_id
        WHERE cms.campaign_id = ? AND sz.active = TRUE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery5(executor, values) {
  return executor.execute(`INSERT INTO orders
        (order_number, idempotency_key, campaign_id, customer_name, customer_whatsapp, customer_email,
         subtotal_cents, discount_cents, coupon_code, total_cents, delivery_expected_on, delivery_note, delivery_forecast_recorded)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery6(executor, values) {
  return executor.execute(`INSERT INTO order_items
          (order_id, campaign_variant_id, size_id, quantity, unit_price_cents, unit_discount_cents, discounted_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createOrderQuery7(executor, values) {
  return executor.execute(`INSERT INTO coupon_redemptions
          (coupon_id, order_id, coupon_code, total_discount_cents)
         VALUES (?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function trackOrderQuery1(executor, values, fragment0) {
  return executor.execute(`SELECT o.id, o.order_number, o.customer_name, o.status, o.cancellation_reason,
            o.payment_status, o.delivery_status,
            (SELECT p.capture_method FROM payments p
              WHERE p.order_id = o.id AND p.status IN ('paid', 'refunded', 'partially_refunded')
              ORDER BY p.confirmed_at DESC, p.id DESC LIMIT 1) AS payment_method,
            o.subtotal_cents, o.discount_cents, o.coupon_code, o.total_cents,
            o.created_at, o.paid_at, o.delivered_at,
            DATE_FORMAT(o.delivery_expected_on, '%Y-%m-%d') AS purchased_delivery_expected_on, o.delivery_note AS purchased_delivery_note, o.delivery_forecast_recorded,
            DATE_FORMAT(c.delivery_expected_on, '%Y-%m-%d') AS delivery_expected_on, c.delivery_note,
            c.code AS campaign_code, c.title AS campaign_title, c.phase AS campaign_phase,
            c.representative_name, c.pickup_instructions, c.art_front_url, c.art_back_url, c.art_render_mode,
            c.art_front_x, c.art_front_y, c.art_front_scale, c.art_front_rotation,
            c.art_back_x, c.art_back_y, c.art_back_scale, c.art_back_rotation
       FROM orders o
       JOIN campaigns c ON c.id = o.campaign_id
      WHERE o.order_number = ? AND o.customer_whatsapp IN (${fragment0})
      LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function trackOrderQuery2(executor, values) {
  return executor.execute(`SELECT cv.id AS variant_id, sm.name AS model_name, co.name AS color_name, co.hex_color, sz.code AS size,
            sz.size_group, oi.quantity, oi.unit_price_cents, oi.unit_discount_cents, oi.discounted_quantity,
            (oi.quantity * oi.unit_price_cents - oi.discounted_quantity * oi.unit_discount_cents) AS line_total_cents,
            cva.artwork_mode, cva.front_source, cva.front_url, cva.front_transform_override,
            cva.front_x, cva.front_y, cva.front_scale, cva.front_rotation,
            cva.back_source, cva.back_url, cva.back_transform_override,
            cva.back_x, cva.back_y, cva.back_scale, cva.back_rotation
       FROM order_items oi
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       JOIN sizes sz ON sz.id = oi.size_id
       LEFT JOIN campaign_variant_artworks cva
         ON cva.campaign_variant_id = cv.id AND cva.artwork_mode = ?
       WHERE oi.order_id = ? ORDER BY oi.id`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function listCampaignOrdersQuery1(executor, values) {
  return executor.execute(`SELECT o.order_number, o.customer_name, o.customer_whatsapp, o.customer_email,
            o.status, o.cancellation_reason, o.payment_status, o.delivery_status,
            (SELECT p.capture_method FROM payments p
              WHERE p.order_id = o.id AND p.status IN ('paid', 'refunded', 'partially_refunded')
              ORDER BY p.confirmed_at DESC, p.id DESC LIMIT 1) AS payment_method,
            o.subtotal_cents, o.discount_cents, o.coupon_code, o.total_cents, o.created_at,
            sm.name AS model_name, co.name AS color_name, co.hex_color,
            sz.code AS size, sz.size_group, oi.quantity, oi.unit_price_cents, oi.unit_discount_cents, oi.discounted_quantity
       FROM campaigns c
       JOIN orders o ON o.campaign_id = c.id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       JOIN sizes sz ON sz.id = oi.size_id
      WHERE c.code = ?
      ORDER BY o.created_at DESC, oi.id`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function changeDeliveryStatusQuery1(executor, values) {
  return executor.execute(`SELECT o.id, o.delivery_status, o.payment_status, c.phase AS campaign_phase
         FROM orders o JOIN campaigns c ON c.id = o.campaign_id
        WHERE o.order_number = ? AND o.status = 'active' LIMIT 1 FOR UPDATE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function changeDeliveryStatusQuery2(executor, values) {
  // O segundo parâmetro é numérico para evitar comparar textos com collations
  // diferentes entre a conexão mysql2 e o servidor de produção.
  return executor.execute("UPDATE orders SET delivery_status = ?, delivered_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP(3) ELSE delivered_at END WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function changeDeliveryStatusQuery3(executor, values) {
  return executor.execute(`INSERT INTO delivery_history (order_id, previous_status, next_status, note, changed_by_user_id)
       VALUES (?, ?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function closeOrderPaymentLifecycleQuery1(executor, values) {
  return executor.execute(`UPDATE payment_checkouts
        SET status = 'expired', locked_at = NULL, last_error = ?
      WHERE order_id = ? AND status <> 'expired'`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function closeOrderPaymentLifecycleQuery2(executor, values) {
  return executor.execute(`UPDATE payment_events
        SET dead_lettered_at = CURRENT_TIMESTAMP(3), locked_at = NULL, processing_error = ?
      WHERE order_id = ? AND processed_at IS NULL AND dead_lettered_at IS NULL`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function cancelOrderQuery1(executor, values) {
  return executor.execute("SELECT id, status, payment_status FROM orders WHERE order_number = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function cancelOrderQuery2(executor, values) {
  return executor.execute(`UPDATE orders SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP(3),
         cancellation_reason = ?, cancelled_by_user_id = ? WHERE id = ?`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function registerOrderRefundQuery1(executor, values) {
  return executor.execute("SELECT id, status, payment_status, total_cents FROM orders WHERE order_number = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function registerOrderRefundQuery2(executor, values) {
  return executor.execute(`SELECT id, provider FROM payments
        WHERE order_id = ? AND status = 'paid'
        ORDER BY confirmed_at DESC, id DESC LIMIT 1 FOR UPDATE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function registerOrderRefundQuery3(executor, values) {
  return executor.execute(`INSERT INTO order_refunds
          (order_id, payment_id, provider, provider_refund_id, amount_cents, reason, receipt_url, refunded_at, recorded_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function registerOrderRefundQuery4(executor, values) {
  return executor.execute("UPDATE payments SET status = 'refunded' WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function registerOrderRefundQuery5(executor, values) {
  return executor.execute(`UPDATE orders SET payment_status = 'refunded', status = 'cancelled',
         cancelled_at = CURRENT_TIMESTAMP(3), cancellation_reason = ?, cancelled_by_user_id = ?
       WHERE id = ?`, values);
}
