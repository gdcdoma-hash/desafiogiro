begin;

create or replace function public.activate_medal_delivery_period(
  target_challenge_id uuid,
  period_starts_at timestamptz,
  period_ends_at timestamptz,
  period_notes text default ''
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if period_starts_at is null or period_ends_at is null or period_ends_at <= period_starts_at then
    raise exception 'Invalid medal delivery period';
  end if;
  if not exists (select 1 from public.challenges c where c.id = target_challenge_id) then
    raise exception 'Challenge not found';
  end if;

  insert into public.medal_delivery_periods (challenge_id, starts_at, ends_at, status, notes)
  values (target_challenge_id, period_starts_at, period_ends_at, 'OPEN', coalesce(period_notes, ''))
  on conflict (challenge_id) do update
  set starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      status = 'OPEN',
      notes = excluded.notes;

  insert into public.medal_deliveries (registration_id, challenge_id)
  select r.id, r.challenge_id
  from public.registrations r
  where r.challenge_id = target_challenge_id
    and r.status in ('CONFIRMED','COMPLETED')
  on conflict (registration_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.close_medal_delivery_period(target_challenge_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.medal_delivery_periods
  set status = 'CLOSED'
  where challenge_id = target_challenge_id
    and status = 'OPEN';
end;
$$;

create or replace function public.sync_registration_medal_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('CONFIRMED','COMPLETED')
    and exists (
      select 1
      from public.medal_delivery_periods p
      where p.challenge_id = new.challenge_id
        and p.status = 'OPEN'
    ) then
    insert into public.medal_deliveries (registration_id, challenge_id)
    values (new.id, new.challenge_id)
    on conflict (registration_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger registrations_sync_medal_delivery
  after insert or update of status
  on public.registrations
  for each row execute function public.sync_registration_medal_delivery();

grant execute on function public.activate_medal_delivery_period(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.close_medal_delivery_period(uuid) to authenticated;

commit;
