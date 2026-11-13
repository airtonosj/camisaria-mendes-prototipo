-- Camisaria Mendes - 019: quantidade mínima para ativar o cupom

ALTER TABLE campaign_coupons
  ADD COLUMN minimum_quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER usage_limit,
  ADD CONSTRAINT chk_campaign_coupons_minimum_quantity
    CHECK (minimum_quantity BETWEEN 1 AND 200);

INSERT INTO schema_migrations (version) VALUES ('019_campaign_coupon_minimum_quantity')
ON DUPLICATE KEY UPDATE version = VALUES(version);
