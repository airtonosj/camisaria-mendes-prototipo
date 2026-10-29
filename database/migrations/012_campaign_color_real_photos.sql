-- Camisaria Mendes - 012: galeria opcional de fotos reais por cor
--
-- A foto pertence a campanha + cor, nao ao corte. Assim a mesma galeria atende
-- Comum e Oversized e continua preservada quando uma variante e desativada.

CREATE TABLE IF NOT EXISTS campaign_color_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  color_id SMALLINT UNSIGNED NOT NULL,
  photo_url VARCHAR(2048) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_color_photo_position (campaign_id, color_id, sort_order),
  KEY idx_campaign_color_photos_color (color_id),
  CONSTRAINT fk_campaign_color_photos_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_color_photos_color
    FOREIGN KEY (color_id) REFERENCES colors (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('012_campaign_color_real_photos')
ON DUPLICATE KEY UPDATE version = VALUES(version);
