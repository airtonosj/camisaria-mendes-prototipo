-- Camisaria Mendes - 004: conta da equipe e recuperação de senha
--
-- O cadastro inicial da camisaria nasce com uma senha provisória. `must_change_password`
-- obriga a troca no primeiro acesso, para a senha de fábrica não sobreviver à publicação.
--
-- O token de recuperação segue a mesma regra da sessão: o banco guarda só o SHA-256,
-- então vazar esta tabela não permite redefinir a senha de ninguém.

ALTER TABLE users
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER active;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  requested_from VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_password_reset_tokens_token (token_hash),
  KEY ix_password_reset_tokens_user (user_id),
  KEY ix_password_reset_tokens_expires (expires_at),
  CONSTRAINT fk_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('004_account_and_password_reset')
ON DUPLICATE KEY UPDATE version = VALUES(version);
