-- Camisaria Mendes - 003: sessões da equipe
--
-- Substitui a chave administrativa única no navegador por login com sessão.
-- O token vive apenas no cliente; o banco guarda somente o SHA-256 dele, então
-- vazar esta tabela não permite reusar as sessões.

CREATE TABLE IF NOT EXISTS staff_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_staff_sessions_token (token_hash),
  KEY ix_staff_sessions_user (user_id),
  KEY ix_staff_sessions_expires (expires_at),
  CONSTRAINT fk_staff_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Colunas históricas criadas no piloto inicial. A rota de confirmação manual foi removida;
-- pagamentos novos serão confirmados exclusivamente pela integração do provedor.
ALTER TABLE payments
  ADD COLUMN confirmed_by_user_id BIGINT UNSIGNED NULL AFTER raw_response,
  ADD COLUMN note VARCHAR(500) NULL AFTER confirmed_by_user_id,
  ADD CONSTRAINT fk_payments_confirmed_by FOREIGN KEY (confirmed_by_user_id) REFERENCES users (id) ON DELETE SET NULL;

INSERT INTO schema_migrations (version) VALUES ('003_staff_sessions')
ON DUPLICATE KEY UPDATE version = VALUES(version);
