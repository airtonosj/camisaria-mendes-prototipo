-- Camisaria Mendes - 010: arte transparente composta sobre mockups recoloriveis
--
-- Campanhas anteriores guardam a foto/mockup completo e continuam no modo legado.
-- Novas campanhas enviam somente a arte transparente, aplicada pelo frontend sobre
-- o corte e a cor selecionados pelo cliente.

SET @art_render_mode_exists = (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'campaigns'
     AND COLUMN_NAME = 'art_render_mode'
);
SET @art_render_mode_ddl = IF(
  @art_render_mode_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN art_render_mode VARCHAR(24) NOT NULL DEFAULT ''legacy_mockup'' AFTER art_back_url',
  'SELECT 1'
);
PREPARE art_render_mode_statement FROM @art_render_mode_ddl;
EXECUTE art_render_mode_statement;
DEALLOCATE PREPARE art_render_mode_statement;

INSERT INTO schema_migrations (version) VALUES ('010_campaign_art_compositor')
ON DUPLICATE KEY UPDATE version = VALUES(version);
