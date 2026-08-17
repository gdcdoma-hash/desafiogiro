begin;

insert into public.app_permissions (code, description) values
  ('activities.read', 'Consultar atividades e progresso do Meu Giro'),
  ('activities.manage', 'Registrar atividades manuais de contingência')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('activities.read', 'activities.manage')
on conflict do nothing;

create table public.participant_activities (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  registration_id uuid not null references public.registrations(id) on delete restrict,
  source_code text not null default 'MANUAL' check (source_code in ('MANUAL', 'STRAVA')),
  external_id text,
  title text not null default 'Atividade manual' check (length(trim(title)) between 2 and 160),
  distance_km numeric(10,3) not null check (distance_km > 0),
  started_at timestamptz not null,
  started_local_at timestamp without time zone not null,
  timezone text not null,
  competence_month date generated always as (date_trunc('month', started_local_at)::date) stored,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_code = 'STRAVA' or external_id is null),
  check (source_code <> 'STRAVA' or external_id is not null)
);

create index participant_activities_participant_month_idx
  on public.participant_activities (participant_id, competence_month, started_local_at desc);
create index participant_activities_registration_idx
  on public.participant_activities (registration_id, started_local_at desc);
create unique index participant_activities_external_source_idx
  on public.participant_activities (source_code, external_id)
  where external_id is not null;

create or replace function public.validate_participant_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  registration_participant uuid;
  challenge_start timestamptz;
  challenge_end timestamptz;
begin
  select r.participant_id, c.sports_starts_at, c.sports_ends_at
    into registration_participant, challenge_start, challenge_end
  from public.registrations r
  join public.challenges c on c.id = r.challenge_id
  where r.id = new.registration_id;

  if registration_participant is null or registration_participant <> new.participant_id then
    raise exception 'Activity participant must match its registration';
  end if;

  if new.started_at < challenge_start or new.started_at > challenge_end then
    raise exception 'Activity start must belong to the challenge sports period';
  end if;

  if new.started_local_at <> (new.started_at at time zone new.timezone) then
    raise exception 'Local activity start does not match instant and timezone';
  end if;

  if tg_op = 'UPDATE' and (
    new.participant_id <> old.participant_id
    or new.registration_id <> old.registration_id
    or new.source_code <> old.source_code
    or new.external_id is distinct from old.external_id
  ) then
    raise exception 'Activity ownership and source fields are immutable';
  end if;

  return new;
end;
$$;

create trigger participant_activities_validate
before insert or update on public.participant_activities
for each row execute function public.validate_participant_activity();

create trigger participant_activities_set_updated_at
before update on public.participant_activities
for each row execute function public.set_updated_at();

alter table public.participant_activities enable row level security;

create policy participant_activities_admin_read
on public.participant_activities for select to authenticated
using ((select public.has_permission('activities.read')));

create policy participant_activities_participant_read
on public.participant_activities for select to authenticated
using (participant_id = (select public.current_participant_id()));

revoke all on public.participant_activities from anon, authenticated;
grant select on public.participant_activities to authenticated;

create or replace function public.record_manual_activity(
  target_registration_id uuid,
  activity_title text,
  activity_distance_km numeric,
  activity_started_local_at timestamp without time zone,
  activity_timezone text default 'America/Fortaleza',
  activity_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_id_value uuid;
  activity_id uuid;
begin
  if not public.has_permission('activities.manage') then
    raise exception 'Activities management permission required';
  end if;

  select r.participant_id into participant_id_value
  from public.registrations r
  where r.id = target_registration_id;

  if participant_id_value is null then
    raise exception 'Registration not found';
  end if;

  insert into public.participant_activities (
    participant_id, registration_id, source_code, title, distance_km,
    started_at, started_local_at, timezone, notes, created_by
  ) values (
    participant_id_value, target_registration_id, 'MANUAL', trim(activity_title),
    activity_distance_km, activity_started_local_at at time zone activity_timezone,
    activity_started_local_at, activity_timezone, trim(coalesce(activity_notes, '')), auth.uid()
  ) returning id into activity_id;

  perform public.write_audit_event(
    'activity.manual.created', 'participant_activity', 'success',
    extensions.gen_random_uuid(), activity_id::text, 'Registro manual de contingência',
    jsonb_build_object('registration_id', target_registration_id, 'distance_km', activity_distance_km),
    'meu-giro-v1'
  );

  return activity_id;
end;
$$;

create or replace function public.my_giro(reference_date date default current_date)
returns table (
  registration_id uuid,
  challenge_id uuid,
  challenge_name text,
  reference_year smallint,
  reference_month smallint,
  target_km integer,
  completed_km numeric,
  remaining_km numeric,
  progress_percent numeric,
  registration_status text,
  sports_starts_at timestamptz,
  sports_ends_at timestamptz,
  is_current_focus boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with linked as (
    select public.current_participant_id() as participant_id
  ), progress as (
    select
      r.id as registration_id,
      r.challenge_id,
      c.public_name as challenge_name,
      c.reference_year,
      c.reference_month,
      g.target_km,
      coalesce(sum(a.distance_km) filter (
        where a.competence_month = make_date(c.reference_year, c.reference_month, 1)
      ), 0)::numeric as completed_km,
      r.status as registration_status,
      c.sports_starts_at,
      c.sports_ends_at,
      (c.reference_year = extract(year from reference_date)::integer
        and c.reference_month = extract(month from reference_date)::integer) as is_current_focus
    from public.registrations r
    join linked l on l.participant_id = r.participant_id
    join public.challenges c on c.id = r.challenge_id
    join public.challenge_goals g on g.id = r.goal_id
    left join public.participant_activities a on a.registration_id = r.id
    where r.status not in ('CANCELLED', 'EXPIRED')
      and c.reference_month is not null
    group by r.id, c.id, g.id
  )
  select
    p.registration_id,
    p.challenge_id,
    p.challenge_name,
    p.reference_year,
    p.reference_month,
    p.target_km,
    round(p.completed_km, 3),
    greatest(p.target_km - p.completed_km, 0),
    least(round((p.completed_km / p.target_km) * 100, 1), 100),
    p.registration_status,
    p.sports_starts_at,
    p.sports_ends_at,
    p.is_current_focus
  from progress p
  order by p.is_current_focus desc, p.reference_year desc, p.reference_month desc, p.registration_id
$$;

revoke all on function public.record_manual_activity(uuid, text, numeric, timestamp without time zone, text, text) from public;
revoke all on function public.my_giro(date) from public;
grant execute on function public.record_manual_activity(uuid, text, numeric, timestamp without time zone, text, text) to authenticated;
grant execute on function public.my_giro(date) to authenticated;

comment on table public.participant_activities is 'Atividades do Meu Giro; a competência mensal é fixada pelo início local, inclusive em atividades que cruzam a virada do mês.';
comment on function public.my_giro(date) is 'Progresso das inscrições do participante autenticado, preservando inscrições com zero quilômetro e priorizando o mês de referência.';

commit;
