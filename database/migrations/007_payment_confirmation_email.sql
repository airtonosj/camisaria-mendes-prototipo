-- Camisaria Mendes - 007: fila de e-mail após confirmação do pagamento
--
-- A confirmação do pagamento e o agendamento do aviso precisam pertencer à mesma
-- transação. O trigger cobre tanto o webhook futuro quanto qualquer rotina de
-- reconciliação que faça a transição legítima de orders.payment_status para paid.
-- A chave única impede que reprocessamentos do provedor criem mensagens duplicadas.

CREATE TABLE IF NOT EXISTS order_email_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  notification_type VARCHAR(40) NOT NULL,
  recipient_email VARCHAR(254) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_at DATETIME(3) NULL,
  sent_at DATETIME(3) NULL,
  last_error VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_order_email_notification (order_id, notification_type),
  KEY ix_order_email_notifications_delivery (status, available_at),
  CONSTRAINT fk_order_email_notifications_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT chk_order_email_notifications_type CHECK (notification_type IN ('payment_confirmed')),
  CONSTRAINT chk_order_email_notifications_status CHECK (status IN ('pending', 'sending', 'sent', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS trg_orders_payment_confirmation_email;

CREATE TRIGGER trg_orders_payment_confirmation_email
AFTER UPDATE ON orders
FOR EACH ROW
  INSERT INTO order_email_notifications (order_id, notification_type, recipient_email)
  SELECT NEW.id, 'payment_confirmed', NEW.customer_email
    FROM DUAL
   WHERE OLD.payment_status <> 'paid'
     AND NEW.payment_status = 'paid'
     AND NEW.customer_email IS NOT NULL
     AND NEW.customer_email <> ''
  ON DUPLICATE KEY UPDATE recipient_email = NEW.customer_email;

INSERT INTO schema_migrations (version) VALUES ('007_payment_confirmation_email')
ON DUPLICATE KEY UPDATE version = VALUES(version);
