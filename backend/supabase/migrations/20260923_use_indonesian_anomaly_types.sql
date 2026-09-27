begin;

alter table public.ai_vision_results
  drop constraint if exists ai_vision_results_anomaly_type_check;

alter table public.anomaly_events
  drop constraint if exists anomaly_events_anomaly_type_check;

update public.ai_vision_results
set anomaly_type = case anomaly_type
  when 'pillow' then 'bantal'
  when 'bolster' then 'guling'
  when 'toy' then 'mainan'
  else anomaly_type
end;

update public.anomaly_events
set anomaly_type = case anomaly_type
  when 'pillow' then 'bantal'
  when 'bolster' then 'guling'
  when 'toy' then 'mainan'
  else anomaly_type
end;

alter table public.ai_vision_results
  add constraint ai_vision_results_anomaly_type_check
  check (anomaly_type is null or anomaly_type in ('bantal', 'guling', 'mainan'));

alter table public.anomaly_events
  add constraint anomaly_events_anomaly_type_check
  check (anomaly_type in ('bantal', 'guling', 'mainan'));

commit;
