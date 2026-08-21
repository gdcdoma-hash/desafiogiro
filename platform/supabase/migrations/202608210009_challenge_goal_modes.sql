alter table public.challenges
  add column if not exists registration_type text not null default 'NORMAL',
  add column if not exists goal_mode text not null default 'DISTANCE_KM',
  add column if not exists fixed_target_km integer;

alter table public.challenges
  drop constraint if exists challenges_registration_type_check,
  add constraint challenges_registration_type_check
    check (registration_type in ('NORMAL', 'REPESCAGEM'));

alter table public.challenges
  drop constraint if exists challenges_goal_mode_check,
  add constraint challenges_goal_mode_check
    check (goal_mode in ('DISTANCE_KM', 'DURATION_DAYS'));

alter table public.challenges
  drop constraint if exists challenges_fixed_target_km_check,
  add constraint challenges_fixed_target_km_check
    check (
      (goal_mode = 'DISTANCE_KM' and fixed_target_km is null)
      or
      (goal_mode = 'DURATION_DAYS' and fixed_target_km is not null and fixed_target_km > 0)
    );

alter table public.challenge_goals
  add column if not exists duration_days integer;

alter table public.challenge_goals
  drop constraint if exists challenge_goals_duration_days_check,
  add constraint challenge_goals_duration_days_check
    check (duration_days is null or duration_days > 0);

create unique index if not exists challenge_goals_duration_unique
  on public.challenge_goals (challenge_id, duration_days)
  where duration_days is not null;

alter table public.registrations
  add column if not exists planned_starts_at timestamptz,
  add column if not exists planned_ends_at timestamptz;

alter table public.registrations
  drop constraint if exists registrations_planned_period_check,
  add constraint registrations_planned_period_check
    check (
      planned_starts_at is null
      or planned_ends_at is null
      or planned_ends_at > planned_starts_at
    );

comment on column public.challenges.registration_type is
  'Tipo operacional principal do desafio: NORMAL ou REPESCAGEM.';
comment on column public.challenges.goal_mode is
  'Forma de escolha da meta: DISTANCE_KM ou DURATION_DAYS.';
comment on column public.challenges.fixed_target_km is
  'Distancia fixa quando a escolha do participante e feita por prazo em dias.';
comment on column public.challenge_goals.duration_days is
  'Prazo escolhido pelo participante para desafios medidos por dias.';
comment on column public.registrations.planned_starts_at is
  'Inicio previsto da participacao para desafios com prazo individual.';
comment on column public.registrations.planned_ends_at is
  'Fim previsto calculado conforme o prazo escolhido.';
