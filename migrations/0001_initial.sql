PRAGMA foreign_keys = ON;

CREATE TABLE providers (
  provider_id TEXT PRIMARY KEY,
  provider_slug TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  display_name_vi TEXT NOT NULL,
  display_name_en TEXT NOT NULL,
  display_name_zh TEXT NOT NULL,
  lender_type TEXT NOT NULL CHECK (lender_type IN ('bank', 'consumer-finance')),
  official_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'pending_verification', 'blocked')),
  source_url TEXT NOT NULL,
  observed_at TEXT,
  verified_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE products (
  product_id TEXT PRIMARY KEY,
  stable_slug TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL REFERENCES providers(provider_id),
  lender_type TEXT NOT NULL CHECK (lender_type IN ('bank', 'consumer-finance')),
  product_name_vi TEXT NOT NULL,
  product_name_en TEXT NOT NULL,
  product_name_zh TEXT NOT NULL,
  category TEXT NOT NULL,
  purpose_code TEXT NOT NULL,
  min_amount_vnd INTEGER,
  max_amount_vnd INTEGER,
  min_term_months INTEGER,
  max_term_months INTEGER,
  requirements_json TEXT NOT NULL DEFAULT '[]',
  source_url TEXT NOT NULL,
  source_document_date TEXT,
  source_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  review_flags_json TEXT NOT NULL DEFAULT '[]',
  observed_at TEXT,
  verified_at TEXT,
  legacy_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE product_terms (
  term_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  term_type TEXT NOT NULL CHECK (term_type IN ('amount', 'term', 'requirement', 'fee', 'other')),
  value_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_document_date TEXT,
  source_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  observed_at TEXT,
  verified_at TEXT,
  UNIQUE(product_id, term_id)
);

CREATE TABLE rate_terms (
  rate_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  rate_type TEXT NOT NULL CHECK (rate_type IN ('fixed', 'floating', 'promotional', 'unavailable')),
  rate_basis TEXT NOT NULL CHECK (rate_basis IN ('annual-nominal-reducing-balance', 'annual-nominal-original-principal', 'monthly-flat', 'apr', 'eir', 'unknown')),
  annual_rate_percent REAL,
  monthly_rate_percent REAL,
  promo_months INTEGER,
  valid_from TEXT,
  valid_to TEXT,
  observed_at TEXT,
  verified_at TEXT,
  source_document_date TEXT,
  source_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  review_flags_json TEXT NOT NULL DEFAULT '[]',
  CHECK (annual_rate_percent IS NULL OR annual_rate_percent >= 0),
  CHECK (monthly_rate_percent IS NULL OR monthly_rate_percent >= 0)
);

CREATE TABLE eligibility_rules (
  rule_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  rule_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_document_date TEXT,
  source_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  observed_at TEXT,
  verified_at TEXT
);

CREATE TABLE promotions (
  promotion_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  terms_json TEXT NOT NULL DEFAULT '{}',
  source_url TEXT NOT NULL,
  source_document_date TEXT,
  source_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  observed_at TEXT,
  verified_at TEXT
);

CREATE TABLE banners (
  banner_id TEXT PRIMARY KEY,
  promotion_id TEXT REFERENCES promotions(promotion_id),
  title_vi TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL,
  body_vi TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_zh TEXT NOT NULL,
  image_object_key TEXT,
  cta_label_vi TEXT NOT NULL DEFAULT 'Đăng ký vay ngay',
  cta_label_en TEXT NOT NULL DEFAULT 'Apply for advice',
  cta_label_zh TEXT NOT NULL DEFAULT '立即登记咨询',
  valid_from TEXT,
  valid_to TEXT,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  source_url TEXT,
  source_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE data_sources (
  source_id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(provider_id),
  source_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('html', 'json', 'pdf', 'manual')),
  robots_status TEXT NOT NULL CHECK (robots_status IN ('allowed', 'disallowed', 'unknown')),
  terms_status TEXT NOT NULL CHECK (terms_status IN ('allowed', 'restricted', 'unknown')),
  crawl_enabled INTEGER NOT NULL DEFAULT 0 CHECK (crawl_enabled IN (0, 1)),
  user_agent TEXT,
  last_success_at TEXT,
  last_failure_at TEXT,
  stale_after_hours INTEGER NOT NULL DEFAULT 72,
  notes TEXT
);

CREATE TABLE crawl_runs (
  run_id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cron', 'manual', 'github')),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'partial', 'failed')),
  source_count INTEGER NOT NULL DEFAULT 0,
  update_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

CREATE TABLE crawl_observations (
  observation_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES crawl_runs(run_id),
  source_id TEXT NOT NULL REFERENCES data_sources(source_id),
  fetched_at TEXT NOT NULL,
  http_status INTEGER,
  etag TEXT,
  last_modified TEXT,
  content_hash TEXT,
  parser_version TEXT NOT NULL,
  extracted_json TEXT NOT NULL DEFAULT '{}',
  validation_status TEXT NOT NULL CHECK (validation_status IN ('valid', 'invalid', 'blocked', 'stale', 'anomaly')),
  error_message TEXT
);

CREATE TABLE review_queue (
  review_id TEXT PRIMARY KEY,
  observation_id TEXT REFERENCES crawl_observations(observation_id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'rate', 'promotion', 'banner', 'source')),
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rate_history (
  snapshot_id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(product_id),
  rate_id TEXT REFERENCES rate_terms(rate_id),
  annual_rate_percent REAL,
  monthly_rate_percent REAL,
  rate_basis TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  UNIQUE(product_id, rate_id, observed_at, source_hash)
);

CREATE TABLE leads (
  lead_id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  province TEXT NOT NULL,
  product_id TEXT REFERENCES products(product_id),
  provider_id TEXT REFERENCES providers(provider_id),
  loan_type TEXT,
  amount_vnd INTEGER,
  term_months INTEGER,
  note TEXT,
  source TEXT NOT NULL,
  campaign TEXT,
  status TEXT NOT NULL CHECK (status IN ('new', 'contacted', 'pending', 'closed', 'deleted')) DEFAULT 'new',
  idempotency_key TEXT NOT NULL UNIQUE,
  phone_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE lead_documents (
  document_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(lead_id),
  side TEXT NOT NULL CHECK (side IN ('front', 'back')),
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('authorized', 'uploaded', 'quarantined', 'deleted')) DEFAULT 'authorized',
  expires_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lead_id, side)
);

CREATE TABLE consent_records (
  consent_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(lead_id),
  consent_type TEXT NOT NULL CHECK (consent_type IN ('contact', 'processing_notice', 'document_upload', 'telegram_notification')),
  policy_version TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  ip_hash TEXT,
  user_agent_hash TEXT,
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE notification_outbox (
  notification_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(lead_id),
  channel TEXT NOT NULL CHECK (channel IN ('telegram')),
  payload_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')) DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_events (
  event_id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('system', 'staff', 'customer', 'crawler', 'github')),
  actor_id_hash TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE chat_sessions (
  session_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL DEFAULT '{}',
  history_json TEXT NOT NULL DEFAULT '[]',
  offer_context_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX idx_products_public ON products(status, provider_id, category, stable_slug);
CREATE INDEX idx_rate_terms_product_status ON rate_terms(product_id, status, valid_to);
CREATE INDEX idx_promotions_active ON promotions(status, valid_from, valid_to);
CREATE INDEX idx_crawl_observations_source ON crawl_observations(source_id, fetched_at);
CREATE INDEX idx_review_queue_pending ON review_queue(status, created_at);
CREATE INDEX idx_rate_history_product_observed ON rate_history(product_id, observed_at);
CREATE INDEX idx_leads_status_created ON leads(status, created_at);
CREATE INDEX idx_documents_lead_status ON lead_documents(lead_id, status);
CREATE INDEX idx_outbox_pending ON notification_outbox(status, next_attempt_at);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id, created_at);
