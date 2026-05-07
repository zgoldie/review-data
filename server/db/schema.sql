CREATE TABLE IF NOT EXISTS raw_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  app_version_id TEXT NOT NULL,
  old_state TEXT,
  new_state TEXT NOT NULL,
  event_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_raw_events_user_time
  ON raw_events(user_id, event_timestamp);

CREATE INDEX IF NOT EXISTS idx_raw_events_version_time
  ON raw_events(app_version_id, event_timestamp);

CREATE TABLE IF NOT EXISTS version_durations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  app_version_id TEXT NOT NULL,
  cycle_index INTEGER NOT NULL,
  prepare_for_submission_at TEXT,
  ready_for_review_at TEXT,
  in_review_at TEXT,
  terminal_at TEXT,
  final_state TEXT,
  build_hours REAL,
  queue_hours REAL,
  review_hours REAL,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, app_version_id, cycle_index)
);

CREATE INDEX IF NOT EXISTS idx_version_durations_completed
  ON version_durations(completed_at);

CREATE INDEX IF NOT EXISTS idx_version_durations_version
  ON version_durations(user_id, app_version_id, completed_at);

CREATE TABLE IF NOT EXISTS summary_bucket_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_name TEXT NOT NULL,
  bucket_label TEXT NOT NULL,
  pct REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  range_label TEXT NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS summary_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_label TEXT NOT NULL,
  p02 REAL NOT NULL,
  p25 REAL NOT NULL,
  p50 REAL NOT NULL,
  p75 REAL NOT NULL,
  p98 REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
