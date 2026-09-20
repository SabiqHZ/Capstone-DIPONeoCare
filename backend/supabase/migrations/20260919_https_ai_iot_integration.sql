begin;

-- Device lifecycle and LAN metadata.
alter table public.devices
  add column if not exists local_ip text,
  add column if not exists firmware_version text,
  add column if not exists device_token_hash text;

-- The current status is intentionally a mutually-exclusive boolean state.
-- Existing rows are translated once from the legacy text column before the
-- constraint is enabled, so the migration is safe for a database that still
-- has the previous `activity` field.
alter table public.baby_statuses
  add column if not exists is_sleeping boolean not null default false,
  add column if not exists is_awake boolean not null default false;

update public.baby_statuses
set
  is_sleeping = (activity = 'sleeping'),
  is_awake = (activity = 'awake'),
  is_crying = (activity = 'crying');

alter table public.baby_statuses
  drop constraint if exists baby_statuses_exactly_one_activity_check;

alter table public.baby_statuses
  add constraint baby_statuses_exactly_one_activity_check
  check ((is_sleeping::integer + is_awake::integer + is_crying::integer) = 1);

-- One record per second after visual and audio results have been matched.
create table if not exists public.baby_activity_samples (
  id bigint generated always as identity primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  recorded_at timestamptz not null,
  sleeping boolean not null,
  awake boolean not null,
  crying boolean not null,
  constraint baby_activity_samples_exactly_one_activity_check
    check ((sleeping::integer + awake::integer + crying::integer) = 1),
  unique (baby_id, recorded_at)
);

alter table public.baby_activity_samples
  add column if not exists device_id uuid references public.devices(id) on delete set null,
  add column if not exists visual_crying boolean not null default false,
  add column if not exists audio_crying boolean not null default false,
  add column if not exists visual_confidence numeric,
  add column if not exists audio_confidence numeric,
  add column if not exists created_at timestamptz not null default now();

create index if not exists baby_activity_samples_device_time_idx
  on public.baby_activity_samples(device_id, recorded_at);

-- Raw callbacks are kept until matching visual and audio results are available.
create table if not exists public.ai_vision_results (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  baby_id uuid not null references public.babies(id) on delete cascade,
  capture_id text not null,
  captured_at timestamptz not null,
  sleeping boolean not null,
  awake boolean not null,
  visual_crying boolean not null,
  visual_confidence numeric,
  visual_crying_confidence numeric,
  anomaly_detected boolean not null default false,
  anomaly_type text check (anomaly_type is null or anomaly_type in ('pillow', 'bolster', 'toy')),
  anomaly_confidence numeric,
  night_vision_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ai_vision_results_base_activity_check
    check ((sleeping::integer + awake::integer) = 1),
  constraint ai_vision_results_device_capture_unique unique(device_id, capture_id)
);

create table if not exists public.ai_audio_results (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  capture_id text not null,
  captured_at timestamptz not null,
  is_crying boolean not null,
  confidence numeric,
  created_at timestamptz not null default now(),
  constraint ai_audio_results_device_capture_unique unique(device_id, capture_id)
);

create table if not exists public.anomaly_events (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  anomaly_type text not null check (anomaly_type in ('pillow', 'bolster', 'toy')),
  started_at timestamptz not null,
  last_detected_at timestamptz not null,
  resolved_at timestamptz,
  alert_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists anomaly_events_one_active_per_device
  on public.anomaly_events(device_id)
  where resolved_at is null;

alter table public.daily_reports
  add column if not exists total_sleep_minutes integer not null default 0,
  add column if not exists total_awake_minutes integer not null default 0,
  add column if not exists total_crying_minutes integer not null default 0;

create unique index if not exists daily_reports_baby_date_unique
  on public.daily_reports(baby_id, date);

commit;
