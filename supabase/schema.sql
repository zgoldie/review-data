-- Run this in Supabase SQL Editor once.

create table if not exists raw_events (
  id bigserial primary key,
  event_id text not null unique,
  user_id text not null,
  app_version_id text not null,
  old_state text,
  new_state text not null,
  event_timestamp timestamptz not null,
  received_at timestamptz not null default now(),
  payload_json jsonb not null
);

create index if not exists idx_raw_events_user_time
  on raw_events(user_id, event_timestamp);

create index if not exists idx_raw_events_version_time
  on raw_events(app_version_id, event_timestamp);

create table if not exists version_durations (
  id bigserial primary key,
  user_id text not null,
  app_version_id text not null,
  cycle_index integer not null,
  prepare_for_submission_at timestamptz,
  ready_for_review_at timestamptz,
  in_review_at timestamptz,
  terminal_at timestamptz,
  final_state text,
  build_hours numeric,
  queue_hours numeric,
  review_hours numeric,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, app_version_id, cycle_index)
);

create index if not exists idx_version_durations_completed
  on version_durations(completed_at);

create index if not exists idx_version_durations_version
  on version_durations(user_id, app_version_id, completed_at);

-- Optional placeholders for future precompute pipeline:
create table if not exists summary_bucket_stats (
  id bigserial primary key,
  metric_name text not null,
  bucket_label text not null,
  pct numeric not null,
  sample_size integer not null,
  range_label text not null,
  computed_at timestamptz not null default now()
);

create table if not exists summary_trends (
  id bigserial primary key,
  month_label text not null,
  p10 numeric not null,
  p25 numeric not null,
  p50 numeric not null,
  p75 numeric not null,
  p100 numeric not null,
  sample_size integer not null,
  computed_at timestamptz not null default now()
);
