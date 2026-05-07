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

create extension if not exists pgcrypto;

create table if not exists app_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  app_store_app_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists webhook_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  secret_hash text not null unique,
  secret_prefix text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_webhook_credentials_user_active
  on webhook_credentials(user_id, is_active, created_at desc);

create index if not exists idx_webhook_credentials_secret_active
  on webhook_credentials(secret_hash)
  where is_active = true and revoked_at is null;

alter table app_connections enable row level security;
alter table webhook_credentials enable row level security;

drop policy if exists app_connections_select_own on app_connections;
create policy app_connections_select_own
on app_connections
for select
using (user_id = auth.uid());

drop policy if exists app_connections_insert_own on app_connections;
create policy app_connections_insert_own
on app_connections
for insert
with check (user_id = auth.uid());

drop policy if exists app_connections_update_own on app_connections;
create policy app_connections_update_own
on app_connections
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists webhook_credentials_select_own on webhook_credentials;
create policy webhook_credentials_select_own
on webhook_credentials
for select
using (user_id = auth.uid());

drop policy if exists webhook_credentials_insert_own on webhook_credentials;
create policy webhook_credentials_insert_own
on webhook_credentials
for insert
with check (user_id = auth.uid());

drop policy if exists webhook_credentials_update_own on webhook_credentials;
create policy webhook_credentials_update_own
on webhook_credentials
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
