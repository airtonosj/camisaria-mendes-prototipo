SET @campaign_public_ddl := IF(EXISTS (
  SELECT 1 FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'is_public'
), 'DO 0', 'ALTER TABLE campaigns ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE AFTER phase');
PREPARE campaign_public_statement FROM @campaign_public_ddl;
EXECUTE campaign_public_statement;
DEALLOCATE PREPARE campaign_public_statement;

SET @campaign_public_ddl := IF(EXISTS (
  SELECT 1 FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND INDEX_NAME = 'ix_campaigns_public_phase_deadline'
), 'DO 0', 'CREATE INDEX ix_campaigns_public_phase_deadline ON campaigns (is_public, phase, deadline_at)');
PREPARE campaign_public_statement FROM @campaign_public_ddl;
EXECUTE campaign_public_statement;
DEALLOCATE PREPARE campaign_public_statement;
