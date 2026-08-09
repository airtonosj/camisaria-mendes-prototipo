-- Paleta padrão enxuta. As cores antigas permanecem para não alterar campanhas e pedidos já existentes.
INSERT INTO colors (name, hex_color, active) VALUES
  ('Branco', '#F3F3EF', TRUE),
  ('Preto', '#111315', TRUE),
  ('Off-white', '#E8E1D4', TRUE),
  ('Azul', '#1468B8', TRUE),
  ('Bordô', '#6F1833', TRUE)
ON DUPLICATE KEY UPDATE hex_color = VALUES(hex_color), active = TRUE;
