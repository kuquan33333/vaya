-- Rate promotions must disclose the post-promotion segment before a product
-- can be used for a full-term comparison.
ALTER TABLE rate_terms ADD COLUMN post_promo_annual_rate_percent REAL;
ALTER TABLE rate_terms ADD COLUMN post_promo_monthly_rate_percent REAL;
ALTER TABLE rate_terms ADD COLUMN post_promo_basis TEXT;

CREATE INDEX IF NOT EXISTS idx_rate_terms_promo_basis
  ON rate_terms(product_id, promo_months, post_promo_basis);
