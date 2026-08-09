-- Campanhas locais para desenvolvimento. Não cria pedidos nem pagamentos.
-- A arte fica nula de propósito: o front-end cai na imagem de catálogo enquanto
-- a camisaria não envia o arquivo da campanha pelo painel.

INSERT INTO campaigns
  (code, title, subtitle, phase, deadline_at, pickup_instructions, representative_name, representative_whatsapp)
VALUES
  ('MENDES-ENG-26', 'Engenharia Civil — Turma 2026', 'Campanha exclusiva para os alunos da turma', 'receiving_orders', '2026-12-31 23:59:59.000', 'Retirada com o representante da turma', 'Lucas Pereira', '5598999990001'),
  ('MENDES-ADS-26', 'Análise e Desenvolvimento de Sistemas — 2026.2', 'Campanha exclusiva para os alunos da turma', 'receiving_orders', '2026-12-31 23:59:59.000', 'Retirada com o representante da turma', 'Carla Sousa', '5598999990002')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  deadline_at = VALUES(deadline_at),
  pickup_instructions = VALUES(pickup_instructions),
  representative_name = VALUES(representative_name),
  representative_whatsapp = VALUES(representative_whatsapp);

-- Variantes: corte x cor. O preço é do corte e vale para todos os tamanhos dele.
INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents)
SELECT c.id, sm.id, co.id,
  CASE sm.code WHEN 'common' THEN 5990 ELSE 6990 END
FROM campaigns c
JOIN shirt_models sm ON sm.active = TRUE AND sm.code IN ('common', 'oversized')
JOIN colors co ON
  (sm.code = 'common' AND co.name IN ('Preto', 'Branco', 'Azul')) OR
  (sm.code = 'oversized' AND co.name IN ('Branco', 'Preto', 'Azul'))
WHERE c.code = 'MENDES-ENG-26'
ON DUPLICATE KEY UPDATE unit_price_cents = VALUES(unit_price_cents), active = TRUE;

INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents)
SELECT c.id, sm.id, co.id,
  CASE sm.code WHEN 'common' THEN 5990 ELSE 6990 END
FROM campaigns c
JOIN shirt_models sm ON sm.active = TRUE AND sm.code IN ('common', 'oversized')
JOIN colors co ON
  (sm.code = 'common' AND co.name IN ('Preto', 'Branco', 'Off-white', 'Azul', 'Bordô')) OR
  (sm.code = 'oversized' AND co.name IN ('Preto', 'Branco', 'Off-white', 'Azul', 'Bordô'))
WHERE c.code = 'MENDES-ADS-26'
ON DUPLICATE KEY UPDATE unit_price_cents = VALUES(unit_price_cents), active = TRUE;

-- Tamanhos liberados: o corte Comum recebe tradicional e baby look; o Oversized
-- fica só com os tamanhos tradicionais.
INSERT INTO campaign_model_sizes (campaign_id, shirt_model_id, size_id)
SELECT c.id, sm.id, sz.id
FROM campaigns c
JOIN shirt_models sm ON sm.active = TRUE AND sm.code IN ('common', 'oversized')
JOIN sizes sz ON sz.active = TRUE AND (
  sm.code = 'common' OR (sm.code = 'oversized' AND sz.size_group = 'standard')
)
WHERE c.code IN ('MENDES-ENG-26', 'MENDES-ADS-26')
ON DUPLICATE KEY UPDATE size_id = VALUES(size_id);
