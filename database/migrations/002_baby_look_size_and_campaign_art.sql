-- Camisaria Mendes - 002: Baby Look como tamanho e arte única por campanha
--
-- Baby Look deixa de ser corte e passa a ser um grupo de tamanhos (PPB..XGB).
-- A arte sai da variante e sobe para a campanha: uma imagem de frente obrigatória
-- e uma de costas opcional, válidas para todos os cortes e tamanhos.
-- Cada campanha define quais tamanhos libera para cada corte.

CREATE TABLE IF NOT EXISTS sizes (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(8) NOT NULL,
  name VARCHAR(40) NOT NULL,
  size_group VARCHAR(16) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_sizes_code (code),
  KEY ix_sizes_group_order (size_group, sort_order),
  CONSTRAINT chk_sizes_group CHECK (size_group IN ('standard', 'baby_look'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO sizes (code, name, size_group, sort_order) VALUES
  ('PP', 'PP', 'standard', 10),
  ('P', 'P', 'standard', 20),
  ('M', 'M', 'standard', 30),
  ('G', 'G', 'standard', 40),
  ('GG', 'GG', 'standard', 50),
  ('XG', 'XG', 'standard', 60),
  ('PPB', 'PPB', 'baby_look', 110),
  ('PB', 'PB', 'baby_look', 120),
  ('MB', 'MB', 'baby_look', 130),
  ('GB', 'GB', 'baby_look', 140),
  ('GGB', 'GGB', 'baby_look', 150),
  ('XGB', 'XGB', 'baby_look', 160)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), size_group = VALUES(size_group), sort_order = VALUES(sort_order), active = TRUE;

CREATE TABLE IF NOT EXISTS campaign_model_sizes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NOT NULL,
  shirt_model_id SMALLINT UNSIGNED NOT NULL,
  size_id SMALLINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_campaign_model_size (campaign_id, shirt_model_id, size_id),
  KEY ix_campaign_model_sizes_lookup (campaign_id, shirt_model_id),
  CONSTRAINT fk_campaign_model_sizes_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_model_sizes_model FOREIGN KEY (shirt_model_id) REFERENCES shirt_models (id) ON DELETE RESTRICT,
  CONSTRAINT fk_campaign_model_sizes_size FOREIGN KEY (size_id) REFERENCES sizes (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A arte passa a pertencer à campanha. A imagem de frente também é a capa usada
-- no mostruário, para a camisaria enviar um arquivo só.
ALTER TABLE campaigns
  ADD COLUMN art_front_url TEXT NULL AFTER representative_whatsapp,
  ADD COLUMN art_back_url TEXT NULL AFTER art_front_url;

UPDATE campaigns SET art_front_url = cover_image_url
 WHERE art_front_url IS NULL AND cover_image_url IS NOT NULL;

ALTER TABLE campaigns DROP COLUMN cover_image_url;

ALTER TABLE campaign_variants
  DROP COLUMN front_image_url,
  DROP COLUMN back_image_url;

-- O tamanho deixa de ser texto validado por CHECK e passa a referenciar o catálogo.
ALTER TABLE order_items
  DROP CONSTRAINT chk_order_items_size,
  ADD COLUMN size_id SMALLINT UNSIGNED NULL AFTER campaign_variant_id;

UPDATE order_items oi JOIN sizes sz ON sz.code = oi.size
   SET oi.size_id = sz.id
 WHERE oi.size_id IS NULL;

ALTER TABLE order_items
  MODIFY COLUMN size_id SMALLINT UNSIGNED NOT NULL,
  DROP INDEX ix_order_items_variant_size,
  DROP COLUMN size,
  ADD KEY ix_order_items_variant_size (campaign_variant_id, size_id),
  ADD CONSTRAINT fk_order_items_size FOREIGN KEY (size_id) REFERENCES sizes (id) ON DELETE RESTRICT;

-- Baby Look sai do catálogo de cortes. As variantes antigas são desativadas em vez
-- de removidas para preservar o histórico dos pedidos já registrados.
UPDATE campaign_variants cv
  JOIN shirt_models sm ON sm.id = cv.shirt_model_id
   SET cv.active = FALSE
 WHERE sm.code = 'baby_look';

UPDATE shirt_models SET active = FALSE WHERE code = 'baby_look';

CREATE OR REPLACE VIEW v_production_report AS
SELECT
  c.id AS campaign_id,
  c.code AS campaign_code,
  c.title AS campaign_title,
  sm.name AS model_name,
  co.name AS color_name,
  co.hex_color,
  sz.code AS size,
  sz.size_group,
  sz.sort_order AS size_sort_order,
  SUM(oi.quantity) AS quantity
FROM orders o
JOIN campaigns c ON c.id = o.campaign_id
JOIN order_items oi ON oi.order_id = o.id
JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
JOIN shirt_models sm ON sm.id = cv.shirt_model_id
JOIN colors co ON co.id = cv.color_id
JOIN sizes sz ON sz.id = oi.size_id
WHERE o.status = 'active' AND o.payment_status = 'paid'
GROUP BY c.id, c.code, c.title, sm.id, sm.name, co.id, co.name, co.hex_color, sz.id, sz.code, sz.size_group, sz.sort_order;

CREATE OR REPLACE VIEW v_delivery_report AS
SELECT
  c.id AS campaign_id,
  c.code AS campaign_code,
  c.title AS campaign_title,
  c.representative_name,
  o.id AS order_id,
  o.order_number,
  o.customer_name,
  o.customer_whatsapp,
  sm.name AS model_name,
  co.name AS color_name,
  sz.code AS size,
  sz.sort_order AS size_sort_order,
  oi.quantity,
  CASE
    WHEN o.delivery_status IN ('delivered', 'issue') THEN o.delivery_status
    WHEN c.phase IN ('ready_for_delivery', 'completed') THEN 'ready'
    ELSE 'waiting_campaign'
  END AS effective_delivery_status
FROM orders o
JOIN campaigns c ON c.id = o.campaign_id
JOIN order_items oi ON oi.order_id = o.id
JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
JOIN shirt_models sm ON sm.id = cv.shirt_model_id
JOIN colors co ON co.id = cv.color_id
JOIN sizes sz ON sz.id = oi.size_id
WHERE o.status = 'active' AND o.payment_status = 'paid';

INSERT INTO schema_migrations (version) VALUES ('002_baby_look_size_and_campaign_art')
ON DUPLICATE KEY UPDATE version = VALUES(version);
