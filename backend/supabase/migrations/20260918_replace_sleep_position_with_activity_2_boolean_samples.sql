begin;

-- Status terbaru memakai tiga flag boolean yang saling eksklusif.
alter table public.baby_statuses
  add column if not exists is_sleeping boolean not null default false,
  add column if not exists is_awake boolean not null default false;

update public.baby_statuses
set
  activity = case
    when activity in ('sleeping', 'awake', 'crying') then activity
    else 'sleeping'
  end;

update public.baby_statuses
set
  is_sleeping = activity = 'sleeping',
  is_awake = activity = 'awake',
  is_crying = activity = 'crying';

alter table public.baby_statuses
  drop constraint if exists baby_statuses_exactly_one_activity_check,
  add constraint baby_statuses_exactly_one_activity_check
    check ((is_sleeping::integer + is_awake::integer + is_crying::integer) = 1);

-- Satu baris dibuat untuk setiap hasil AI per detik.
create table if not exists public.baby_activity_samples (
  id bigint generated always as identity primary key,
  baby_id uuid not null references public.babies(id) on delete cascade,
  sleeping boolean not null,
  awake boolean not null,
  crying boolean not null,
  recorded_at timestamptz not null,
  constraint baby_activity_samples_exactly_one_activity_check
    check ((sleeping::integer + awake::integer + crying::integer) = 1),
  unique (baby_id, recorded_at)
);

create index if not exists baby_activity_samples_baby_recorded_at_idx
  on public.baby_activity_samples (baby_id, recorded_at);

commit;
