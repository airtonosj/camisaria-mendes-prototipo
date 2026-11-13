CREATE TABLE IF NOT EXISTS campaign_variant_stock (
  campaign_variant_id BIGINT UNSIGNED NOT NULL,
  size_code VARCHAR(8) NOT NULL,
  stock_limit INT UNSIGNED NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (campaign_variant_id, size_code),
  CONSTRAINT fk_campaign_variant_stock_variant FOREIGN KEY (campaign_variant_id) REFERENCES campaign_variants (id) ON DELETE CASCADE,
  CONSTRAINT chk_campaign_variant_stock_size CHECK (size_code IN ('PP', 'P', 'M', 'G', 'GG', 'XG', 'EXGG', 'PB', 'MB', 'GB')),
  CONSTRAINT chk_campaign_variant_stock_limit CHECK (stock_limit > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
