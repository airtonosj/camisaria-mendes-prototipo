/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function couponUsageCountQuery1(executor, values, lock = false) {
  return executor.execute(`SELECT COUNT(*) AS used_count
       FROM coupon_redemptions cr
       JOIN orders o ON o.id = cr.order_id AND o.status = 'active'
      WHERE cr.coupon_id = ?${lock ? ' FOR UPDATE' : ''}`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function couponDiscountsQuery1(executor, values) {
  return executor.execute(`SELECT ccd.shirt_model_id, sm.code AS model_code, sm.name AS model_name, ccd.discount_cents
       FROM campaign_coupon_discounts ccd
       JOIN shirt_models sm ON sm.id = ccd.shirt_model_id
      WHERE ccd.coupon_id = ?
      ORDER BY sm.sort_order`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function activeCampaignCouponQuery1(executor, values) {
  return executor.execute(`SELECT id, code, expires_at, usage_limit, minimum_quantity, maximum_discount_quantity
       FROM campaign_coupons
      WHERE campaign_id = ? AND active = TRUE
      ORDER BY updated_at DESC, id DESC LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function validateActiveCouponQuery1(executor, values, fragment0) {
  return executor.execute(`SELECT id, code, expires_at, usage_limit, minimum_quantity, maximum_discount_quantity
       FROM campaign_coupons
      WHERE campaign_id = ? AND code = ? AND active = TRUE
      LIMIT 1${fragment0}`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function ensureCouponFitsCampaignPricesQuery1(executor, values) {
  return executor.execute(`SELECT cv.shirt_model_id, sm.code AS model_code, sm.name AS model_name,
            MIN(cv.unit_price_cents) AS minimum_price
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE
      GROUP BY cv.shirt_model_id, sm.code, sm.name`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignCouponQuery1(executor, values) {
  return executor.execute("UPDATE campaign_coupons SET active = FALSE WHERE campaign_id = ? AND active = TRUE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignCouponQuery2(executor, values) {
  return executor.execute("SELECT id FROM campaign_coupons WHERE campaign_id = ? AND code = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignCouponQuery3(executor, values) {
  return executor.execute("UPDATE campaign_coupons SET expires_at = ?, usage_limit = ?, minimum_quantity = ?, maximum_discount_quantity = ?, active = TRUE WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignCouponQuery4(executor, values) {
  return executor.execute("DELETE FROM campaign_coupon_discounts WHERE coupon_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignCouponQuery5(executor, values) {
  return executor.execute("INSERT INTO campaign_coupons (campaign_id, code, expires_at, usage_limit, minimum_quantity, maximum_discount_quantity, active) VALUES (?, ?, ?, ?, ?, ?, TRUE)", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignCouponQuery6(executor, values) {
  return executor.execute("INSERT INTO campaign_coupon_discounts (coupon_id, shirt_model_id, discount_cents) VALUES (?, ?, ?)", values);
}
