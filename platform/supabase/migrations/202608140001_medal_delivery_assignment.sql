begin;

create or replace function public.assign_medal_delivery_to_batch(
  target_delivery_id uuid,
  target_batch_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  delivery_challenge uuid;
  delivery_status text;
  batch_challenge uuid;
  batch_status text;
begin
  select challenge_id, status
    into delivery_challenge, delivery_status
  from public.medal_deliveries
  where id = target_delivery_id;

  if delivery_challenge is null then
    raise exception 'Medal delivery not found';
  end if;

  if delivery_status <> 'PENDING' then
    raise exception 'Only pending medal deliveries can be assigned';
  end if;

  select challenge_id, status
    into batch_challenge, batch_status
  from public.medal_delivery_batches
  where id = target_batch_id;

  if batch_challenge is null then
    raise exception 'Medal delivery batch not found';
  end if;

  if batch_challenge <> delivery_challenge then
    raise exception 'Medal delivery batch must belong to the same challenge';
  end if;

  if batch_status <> 'PREPARING' then
    raise exception 'Only preparing batches can receive medal deliveries';
  end if;

  update public.medal_deliveries
  set batch_id = target_batch_id,
      status = 'ASSIGNED'
  where id = target_delivery_id;
end;
$$;

create or replace function public.handoff_medal_delivery_batch(
  target_batch_id uuid,
  recipient_name text,
  evidence text,
  handed_over_at_value timestamptz default now()
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  batch_method text;
  batch_status text;
  next_delivery_status text;
  affected_count integer;
begin
  if length(trim(coalesce(recipient_name, ''))) < 2 then
    raise exception 'Handoff recipient name is required';
  end if;

  if length(trim(coalesce(evidence, ''))) < 3 then
    raise exception 'Handoff evidence is required';
  end if;

  select method, status
    into batch_method, batch_status
  from public.medal_delivery_batches
  where id = target_batch_id;

  if batch_method is null then
    raise exception 'Medal delivery batch not found';
  end if;

  if batch_status <> 'PREPARING' then
    raise exception 'Only preparing batches can be handed off';
  end if;

  if not exists (
    select 1
    from public.medal_deliveries
    where batch_id = target_batch_id
      and status = 'ASSIGNED'
  ) then
    raise exception 'Batch has no assigned medal deliveries';
  end if;

  next_delivery_status := case
    when batch_method = 'POSTAL' then 'IN_TRANSIT'
    else 'AWAITING_CONFIRMATION'
  end;

  update public.medal_delivery_batches
  set status = 'HANDED_OFF',
      handed_over_at = coalesce(handed_over_at_value, now()),
      handoff_evidence = trim(evidence)
  where id = target_batch_id;

  update public.medal_deliveries
  set status = next_delivery_status,
      handoff_recipient_name = trim(recipient_name),
      handed_off_at = coalesce(handed_over_at_value, now()),
      handoff_evidence = trim(evidence)
  where batch_id = target_batch_id
    and status = 'ASSIGNED';

  get diagnostics affected_count = row_count;
  return affected_count;
end;
$$;

grant execute on function public.assign_medal_delivery_to_batch(uuid, uuid) to authenticated;
grant execute on function public.handoff_medal_delivery_batch(uuid, text, text, timestamptz) to authenticated;

commit;
