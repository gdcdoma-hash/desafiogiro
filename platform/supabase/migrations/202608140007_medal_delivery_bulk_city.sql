begin;

create or replace function public.assign_pending_medal_deliveries_by_city(
  target_batch_id uuid,
  target_city text,
  target_state_code text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  batch_challenge uuid;
  batch_status text;
  normalized_city text;
  normalized_state text;
  affected_count integer;
begin
  normalized_city := trim(coalesce(target_city, ''));
  normalized_state := upper(trim(coalesce(target_state_code, '')));

  if length(normalized_city) < 2 then
    raise exception 'City is required';
  end if;

  if normalized_state !~ '^[A-Z]{2}$' then
    raise exception 'State code must contain two letters';
  end if;

  select challenge_id, status
    into batch_challenge, batch_status
  from public.medal_delivery_batches
  where id = target_batch_id;

  if batch_challenge is null then
    raise exception 'Medal delivery batch not found';
  end if;

  if batch_status <> 'PREPARING' then
    raise exception 'Only preparing batches can receive medal deliveries';
  end if;

  update public.medal_deliveries d
  set batch_id = target_batch_id,
      status = 'ASSIGNED'
  from public.registrations r
  join public.participants p on p.id = r.participant_id
  where d.registration_id = r.id
    and d.challenge_id = batch_challenge
    and d.status = 'PENDING'
    and lower(trim(p.city)) = lower(normalized_city)
    and p.state_code = normalized_state;

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.assign_pending_medal_deliveries_by_city(uuid, text, text) to authenticated;

commit;
