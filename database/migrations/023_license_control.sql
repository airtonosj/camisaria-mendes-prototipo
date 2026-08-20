-- Camisaria Mendes - 023: suspensão contratual reversível por comando assinado

CREATE TABLE IF NOT EXISTS license_state (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  installation_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  reason VARCHAR(240) NULL,
  command_id CHAR(36) NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT chk_license_state_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS license_state_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  installation_id VARCHAR(64) NOT NULL,
  command_id CHAR(36) NOT NULL,
  action ENUM('suspend', 'activate') NOT NULL,
  previous_status ENUM('active', 'suspended') NOT NULL,
  next_status ENUM('active', 'suspended') NOT NULL,
  reason VARCHAR(240) NOT NULL,
  issued_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_license_state_history_command (command_id),
  KEY ix_license_state_history_installation_date (installation_id, applied_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

