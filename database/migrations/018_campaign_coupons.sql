-- Camisaria Mendes - 018: cupons de desconto por campanha
--
-- O cupom permanece separado do pedido. Ao comprar, os valores usados ficam
-- congelados em orders/order_items e em coupon_redemptions, preservando o
-- histórico mesmo que a camisaria edite ou remova o cupom depois.

CREATE TABLE IF NOT EXISTS campaign_coupons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(32) NOT NULL,
  expires_at DATETIME(3) NULL,
  usage_limit INT UNSIGNED NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_coupon_code (campaign_id, code),
  KEY ix_campaign_coupons_active (campaign_id, active),
  CONSTRAINT fk_campaign_coupons_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT chk_campaign_coupons_usage_limit CHECK (usage_limit IS NULL OR usage_limit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_coupon_discounts (
  coupon_id BIGINT UNSIGNED NOT NULL,
  shirt_model_id SMALLINT UNSIGNED NOT NULL,
  discount_cents INT UNSIGNED NOT NULL,
  PRIMARY KEY (coupon_id, shirt_model_id),
  KEY ix_campaign_coupon_discounts_model (shirt_model_id),
  CONSTRAINT fk_coupon_discounts_coupon
    FOREIGN KEY (coupon_id) REFERENCES campaign_coupons (id) ON DELETE CASCADE,
  CONSTRAINT fk_coupon_discounts_model
    FOREIGN KEY (shirt_model_id) REFERENCES shirt_models (id) ON DELETE RESTRICT,
  CONSTRAINT chk_coupon_discounts_value CHECK (discount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD COLUMN subtotal_cents INT UNSIGNED NULL AFTER delivery_status,
  ADD COLUMN discount_cents INT UNSIGNED NOT NULL DEFAULT 0 AFTER subtotal_cents,
  ADD COLUMN coupon_code VARCHAR(32) NULL AFTER discount_cents;

UPDATE orders SET subtotal_cents = total_cents WHERE subtotal_cents IS NULL;

ALTER TABLE orders
  MODIFY COLUMN subtotal_cents INT UNSIGNED NOT NULL,
  ADD CONSTRAINT chk_orders_subtotal CHECK (subtotal_cents > 0),
  ADD CONSTRAINT chk_orders_discount CHECK (discount_cents < subtotal_cents);

ALTER TABLE order_items
  ADD COLUMN unit_discount_cents INT UNSIGNED NOT NULL DEFAULT 0 AFTER unit_price_cents,
  ADD CONSTRAINT chk_order_items_unit_discount CHECK (unit_discount_cents < unit_price_cents);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  coupon_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  coupon_code VARCHAR(32) NOT NULL,
  total_discount_cents INT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupon_redemptions_order (order_id),
  KEY ix_coupon_redemptions_coupon (coupon_id),
  CONSTRAINT fk_coupon_redemptions_coupon
    FOREIGN KEY (coupon_id) REFERENCES campaign_coupons (id) ON DELETE RESTRICT,
  CONSTRAINT fk_coupon_redemptions_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT chk_coupon_redemptions_total_discount CHECK (total_discount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('018_campaign_coupons')
ON DUPLICATE KEY UPDATE version = VALUES(version);
