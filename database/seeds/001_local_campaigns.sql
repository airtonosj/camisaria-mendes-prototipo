-- Campanhas locais para desenvolvimento. Não cria pedidos nem pagamentos.

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

INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents)
SELECT c.id, sm.id, co.id,
  CASE sm.code WHEN 'common' THEN 5990 WHEN 'oversized' THEN 6990 ELSE 6290 END
FROM campaigns c
JOIN shirt_models sm ON sm.code IN ('common', 'oversized', 'baby_look')
JOIN colors co ON
  (sm.code = 'common' AND co.name IN ('Preto', 'Branco', 'Azul Marinho')) OR
  (sm.code = 'oversized' AND co.name IN ('Branco', 'Preto', 'Azul Royal')) OR
  (sm.code = 'baby_look' AND co.name IN ('Azul Royal', 'Preto', 'Bordô'))
WHERE c.code = 'MENDES-ENG-26'
ON DUPLICATE KEY UPDATE unit_price_cents = VALUES(unit_price_cents), active = TRUE;

INSERT INTO campaign_variants (campaign_id, shirt_model_id, color_id, unit_price_cents)
SELECT c.id, sm.id, co.id,
  CASE sm.code WHEN 'common' THEN 5990 WHEN 'oversized' THEN 6990 ELSE 6290 END
FROM campaigns c
JOIN shirt_models sm ON sm.code IN ('common', 'oversized', 'baby_look')
JOIN colors co ON
  (sm.code = 'common' AND co.name IN ('Preto', 'Branco', 'Azul Royal', 'Azul Marinho')) OR
  (sm.code = 'oversized' AND co.name IN ('Preto', 'Branco', 'Azul Royal')) OR
  (sm.code = 'baby_look' AND co.name IN ('Preto', 'Branco', 'Azul Royal', 'Bordô'))
WHERE c.code = 'MENDES-ADS-26'
ON DUPLICATE KEY UPDATE unit_price_cents = VALUES(unit_price_cents), active = TRUE;
