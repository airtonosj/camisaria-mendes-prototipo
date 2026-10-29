-- Camisaria Mendes - 009: registro auditavel de reembolsos
--
-- O Checkout Integrado documenta criacao de link, webhook e payment_check, mas nao
-- publica um endpoint de estorno. O estorno continua sendo executado na conta
-- InfinitePay e esta tabela registra a comprovacao operacional antes de tirar o
-- pedido pago da producao.

CREATE TABLE IF NOT EXISTS order_refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL,
  provider_refund_id VARCHAR(190) NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  reason VARCHAR(500) NOT NULL,
  receipt_url VARCHAR(2048) NULL,
  refunded_at DATETIME(3) NOT NULL,
  recorded_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_order_refunds_provider_reference (provider, provider_refund_id),
  KEY ix_order_refunds_order_date (order_id, refunded_at),
  CONSTRAINT fk_order_refunds_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_refunds_payment FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_refunds_user FOREIGN KEY (recorded_by_user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_order_refunds_amount CHECK (amount_cents > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('009_order_refunds')
ON DUPLICATE KEY UPDATE version = VALUES(version);
