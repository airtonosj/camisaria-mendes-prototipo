-- Camisaria Mendes - 022: forma de pagamento confirmada pelo provedor

ALTER TABLE payments
  ADD COLUMN capture_method VARCHAR(40) NULL AFTER amount_cents;

-- Os pagamentos confirmados antes desta migração já guardavam a resposta completa.
-- Aproveitamos esse histórico sem inventar uma forma para registros que não a possuem.
UPDATE payments
   SET capture_method = LEFT(LOWER(TRIM(
         JSON_UNQUOTE(JSON_EXTRACT(raw_response, '$.payment_check.capture_method'))
       )), 40)
 WHERE capture_method IS NULL
   AND raw_response IS NOT NULL
   AND JSON_UNQUOTE(JSON_EXTRACT(raw_response, '$.payment_check.capture_method')) IS NOT NULL;

INSERT INTO schema_migrations (version) VALUES ('022_payment_capture_method')
ON DUPLICATE KEY UPDATE version = VALUES(version);
