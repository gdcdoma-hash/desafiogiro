begin;

create or replace view public.medal_delivery_batch_reconciliation
with (security_invoker = true)
as
select
  b.id as batch_id,
  b.challenge_id,
  b.label,
  b.method,
  b.city,
  b.state_code,
  b.status,
  b.handed_over_at,
  count(d.id)::integer as total_deliveries,
  count(*) filter (where d.status = 'CONFIRMED')::integer as confirmed_count,
  count(*) filter (where d.status = 'CANCELLED')::integer as cancelled_count,
  count(*) filter (where d.status = 'ISSUE_REPORTED')::integer as issue_count,
  count(*) filter (where d.status not in ('CONFIRMED','CANCELLED'))::integer as open_count,
  case
    when count(d.id) > 0
      and count(*) filter (where d.status not in ('CONFIRMED','CANCELLED')) = 0
    then true
    else false
  end as ready_to_close
from public.medal_delivery_batches b
left join public.medal_deliveries d on d.batch_id = b.id
group by b.id;

grant select on public.medal_delivery_batch_reconciliation to authenticated;
revoke all on public.medal_delivery_batch_reconciliation from anon;

create or replace function public.close_medal_delivery_batch(target_batch_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
  total_count integer;
  open_count integer;
begin
  select status
    into current_status
  from public.medal_delivery_batches
  where id = target_batch_id;

  if current_status is null then
    raise exception 'Medal delivery batch not found';
  end if;

  if current_status <> 'HANDED_OFF' then
    raise exception 'Only handed off batches can be closed';
  end if;

  select
    count(*)::integer,
    count(*) filter (where status not in ('CONFIRMED','CANCELLED'))::integer
    into total_count, open_count
  from public.medal_deliveries
  where batch_id = target_batch_id;

  if total_count = 0 then
    raise exception 'Batch has no medal deliveries';
  end if;

  if open_count > 0 then
    raise exception 'Batch still has open medal deliveries';
  end if;

  update public.medal_delivery_batches
  set status = 'CLOSED'
  where id = target_batch_id;
end;
$$;

grant execute on function public.close_medal_delivery_batch(uuid) to authenticated;

commit;
