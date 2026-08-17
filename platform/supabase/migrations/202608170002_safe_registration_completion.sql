begin;

create or replace function public.validate_registration_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_distance integer;
  reference_year_value smallint;
  reference_month_value smallint;
  completed_distance numeric;
begin
  if new.status <> old.status then
    if not (
      (old.status = 'PENDING' and new.status in ('CONFIRMED','CANCELLED','EXPIRED')) or
      (old.status = 'CONFIRMED' and new.status in ('COMPLETED','CANCELLED'))
    ) then
      raise exception 'Invalid registration status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if old.status in ('COMPLETED','CANCELLED','EXPIRED') and new.status <> old.status then
    raise exception 'Final registration status cannot be changed';
  end if;

  if old.status = 'CONFIRMED' and new.status = 'COMPLETED' then
    select g.target_km, c.reference_year, c.reference_month
      into target_distance, reference_year_value, reference_month_value
    from public.challenge_goals g
    join public.challenges c on c.id = g.challenge_id
    where g.id = old.goal_id
      and c.id = old.challenge_id;

    if target_distance is null or reference_year_value is null or reference_month_value is null then
      raise exception 'Challenge reference period and goal are required for completion';
    end if;

    select coalesce(sum(a.distance_km), 0)
      into completed_distance
    from public.participant_activities a
    where a.registration_id = old.id
      and a.competence_month = make_date(reference_year_value, reference_month_value, 1);

    if completed_distance < target_distance then
      raise exception 'Goal not reached: % of % km', completed_distance, target_distance;
    end if;

    perform public.write_audit_event(
      'registration.completed',
      'registration',
      'success',
      extensions.gen_random_uuid(),
      old.id::text,
      'Conclusão validada por meta atingida',
      jsonb_build_object(
        'completed_km', completed_distance,
        'target_km', target_distance
      ),
      'v1-safe-completion'
    );
  end if;

  return new;
end;
$$;

create or replace function public.complete_registration(target_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_status text;
begin
  if not public.has_permission('registrations.manage') then
    raise exception 'Registrations management permission required';
  end if;

  select r.status into registration_status
  from public.registrations r
  where r.id = target_registration_id
  for update;

  if registration_status is null then
    raise exception 'Registration not found';
  end if;

  if registration_status <> 'CONFIRMED' then
    raise exception 'Only confirmed registrations can be completed';
  end if;

  update public.registrations
  set status = 'COMPLETED'
  where id = target_registration_id;

  return target_registration_id;
end;
$$;

revoke all on function public.complete_registration(uuid) from public, anon, authenticated;
grant execute on function public.complete_registration(uuid) to authenticated;

comment on function public.complete_registration(uuid) is
  'Conclui inscrição confirmada; o trigger de ciclo de vida valida no banco que a meta de quilômetros foi atingida na competência do desafio.';

commit;
