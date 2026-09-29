begin;

-- =========================================================
-- 1. AI AUDIO RESULTS
-- =========================================================

alter table public.ai_audio_results
  add column if not exists crying_class text,
  add column if not exists crying_class_confidence numeric;

alter table public.ai_audio_results
  drop constraint if exists ai_audio_results_crying_class_check;

alter table public.ai_audio_results
  add constraint ai_audio_results_crying_class_check
  check (
    crying_class is null
    or crying_class in ('hungry', 'pain', 'discomfort')
  );

alter table public.ai_audio_results
  drop constraint if exists ai_audio_results_crying_class_confidence_check;

alter table public.ai_audio_results
  add constraint ai_audio_results_crying_class_confidence_check
  check (
    crying_class_confidence is null
    or (
      crying_class_confidence >= 0
      and crying_class_confidence <= 1
    )
  );


-- =========================================================
-- 2. BABY STATUSES
-- =========================================================

alter table public.baby_statuses
  add column if not exists crying_class text;

alter table public.baby_statuses
  drop constraint if exists baby_statuses_crying_class_check;

alter table public.baby_statuses
  add constraint baby_statuses_crying_class_check
  check (
    crying_class is null
    or crying_class in ('hungry', 'pain', 'discomfort')
  );


-- =========================================================
-- 3. BABY ACTIVITY SAMPLES
-- =========================================================

alter table public.baby_activity_samples
  add column if not exists crying_class text;

alter table public.baby_activity_samples
  drop constraint if exists baby_activity_samples_crying_class_check;

alter table public.baby_activity_samples
  add constraint baby_activity_samples_crying_class_check
  check (
    crying_class is null
    or crying_class in ('hungry', 'pain', 'discomfort')
  );


-- =========================================================
-- 4. ALERT LOGS
-- =========================================================

alter table public.alert_logs
  add column if not exists crying_class text;

alter table public.alert_logs
  drop constraint if exists alert_logs_crying_class_check;

alter table public.alert_logs
  add constraint alert_logs_crying_class_check
  check (
    crying_class is null
    or crying_class in ('hungry', 'pain', 'discomfort')
  );

commit;