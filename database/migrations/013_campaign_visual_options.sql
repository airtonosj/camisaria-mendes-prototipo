-- Camisaria Mendes - 013: interruptores independentes de mockup e fotos reais

SET @mockup_enabled_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'mockup_enabled'
);
SET @mockup_enabled_ddl = IF(
  @mockup_enabled_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN mockup_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER art_render_mode',
  'SELECT 1'
);
PREPARE mockup_enabled_statement FROM @mockup_enabled_ddl;
EXECUTE mockup_enabled_statement;
DEALLOCATE PREPARE mockup_enabled_statement;

SET @real_photos_enabled_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'real_photos_enabled'
);
SET @real_photos_enabled_ddl = IF(
  @real_photos_enabled_exists = 0,
  'ALTER TABLE campaigns ADD COLUMN real_photos_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER mockup_enabled',
  'SELECT 1'
);
PREPARE real_photos_enabled_statement FROM @real_photos_enabled_ddl;
EXECUTE real_photos_enabled_statement;
DEALLOCATE PREPARE real_photos_enabled_statement;

UPDATE campaigns c
   SET c.real_photos_enabled = TRUE
 WHERE EXISTS (SELECT 1 FROM campaign_color_photos ccp WHERE ccp.campaign_id = c.id);

INSERT INTO schema_migrations (version) VALUES ('013_campaign_visual_options')
ON DUPLICATE KEY UPDATE version = VALUES(version);
