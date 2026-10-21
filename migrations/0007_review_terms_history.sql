-- Product terms and historical rate snapshots are source-backed facts too.
-- Keep them in the same explicit review queue instead of importing them into
-- public/readable tables before a reviewer has approved the source.
PRAGMA foreign_keys = OFF;

CREATE TABLE review_queue_v7 (
  review_id TEXT PRIMARY KEY,
  observation_id TEXT REFERENCES crawl_observations(observation_id),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'rate', 'promotion', 'banner', 'source', 'product_term', 'rate_history')),
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO review_queue_v7
  (review_id, observation_id, entity_type, entity_id, reason, payload_json,
   status, reviewed_by, reviewed_at, created_at)
SELECT review_id, observation_id, entity_type, entity_id, reason, payload_json,
       status, reviewed_by, reviewed_at, created_at
FROM review_queue;

DROP TABLE review_queue;
ALTER TABLE review_queue_v7 RENAME TO review_queue;

CREATE INDEX idx_review_queue_pending
  ON review_queue(status, created_at);

PRAGMA foreign_keys = ON;
