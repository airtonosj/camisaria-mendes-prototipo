-- Campos opcionais. Sem preenchimento retroativo: pedidos antigos não ganham
-- uma previsão de compra inventada. Cada DDL pode ser repetido após interrupção.
SET @delivery_ddl := IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'delivery_expected_on'), 'DO 0', 'ALTER TABLE campaigns ADD COLUMN delivery_expected_on DATE NULL');
PREPARE delivery_statement FROM @delivery_ddl;
EXECUTE delivery_statement;
DEALLOCATE PREPARE delivery_statement;
SET @delivery_ddl := IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaigns' AND COLUMN_NAME = 'delivery_note'), 'DO 0', 'ALTER TABLE campaigns ADD COLUMN delivery_note VARCHAR(255) NULL');
PREPARE delivery_statement FROM @delivery_ddl;
EXECUTE delivery_statement;
DEALLOCATE PREPARE delivery_statement;
SET @delivery_ddl := IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_expected_on'), 'DO 0', 'ALTER TABLE orders ADD COLUMN delivery_expected_on DATE NULL');
PREPARE delivery_statement FROM @delivery_ddl;
EXECUTE delivery_statement;
DEALLOCATE PREPARE delivery_statement;
SET @delivery_ddl := IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_note'), 'DO 0', 'ALTER TABLE orders ADD COLUMN delivery_note VARCHAR(255) NULL');
PREPARE delivery_statement FROM @delivery_ddl;
EXECUTE delivery_statement;
DEALLOCATE PREPARE delivery_statement;
SET @delivery_ddl := IF(EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'delivery_forecast_recorded'), 'DO 0', 'ALTER TABLE orders ADD COLUMN delivery_forecast_recorded BOOLEAN NOT NULL DEFAULT FALSE');
PREPARE delivery_statement FROM @delivery_ddl;
EXECUTE delivery_statement;
DEALLOCATE PREPARE delivery_statement;
INSERT INTO schema_migrations (version) VALUES ('026_campaign_delivery') ON DUPLICATE KEY UPDATE version = VALUES(version);
