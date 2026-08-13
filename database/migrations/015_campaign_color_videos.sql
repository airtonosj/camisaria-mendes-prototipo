-- Camisaria Mendes - 015: video opcional por campanha e cor
--
-- Estrutura aditiva e independente da galeria de fotos. A restricao unica mantem
-- no maximo um video por cor e o ON DELETE CASCADE cuida apenas da exclusao da campanha.

CREATE TABLE IF NOT EXISTS campaign_color_videos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campaign_id BIGINT UNSIGNED NOT NULL,
  color_id SMALLINT UNSIGNED NOT NULL,
  video_url VARCHAR(2048) NOT NULL,
  poster_url VARCHAR(2048) NULL,
  duration_seconds DECIMAL(6,3) NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_color_video (campaign_id, color_id),
  KEY idx_campaign_color_videos_color (color_id),
  CONSTRAINT fk_campaign_color_videos_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns (id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_color_videos_color
    FOREIGN KEY (color_id) REFERENCES colors (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO schema_migrations (version) VALUES ('015_campaign_color_videos')
ON DUPLICATE KEY UPDATE version = VALUES(version);
