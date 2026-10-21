-- CCCD bytes are sent directly to Telegram and are never stored in D1 or an
-- object store. D1 keeps only delivery metadata and audit-related hashes.
PRAGMA foreign_keys = OFF;

CREATE TABLE lead_documents_v8 (
  document_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(lead_id),
  side TEXT NOT NULL CHECK (side IN ('front', 'back')),
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'deleted')) DEFAULT 'pending',
  telegram_message_id INTEGER,
  telegram_file_id TEXT,
  telegram_sent_at TEXT,
  error_message TEXT,
  expires_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lead_id, side)
);

INSERT INTO lead_documents_v8
  (document_id, lead_id, side, content_type, byte_size, sha256, status,
   error_message, expires_at, deleted_at, created_at)
SELECT document_id, lead_id, side, content_type, byte_size, sha256,
       CASE WHEN status = 'deleted' THEN 'deleted' ELSE 'failed' END,
       CASE WHEN status = 'deleted' THEN NULL ELSE 'legacy_r2_record_removed' END,
       expires_at, deleted_at, created_at
FROM lead_documents;

DROP TABLE lead_documents;
ALTER TABLE lead_documents_v8 RENAME TO lead_documents;
CREATE INDEX idx_documents_lead_status ON lead_documents(lead_id, status);

CREATE TABLE consent_records_v8 (
  consent_id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(lead_id),
  consent_type TEXT NOT NULL CHECK (consent_type IN ('contact', 'processing_notice', 'document_upload', 'telegram_notification', 'telegram_document')),
  policy_version TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  ip_hash TEXT,
  user_agent_hash TEXT,
  granted_at TEXT NOT NULL,
  revoked_at TEXT
);

INSERT INTO consent_records_v8
  (consent_id, lead_id, consent_type, policy_version, granted,
   ip_hash, user_agent_hash, granted_at, revoked_at)
SELECT consent_id, lead_id, consent_type, policy_version, granted,
       ip_hash, user_agent_hash, granted_at, revoked_at
FROM consent_records;

DROP TABLE consent_records;
ALTER TABLE consent_records_v8 RENAME TO consent_records;

PRAGMA foreign_keys = ON;
