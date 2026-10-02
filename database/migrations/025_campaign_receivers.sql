-- Camisaria Mendes - 025: recebedores de pagamento por campanha
--
-- Um recebedor é só uma conta InfinitePay de destino; não entra no painel e por
-- isso não fica em users. Campanha sem recebedor usa a conta padrão do servidor.
-- O handle usado em cada link fica gravado no checkout: a conferência do pagamento
-- consulta a mesma conta que emitiu o link, mesmo que o recebedor mude depois.

CREATE TABLE IF NOT EXISTS payment_receivers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NULL,
  phone VARCHAR(20) NULL,
  infinitepay_handle VARCHAR(64) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payment_receivers_handle (infinitepay_handle),
  CONSTRAINT fk_payment_receivers_created_by FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- As colunas só são criadas se ainda faltarem: a migração pode ser repetida com
-- segurança se uma inicialização anterior tiver parado depois do DDL.
SET @campaign_receiver_ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'receiver_id'),
  'DO 0',
  'ALTER TABLE campaigns
     ADD COLUMN receiver_id BIGINT UNSIGNED NULL,
     ADD KEY ix_campaigns_receiver (receiver_id),
     ADD CONSTRAINT fk_campaigns_receiver FOREIGN KEY (receiver_id) REFERENCES payment_receivers (id) ON DELETE RESTRICT'
);
PREPARE campaign_receiver_statement FROM @campaign_receiver_ddl;
EXECUTE campaign_receiver_statement;
DEALLOCATE PREPARE campaign_receiver_statement;

SET @checkout_handle_ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_checkouts' AND COLUMN_NAME = 'handle'),
  'DO 0',
  'ALTER TABLE payment_checkouts ADD COLUMN handle VARCHAR(64) NULL AFTER provider'
);
PREPARE checkout_handle_statement FROM @checkout_handle_ddl;
EXECUTE checkout_handle_statement;
DEALLOCATE PREPARE checkout_handle_statement;

INSERT INTO schema_migrations (version) VALUES ('025_campaign_receivers')
ON DUPLICATE KEY UPDATE version = VALUES(version);
