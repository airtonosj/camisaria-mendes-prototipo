-- Camisaria Mendes - schema inicial para MySQL 8.0+
-- Execute este arquivo dentro do banco já criado pela hospedagem.
-- Datas e horários são gravados em UTC pela aplicação.

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(64) PRIMARY KEY,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'camisaria',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_email (email),
  CONSTRAINT chk_users_role CHECK (role IN ('camisaria', 'representative'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shirt_models (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL,
  name VARCHAR(80) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_shirt_models_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS colors (
  id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  hex_color CHAR(7) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY uq_colors_name (name),
  CONSTRAINT chk_colors_hex CHECK (hex_color REGEXP '^#[0-9A-Fa-f]{6}$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  subtitle VARCHAR(255) NULL,
  phase VARCHAR(32) NOT NULL DEFAULT 'receiving_orders',
  deadline_at DATETIME(3) NOT NULL,
  pickup_instructions VARCHAR(255) NOT NULL,
  representative_name VARCHAR(160) NOT NULL,
  representative_whatsapp VARCHAR(20) NULL,
  cover_image_url TEXT NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_campaigns_code (code),
  KEY ix_campaigns_phase_deadline (phase, deadline_at),
  CONSTRAINT fk_campaigns_created_by FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_campaigns_phase CHECK (phase IN ('receiving_orders', 'orders_closed', 'production', 'ready_for_delivery', 'completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NOT NULL,
  shirt_model_id SMALLINT UNSIGNED NOT NULL,
  color_id SMALLINT UNSIGNED NOT NULL,
  unit_price_cents INT UNSIGNED NOT NULL,
  front_image_url TEXT NULL,
  back_image_url TEXT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_campaign_variant (campaign_id, shirt_model_id, color_id),
  KEY ix_campaign_variants_campaign_active (campaign_id, active),
  CONSTRAINT fk_campaign_variants_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_variants_model FOREIGN KEY (shirt_model_id) REFERENCES shirt_models (id) ON DELETE RESTRICT,
  CONSTRAINT fk_campaign_variants_color FOREIGN KEY (color_id) REFERENCES colors (id) ON DELETE RESTRICT,
  CONSTRAINT chk_campaign_variants_price CHECK (unit_price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_phase_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NOT NULL,
  previous_phase VARCHAR(32) NOT NULL,
  next_phase VARCHAR(32) NOT NULL,
  direction VARCHAR(12) NOT NULL,
  reason VARCHAR(500) NULL,
  changed_by_user_id BIGINT UNSIGNED NULL,
  changed_by_label VARCHAR(160) NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_campaign_phase_history_campaign_date (campaign_id, changed_at),
  CONSTRAINT fk_campaign_phase_history_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_phase_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_campaign_phase_history_direction CHECK (direction IN ('forward', 'backward')),
  CONSTRAINT chk_campaign_phase_history_previous CHECK (previous_phase IN ('receiving_orders', 'orders_closed', 'production', 'ready_for_delivery', 'completed')),
  CONSTRAINT chk_campaign_phase_history_next CHECK (next_phase IN ('receiving_orders', 'orders_closed', 'production', 'ready_for_delivery', 'completed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(24) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_whatsapp VARCHAR(20) NOT NULL,
  customer_email VARCHAR(254) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  payment_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  delivery_status VARCHAR(32) NOT NULL DEFAULT 'waiting_campaign',
  total_cents INT UNSIGNED NOT NULL,
  paid_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_orders_number (order_number),
  UNIQUE KEY uq_orders_idempotency_key (idempotency_key),
  KEY ix_orders_campaign_payment (campaign_id, payment_status),
  KEY ix_orders_customer_lookup (order_number, customer_whatsapp),
  CONSTRAINT fk_orders_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE RESTRICT,
  CONSTRAINT chk_orders_status CHECK (status IN ('active', 'cancelled')),
  CONSTRAINT chk_orders_payment_status CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  CONSTRAINT chk_orders_delivery_status CHECK (delivery_status IN ('waiting_campaign', 'ready', 'delivered', 'issue')),
  CONSTRAINT chk_orders_total CHECK (total_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  campaign_variant_id BIGINT UNSIGNED NOT NULL,
  size VARCHAR(8) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_price_cents INT UNSIGNED NOT NULL,
  line_total_cents INT UNSIGNED GENERATED ALWAYS AS (unit_price_cents * quantity) STORED,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_order_items_order (order_id),
  KEY ix_order_items_variant_size (campaign_variant_id, size),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (campaign_variant_id) REFERENCES campaign_variants (id) ON DELETE RESTRICT,
  CONSTRAINT chk_order_items_size CHECK (size IN ('PP', 'P', 'M', 'G', 'GG', 'XG')),
  CONSTRAINT chk_order_items_quantity CHECK (quantity BETWEEN 1 AND 20),
  CONSTRAINT chk_order_items_price CHECK (unit_price_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_order_id VARCHAR(190) NULL,
  provider_transaction_id VARCHAR(190) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  amount_cents INT UNSIGNED NOT NULL,
  raw_response JSON NULL,
  confirmed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payments_provider_transaction (provider, provider_transaction_id),
  KEY ix_payments_order_status (order_id, status),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  CONSTRAINT chk_payments_status CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  CONSTRAINT chk_payments_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  provider_event_id VARCHAR(190) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSON NOT NULL,
  processed_at DATETIME(3) NULL,
  processing_error VARCHAR(500) NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payment_events_provider_event (provider, provider_event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  previous_status VARCHAR(32) NOT NULL,
  next_status VARCHAR(32) NOT NULL,
  note VARCHAR(500) NULL,
  changed_by_user_id BIGINT UNSIGNED NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_delivery_history_order_date (order_id, changed_at),
  CONSTRAINT fk_delivery_history_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_delivery_history_user FOREIGN KEY (changed_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_delivery_history_previous CHECK (previous_status IN ('waiting_campaign', 'ready', 'delivered', 'issue')),
  CONSTRAINT chk_delivery_history_next CHECK (next_status IN ('waiting_campaign', 'ready', 'delivered', 'issue'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO shirt_models (code, name, sort_order) VALUES
  ('common', 'Comum', 10),
  ('oversized', 'Oversized', 20),
  ('baby_look', 'Baby Look', 30)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_order = VALUES(sort_order), active = TRUE;

INSERT INTO colors (name, hex_color) VALUES
  ('Preto', '#111315'),
  ('Branco', '#F3F3EF'),
  ('Azul Royal', '#1468B8'),
  ('Azul Marinho', '#17365D'),
  ('Bordô', '#6F1833'),
  ('Verde', '#27704B')
ON DUPLICATE KEY UPDATE hex_color = VALUES(hex_color), active = TRUE;

CREATE OR REPLACE VIEW v_production_report AS
SELECT
  c.id AS campaign_id,
  c.code AS campaign_code,
  c.title AS campaign_title,
  sm.name AS model_name,
  co.name AS color_name,
  co.hex_color,
  oi.size,
  SUM(oi.quantity) AS quantity
FROM orders o
JOIN campaigns c ON c.id = o.campaign_id
JOIN order_items oi ON oi.order_id = o.id
JOIN campaign_variants cv ON cv.id = oi.campaign_variant_id
JOIN shirt_models sm ON sm.id = cv.shirt_model_id
JOIN colors co ON co.id = cv.color_id
WHERE o.status = 'active' AND o.payment_status = 'paid'
GROUP BY c.id, c.code, c.title, sm.id, sm.name, co.id, co.name, co.hex_color, oi.size;

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
  oi.size,
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
WHERE o.status = 'active' AND o.payment_status = 'paid';

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema')
ON DUPLICATE KEY UPDATE version = VALUES(version);
