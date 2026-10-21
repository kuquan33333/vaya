-- Durable, source-backed RAG chunks. Public AI reads only rows explicitly
-- marked verified by a reviewer; crawler observations never become prompt
-- context automatically.
CREATE TABLE IF NOT EXISTS policy_chunks (
  chunk_id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES providers(provider_id),
  product_id TEXT REFERENCES products(product_id),
  bank TEXT NOT NULL,
  section TEXT NOT NULL,
  text TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_document_date TEXT,
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('verified', 'sample', 'quarantine', 'blocked', 'expired')),
  observed_at TEXT NOT NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_hash, section)
);

CREATE INDEX IF NOT EXISTS idx_policy_chunks_public
  ON policy_chunks(status, provider_id, product_id, observed_at);
