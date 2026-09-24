ALTER TABLE campaigns ADD COLUMN pickup_group_url VARCHAR(512) NULL;

CREATE TABLE pickup_email_batches (
  id CHAR(36) PRIMARY KEY,
  campaign_id BIGINT UNSIGNED NOT NULL,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  confirmed_at DATETIME(3) NULL,
  KEY ix_pickup_campaign (campaign_id, created_at),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (created_by_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE order_email_notifications
  DROP CHECK chk_order_email_notifications_type,
  DROP CHECK chk_order_email_notifications_status,
  ADD COLUMN pickup_batch_id CHAR(36) NULL,
  ADD COLUMN message_snapshot JSON NULL,
  ADD CONSTRAINT fk_pickup_batch FOREIGN KEY (pickup_batch_id) REFERENCES pickup_email_batches(id),
  ADD CONSTRAINT chk_order_email_notifications_type CHECK (notification_type IN ('payment_confirmed', 'pickup_ready')),
  ADD CONSTRAINT chk_order_email_notifications_status CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled', 'uncertain'));

INSERT INTO schema_migrations (version) VALUES ('024_pickup_email')
ON DUPLICATE KEY UPDATE version = VALUES(version);
