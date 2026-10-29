-- Camisaria Mendes - 021: limite de peças descontadas por cupom
--
-- `maximum_discount_quantity` limita somente quantas peças recebem o desconto;
-- o cliente continua livre para comprar uma quantidade maior. A quantidade
-- efetivamente descontada fica congelada em cada item do pedido para preservar
-- o histórico e permitir a conferência exata do pagamento.

ALTER TABLE campaign_coupons
  ADD COLUMN maximum_discount_quantity SMALLINT UNSIGNED NULL AFTER minimum_quantity,
  ADD CONSTRAINT chk_campaign_coupons_maximum_discount_quantity
    CHECK (
      maximum_discount_quantity IS NULL
      OR maximum_discount_quantity BETWEEN minimum_quantity AND 200
    );

ALTER TABLE order_items
  ADD COLUMN discounted_quantity SMALLINT UNSIGNED NULL AFTER unit_discount_cents;

-- Antes desta migração, quando havia desconto ele incidia sobre toda a linha.
UPDATE order_items
   SET discounted_quantity = CASE WHEN unit_discount_cents > 0 THEN quantity ELSE 0 END
 WHERE discounted_quantity IS NULL;

ALTER TABLE order_items
  MODIFY COLUMN discounted_quantity SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_order_items_discounted_quantity
    CHECK (discounted_quantity <= quantity),
  ADD CONSTRAINT chk_order_items_discount_consistency
    CHECK (
      (unit_discount_cents = 0 AND discounted_quantity = 0)
      OR (unit_discount_cents > 0 AND discounted_quantity > 0)
    );

INSERT INTO schema_migrations (version) VALUES ('021_campaign_coupon_maximum_discount_quantity')
ON DUPLICATE KEY UPDATE version = VALUES(version);
