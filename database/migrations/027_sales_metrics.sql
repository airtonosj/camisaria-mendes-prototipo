-- Funil anônimo por campanha. Não guarda IP, nome, telefone, e-mail nem itens do pedido.
SET @metrics_ddl := IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'analytics_source'), 'DO 0', 'ALTER TABLE orders ADD COLUMN analytics_source VARCHAR(48) NULL');
PREPARE metrics_statement FROM @metrics_ddl;
EXECUTE metrics_statement;
DEALLOCATE PREPARE metrics_statement;

CREATE TABLE IF NOT EXISTS campaign_metric_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NOT NULL,
  anonymous_session_id CHAR(36) NOT NULL,
  event_name VARCHAR(32) NOT NULL,
  source VARCHAR(48) NOT NULL DEFAULT 'direct',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY ix_campaign_metric_events_report (campaign_id, created_at, event_name),
  KEY ix_campaign_metric_events_source (source, created_at),
  CONSTRAINT fk_campaign_metric_events_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT chk_campaign_metric_event_name CHECK (event_name IN ('campaign_view', 'cart_add', 'order_review', 'checkout_open'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('027_sales_metrics') ON DUPLICATE KEY UPDATE version = VALUES(version);
