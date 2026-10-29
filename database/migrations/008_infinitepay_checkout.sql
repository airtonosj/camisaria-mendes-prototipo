-- Camisaria Mendes - 008: checkout e reconciliacao InfinitePay

CREATE TABLE IF NOT EXISTS payment_checkouts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL,
  checkout_url VARCHAR(2048) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  amount_cents INT UNSIGNED NOT NULL,
  raw_response JSON NULL,
  locked_at DATETIME(3) NULL,
  last_error VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payment_checkouts_order_provider (order_id, provider),
  KEY ix_payment_checkouts_status_updated (status, updated_at),
  CONSTRAINT fk_payment_checkouts_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  CONSTRAINT chk_payment_checkouts_status CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  CONSTRAINT chk_payment_checkouts_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payment_events
  ADD COLUMN attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER payload,
  ADD COLUMN available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER attempts,
  ADD COLUMN locked_at DATETIME(3) NULL AFTER available_at,
  ADD KEY ix_payment_events_queue (processed_at, available_at, locked_at);

INSERT INTO schema_migrations (version) VALUES ('008_infinitepay_checkout')
ON DUPLICATE KEY UPDATE version = VALUES(version);
