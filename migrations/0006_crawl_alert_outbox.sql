-- Operational alerts for source changes/anomalies. This is separate from the
-- lead notification outbox because a crawler alert has no lead_id and must not
-- be forced into customer data tables.
CREATE TABLE IF NOT EXISTS crawl_alert_outbox (
  alert_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES crawl_runs(run_id),
  source_id TEXT NOT NULL REFERENCES data_sources(source_id),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')) DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crawl_alert_pending
  ON crawl_alert_outbox(status, next_attempt_at, created_at);
