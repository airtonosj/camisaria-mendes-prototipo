-- Camisaria Mendes - 020: WhatsApp gravado no formato canônico
--
-- A API passou a gravar e a consultar o WhatsApp sempre da mesma forma: somente dígitos,
-- com o código do país (5598988887777). As linhas antigas guardam o número exatamente
-- como o cliente digitou, então o mesmo telefone virava duas chaves diferentes: quem
-- pediu digitando só o DDD deixaria de encontrar o próprio pedido nas telas de pagamento
-- e de acompanhamento, e o checkout enviava ao provedor um número inexistente.
--
-- As duas etapas são idempotentes. Primeiro caem quaisquer caracteres que não sejam
-- dígitos; depois o 55 entra apenas onde o número tem 10 dígitos (DDD + fixo) ou 11
-- (DDD + celular). Depois de rodar, os números têm 12 ou 13 dígitos e não voltam a
-- entrar na condição, então reaplicar a migração não prefixa duas vezes.

UPDATE orders
   SET customer_whatsapp = REGEXP_REPLACE(customer_whatsapp, '[^0-9]', '')
 WHERE customer_whatsapp REGEXP '[^0-9]';

UPDATE orders
   SET customer_whatsapp = CONCAT('55', customer_whatsapp)
 WHERE customer_whatsapp REGEXP '^[0-9]{10,11}$';

UPDATE campaigns
   SET representative_whatsapp = REGEXP_REPLACE(representative_whatsapp, '[^0-9]', '')
 WHERE representative_whatsapp REGEXP '[^0-9]';

UPDATE campaigns
   SET representative_whatsapp = CONCAT('55', representative_whatsapp)
 WHERE representative_whatsapp REGEXP '^[0-9]{10,11}$';

INSERT INTO schema_migrations (version) VALUES ('020_whatsapp_country_code')
ON DUPLICATE KEY UPDATE version = VALUES(version);
