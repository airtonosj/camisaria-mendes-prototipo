-- Camisaria Mendes - 014: grades comerciais por corte
--
-- EXGG passa a integrar a grade Tradicional. Os códigos antigos permanecem no
-- catálogo do banco para preservar pedidos históricos, mas a aplicação não os
-- oferece em campanhas novas.

INSERT INTO sizes (code, name, size_group, sort_order, active) VALUES
  ('EXGG', 'EXGG', 'standard', 60, TRUE)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), size_group = VALUES(size_group), sort_order = VALUES(sort_order), active = TRUE;

UPDATE sizes SET sort_order = 70 WHERE code = 'XG';

INSERT INTO schema_migrations (version) VALUES ('014_campaign_size_grades')
ON DUPLICATE KEY UPDATE version = VALUES(version);
