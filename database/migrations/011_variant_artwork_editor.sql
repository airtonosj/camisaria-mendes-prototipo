-- Camisaria Mendes - 011: editor de arte e mockups por variante
--
-- Os campos em campaigns continuam sendo a arte-base e o fallback das campanhas
-- antigas. A nova tabela guarda apenas configuracoes especificas de corte/cor.

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_front_x');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_front_x DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER art_render_mode', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_front_y');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_front_y DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER art_front_x', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_front_scale');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_front_scale DECIMAL(7,4) NOT NULL DEFAULT 1 AFTER art_front_y', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_front_rotation');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_front_rotation DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER art_front_scale', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_back_x');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_back_x DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER art_front_rotation', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_back_y');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_back_y DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER art_back_x', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_back_scale');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_back_scale DECIMAL(7,4) NOT NULL DEFAULT 1 AFTER art_back_y', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'art_back_rotation');
SET @column_ddl = IF(@column_exists = 0, 'ALTER TABLE campaigns ADD COLUMN art_back_rotation DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER art_back_scale', 'SELECT 1');
PREPARE column_statement FROM @column_ddl; EXECUTE column_statement; DEALLOCATE PREPARE column_statement;

CREATE TABLE IF NOT EXISTS campaign_variant_artworks (
  campaign_variant_id BIGINT UNSIGNED NOT NULL,
  artwork_mode VARCHAR(24) NOT NULL,
  front_source VARCHAR(16) NOT NULL DEFAULT 'inherit',
  front_url VARCHAR(2048) NULL,
  front_transform_override BOOLEAN NOT NULL DEFAULT FALSE,
  front_x DECIMAL(7,3) NOT NULL DEFAULT 0,
  front_y DECIMAL(7,3) NOT NULL DEFAULT 0,
  front_scale DECIMAL(7,4) NOT NULL DEFAULT 1,
  front_rotation DECIMAL(7,3) NOT NULL DEFAULT 0,
  back_source VARCHAR(16) NOT NULL DEFAULT 'inherit',
  back_url VARCHAR(2048) NULL,
  back_transform_override BOOLEAN NOT NULL DEFAULT FALSE,
  back_x DECIMAL(7,3) NOT NULL DEFAULT 0,
  back_y DECIMAL(7,3) NOT NULL DEFAULT 0,
  back_scale DECIMAL(7,4) NOT NULL DEFAULT 1,
  back_rotation DECIMAL(7,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (campaign_variant_id, artwork_mode),
  CONSTRAINT fk_campaign_variant_artworks_variant
    FOREIGN KEY (campaign_variant_id) REFERENCES campaign_variants (id) ON DELETE CASCADE
);

INSERT INTO schema_migrations (version) VALUES ('011_variant_artwork_editor')
ON DUPLICATE KEY UPDATE version = VALUES(version);
