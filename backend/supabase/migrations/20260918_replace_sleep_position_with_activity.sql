begin;

-- Posisi tidur tidak lagi dipakai sebagai data status maupun laporan.
delete from public.alert_logs where type = 'PRONE_POSITION';

alter table public.baby_statuses
  drop column if exists sleep_position,
  drop column if exists position_confidence,
  add column if not exists activity text not null default 'sleeping';

update public.baby_statuses
set activity = 'sleeping'
where activity is null or activity not in ('sleeping', 'awake', 'crying');

alter table public.baby_statuses
  alter column activity set default 'sleeping',
  alter column activity set not null;

alter table public.baby_statuses
  drop constraint if exists baby_statuses_activity_check,
  add constraint baby_statuses_activity_check
    check (activity in ('sleeping', 'awake', 'crying'));

alter table public.daily_reports
  drop column if exists total_prone_events,
  drop column if exists hourly_positions;

commit;
