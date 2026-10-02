/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getCampaignQuery1(executor, values) {
  return executor.execute(`SELECT id, code, title, subtitle, phase, deadline_at, pickup_instructions,
            representative_name, representative_whatsapp, art_front_url, art_back_url, art_render_mode,
            mockup_enabled, real_photos_enabled,
            art_front_x, art_front_y, art_front_scale, art_front_rotation,
            art_back_x, art_back_y, art_back_scale, art_back_rotation, receiver_id
       FROM campaigns WHERE code = ? LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getCampaignQuery2(executor, values) {
  return executor.execute(`SELECT cv.id, cv.color_id, sm.code AS model_code, sm.name AS model_name, co.name AS color_name,
            co.hex_color, cv.unit_price_cents, cva.artwork_mode,
            cva.front_source, cva.front_url, cva.front_transform_override,
            cva.front_x, cva.front_y, cva.front_scale, cva.front_rotation,
            cva.back_source, cva.back_url, cva.back_transform_override,
            cva.back_x, cva.back_y, cva.back_scale, cva.back_rotation
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
       LEFT JOIN campaign_variant_artworks cva
         ON cva.campaign_variant_id = cv.id AND cva.artwork_mode = ?
       WHERE cv.campaign_id = ? AND cv.active = TRUE AND sm.active = TRUE AND co.active = TRUE
       ORDER BY sm.sort_order, co.name`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getCampaignQuery3(executor, values) {
  return executor.execute(`SELECT sm.code AS model_code, sm.name AS model_name, sz.code, sz.name, sz.size_group
       FROM campaign_model_sizes cms
       JOIN shirt_models sm ON sm.id = cms.shirt_model_id
       JOIN sizes sz ON sz.id = cms.size_id
      WHERE cms.campaign_id = ? AND sm.active = TRUE AND sz.active = TRUE
      ORDER BY sm.sort_order, sz.sort_order`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getCampaignQuery4(executor, values) {
  return executor.execute(`SELECT cva.* FROM campaign_variant_artworks cva
       JOIN campaign_variants cv ON cv.id = cva.campaign_variant_id
      WHERE cv.campaign_id = ?`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getCampaignQuery5(executor, values) {
  return executor.execute(`SELECT ccp.color_id, co.name AS color_name, ccp.photo_url, ccp.sort_order
       FROM campaign_color_photos ccp
       JOIN colors co ON co.id = ccp.color_id
      WHERE ccp.campaign_id = ?
      ORDER BY co.name, ccp.sort_order, ccp.id`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getCampaignQuery6(executor, values) {
  return executor.execute(`SELECT ccv.color_id, co.name AS color_name, ccv.video_url, ccv.poster_url,
            ccv.duration_seconds, ccv.bytes
       FROM campaign_color_videos ccv
       JOIN colors co ON co.id = ccv.color_id
      WHERE ccv.campaign_id = ?
      ORDER BY co.name, ccv.id`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function getPublicCampaignCouponQuery1(executor, values) {
  return executor.execute("SELECT id FROM campaigns WHERE code = ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function listCampaignsQuery1(executor, values) {
  return executor.execute(`SELECT c.id, c.code, c.title, c.subtitle, c.phase, c.deadline_at, c.pickup_instructions,
            c.representative_name, c.representative_whatsapp, c.art_front_url, c.art_back_url, c.art_render_mode,
            COALESCE(
              c.art_front_url,
              (SELECT ccp.photo_url
                 FROM campaign_color_photos ccp
                WHERE ccp.campaign_id = c.id
                ORDER BY ccp.sort_order, ccp.id LIMIT 1),
              (SELECT COALESCE(NULLIF(cva.front_url, ''), NULLIF(cva.back_url, ''))
                 FROM campaign_variants cover_variant
                 JOIN campaign_variant_artworks cva ON cva.campaign_variant_id = cover_variant.id
                WHERE cover_variant.campaign_id = c.id AND cover_variant.active = TRUE
                  AND cva.artwork_mode = 'variant_mockup'
                ORDER BY cover_variant.id LIMIT 1)
            ) AS cover_art_url,
            COUNT(DISTINCT o.id) AS order_count,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_cents ELSE 0 END), 0) AS paid_total_cents,
            NOT EXISTS (SELECT 1 FROM orders order_history WHERE order_history.campaign_id = c.id) AS can_delete,
            c.receiver_id, ANY_VALUE(pr.name) AS receiver_name,
            ANY_VALUE(pr.infinitepay_handle) AS receiver_handle, ANY_VALUE(pr.active) AS receiver_active
       FROM campaigns c
       LEFT JOIN payment_receivers pr ON pr.id = c.receiver_id
       LEFT JOIN orders o ON o.campaign_id = c.id AND o.status = 'active'
      GROUP BY c.id
      ORDER BY c.created_at DESC`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function listCampaignsQuery2(executor, values) {
  return executor.execute(`SELECT cc.id, cc.campaign_id, cc.code, cc.active, cc.expires_at, cc.usage_limit, cc.minimum_quantity, cc.maximum_discount_quantity,
            COUNT(CASE WHEN o.status = 'active' THEN 1 END) AS used_count,
            COUNT(CASE WHEN o.status = 'active' AND o.payment_status = 'paid' THEN 1 END) AS paid_count,
            COUNT(CASE WHEN o.status = 'active' AND o.payment_status = 'pending' THEN 1 END) AS pending_count,
            COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) AS cancelled_count,
            COUNT(CASE WHEN o.status = 'active' AND o.payment_status IN ('refunded', 'partially_refunded') THEN 1 END) AS refunded_count,
            COUNT(CASE WHEN o.status = 'active' AND o.payment_status = 'failed' THEN 1 END) AS failed_count
       FROM campaign_coupons cc
       LEFT JOIN coupon_redemptions cr ON cr.coupon_id = cc.id
      LEFT JOIN orders o ON o.id = cr.order_id
      GROUP BY cc.id, cc.campaign_id, cc.code, cc.active, cc.expires_at, cc.usage_limit, cc.minimum_quantity, cc.maximum_discount_quantity
      ORDER BY cc.id DESC`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function resolveCatalogIdsQuery1(executor, values, fragment0) {
  return executor.execute(`SELECT id, code FROM shirt_models WHERE active = TRUE AND code IN (${fragment0})`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function resolveCatalogIdsQuery2(executor, values, fragment0) {
  return executor.execute(`SELECT id, name, hex_color, active FROM colors WHERE name IN (${fragment0})`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function resolveCatalogIdsQuery3(executor, values) {
  return executor.execute("UPDATE colors SET active = TRUE WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function resolveCatalogIdsQuery4(executor, values) {
  return executor.execute("INSERT INTO colors (name, hex_color, active) VALUES (?, ?, TRUE)", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function resolveCatalogIdsQuery5(executor, values, fragment0) {
  return executor.execute(`SELECT id, code FROM sizes WHERE active = TRUE AND code IN (${fragment0})`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyArtworkConfigQuery1(executor, values) {
  return executor.execute("SELECT art_front_url, art_back_url FROM campaigns WHERE id = ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyArtworkConfigQuery2(executor, values) {
  return executor.execute(`UPDATE campaigns SET art_render_mode = ?, art_front_url = ?, art_back_url = ?,
         art_front_x = ?, art_front_y = ?, art_front_scale = ?, art_front_rotation = ?,
         art_back_x = ?, art_back_y = ?, art_back_scale = ?, art_back_rotation = ?
       WHERE id = ?`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyArtworkConfigQuery3(executor, values) {
  return executor.execute("UPDATE campaigns SET art_render_mode = ? WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyArtworkConfigQuery4(executor, values) {
  return executor.execute(`SELECT cv.id, sm.code AS model_code, sm.name AS model_name, co.name AS color_name
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyArtworkConfigQuery5(executor, values) {
  return executor.execute("SELECT front_url, back_url FROM campaign_variant_artworks WHERE campaign_variant_id = ? AND artwork_mode = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyArtworkConfigQuery6(executor, values) {
  return executor.execute(`INSERT INTO campaign_variant_artworks
        (campaign_variant_id, artwork_mode,
         front_source, front_url, front_transform_override, front_x, front_y, front_scale, front_rotation,
         back_source, back_url, back_transform_override, back_x, back_y, back_scale, back_rotation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         front_source = VALUES(front_source), front_url = VALUES(front_url),
         front_transform_override = VALUES(front_transform_override), front_x = VALUES(front_x), front_y = VALUES(front_y),
         front_scale = VALUES(front_scale), front_rotation = VALUES(front_rotation),
         back_source = VALUES(back_source), back_url = VALUES(back_url),
         back_transform_override = VALUES(back_transform_override), back_x = VALUES(back_x), back_y = VALUES(back_y),
         back_scale = VALUES(back_scale), back_rotation = VALUES(back_rotation)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealPhotosQuery1(executor, values) {
  return executor.execute(`SELECT DISTINCT co.id, co.name
       FROM campaign_variants cv
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealPhotosQuery2(executor, values) {
  return executor.execute("SELECT photo_url FROM campaign_color_photos WHERE campaign_id = ? AND color_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealPhotosQuery3(executor, values) {
  return executor.execute("DELETE FROM campaign_color_photos WHERE campaign_id = ? AND color_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealPhotosQuery4(executor, values) {
  return executor.execute(`INSERT INTO campaign_color_photos (campaign_id, color_id, photo_url, sort_order)
         VALUES (?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealVideosQuery1(executor, values) {
  return executor.execute(`SELECT DISTINCT co.id, co.name
       FROM campaign_variants cv
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealVideosQuery2(executor, values) {
  return executor.execute("SELECT video_url, poster_url FROM campaign_color_videos WHERE campaign_id = ? AND color_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealVideosQuery3(executor, values) {
  return executor.execute("DELETE FROM campaign_color_videos WHERE campaign_id = ? AND color_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyRealVideosQuery4(executor, values) {
  return executor.execute(`INSERT INTO campaign_color_videos
        (campaign_id, color_id, video_url, poster_url, duration_seconds, bytes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         video_url = VALUES(video_url), poster_url = VALUES(poster_url),
         duration_seconds = VALUES(duration_seconds), bytes = VALUES(bytes)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function validateRealPhotoCoverageQuery1(executor, values) {
  return executor.execute(`SELECT co.name
       FROM campaign_variants cv
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE
      GROUP BY co.id, co.name
     HAVING NOT EXISTS (
       SELECT 1 FROM campaign_color_photos ccp
        WHERE ccp.campaign_id = ? AND ccp.color_id = co.id
     )
      ORDER BY co.name LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function validateMockupCoverageQuery1(executor, values) {
  return executor.execute("SELECT art_render_mode, art_front_url, art_back_url FROM campaigns WHERE id = ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function validateMockupCoverageQuery2(executor, values) {
  return executor.execute(`SELECT sm.name AS model_name, co.name AS color_name
         FROM campaign_variants cv
         JOIN shirt_models sm ON sm.id = cv.shirt_model_id
         JOIN colors co ON co.id = cv.color_id
         LEFT JOIN campaign_variant_artworks cva
           ON cva.campaign_variant_id = cv.id AND cva.artwork_mode = 'variant_mockup'
        WHERE cv.campaign_id = ? AND cv.active = TRUE
          AND (cva.campaign_variant_id IS NULL OR (cva.front_source <> 'custom' AND cva.back_source <> 'custom'))
        LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createCampaignQuery1(executor, values) {
  return executor.execute("SELECT id FROM campaigns WHERE code = ? LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createCampaignQuery2(executor, values) {
  return executor.execute(`INSERT INTO campaigns
        (code, title, subtitle, deadline_at, pickup_instructions, representative_name,
         representative_whatsapp, art_front_url, art_back_url, art_render_mode,
         mockup_enabled, real_photos_enabled, created_by_user_id, receiver_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createCampaignQuery3(executor, values) {
  return executor.execute(`INSERT INTO campaign_variants
            (campaign_id, shirt_model_id, color_id, unit_price_cents)
           VALUES (?, ?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function createCampaignQuery4(executor, values) {
  return executor.execute(`INSERT INTO campaign_model_sizes (campaign_id, shirt_model_id, size_id)
           VALUES (?, ?, ?)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateCampaignQuery1(executor, values) {
  return executor.execute("SELECT id, phase, art_front_url, art_back_url, art_render_mode, mockup_enabled, real_photos_enabled, receiver_id FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateCampaignQuery2(executor, values, fragment0) {
  return executor.execute(`UPDATE campaigns SET ${fragment0} WHERE id = ?`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function updateCampaignQuery3(executor, values) {
  return executor.execute("SELECT id FROM campaign_coupons WHERE campaign_id = ? AND active = TRUE ORDER BY updated_at DESC, id DESC LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deleteCampaignQuery1(executor, values) {
  return executor.execute("SELECT id, art_front_url, art_back_url FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deleteCampaignQuery2(executor, values) {
  return executor.execute("SELECT order_number FROM orders WHERE campaign_id = ? ORDER BY id LIMIT 1", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deleteCampaignQuery3(executor, values) {
  return executor.execute(`SELECT cva.front_url, cva.back_url
         FROM campaign_variant_artworks cva
         JOIN campaign_variants cv ON cv.id = cva.campaign_variant_id
        WHERE cv.campaign_id = ?`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deleteCampaignQuery4(executor, values) {
  return executor.execute("SELECT photo_url FROM campaign_color_photos WHERE campaign_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deleteCampaignQuery5(executor, values) {
  return executor.execute("SELECT video_url, poster_url FROM campaign_color_videos WHERE campaign_id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function deleteCampaignQuery6(executor, values) {
  return executor.execute("DELETE FROM campaigns WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery1(executor, values) {
  return executor.execute(`SELECT cv.id, cv.shirt_model_id, cv.color_id, sm.name AS model_name, co.name AS color_name
       FROM campaign_variants cv
       JOIN shirt_models sm ON sm.id = cv.shirt_model_id
       JOIN colors co ON co.id = cv.color_id
      WHERE cv.campaign_id = ? AND cv.active = TRUE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery2(executor, values) {
  return executor.execute("UPDATE campaign_variants SET active = FALSE WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery3(executor, values) {
  return executor.execute(`SELECT o.order_number FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.status = 'active'
        WHERE oi.campaign_variant_id = ? LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery4(executor, values) {
  return executor.execute("UPDATE campaign_variants SET active = FALSE WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery5(executor, values) {
  return executor.execute(`SELECT cms.id, cms.shirt_model_id, cms.size_id, sm.name AS model_name, sz.code AS size_code
       FROM campaign_model_sizes cms
       JOIN shirt_models sm ON sm.id = cms.shirt_model_id
       JOIN sizes sz ON sz.id = cms.size_id
      WHERE cms.campaign_id = ?`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery6(executor, values) {
  return executor.execute(`SELECT o.order_number FROM order_items oi
         JOIN orders o ON o.id = oi.order_id AND o.status = 'active'
         JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
        WHERE cv.campaign_id = ? AND cv.shirt_model_id = ? AND oi.size_id = ? LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery7(executor, values) {
  return executor.execute("DELETE FROM campaign_model_sizes WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery8(executor, values) {
  return executor.execute(`INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE unit_price_cents = VALUES(unit_price_cents), active = TRUE`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function applyCampaignModelsQuery9(executor, values) {
  return executor.execute(`INSERT INTO campaign_model_sizes (campaign_id, shirt_model_id, size_id) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE size_id = VALUES(size_id)`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function removeOrphanUploadQuery1(executor, values) {
  return executor.execute(`SELECT 1 FROM campaigns WHERE art_front_url = ? OR art_back_url = ?
     UNION ALL
     SELECT 1 FROM campaign_variant_artworks WHERE front_url = ? OR back_url = ?
     UNION ALL
     SELECT 1 FROM campaign_color_photos WHERE photo_url = ?
     UNION ALL
     SELECT 1 FROM campaign_color_videos WHERE video_url = ? OR poster_url = ?
     LIMIT 1`, values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function changeCampaignPhaseQuery1(executor, values) {
  return executor.execute("SELECT id, phase FROM campaigns WHERE code = ? LIMIT 1 FOR UPDATE", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function changeCampaignPhaseQuery2(executor, values) {
  return executor.execute("UPDATE campaigns SET phase = ? WHERE id = ?", values);
}

/** Uses the caller's connection; the service owns the transaction.
 * @param {import('mysql2/promise').Pool | import('mysql2/promise').PoolConnection} executor
 * @param {unknown[]} values
 */
export function changeCampaignPhaseQuery3(executor, values) {
  return executor.execute(`INSERT INTO campaign_phase_history
        (campaign_id, previous_phase, next_phase, direction, reason, changed_by_user_id, changed_by_label)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, values);
}
