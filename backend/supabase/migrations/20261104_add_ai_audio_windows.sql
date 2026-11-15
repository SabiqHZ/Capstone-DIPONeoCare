create table if not exists public.ai_audio_windows (
  device_id uuid not null references public.devices(id) on delete cascade,
  audio_window_id text not null,
  started_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds = 5),
  created_at timestamptz not null default now(),
  primary key (device_id, audio_window_id)
);

create index if not exists ai_audio_windows_device_started_at_idx
  on public.ai_audio_windows (device_id, started_at);

alter table public.ai_audio_windows enable row level security;
