begin;

create or replace view public.medal_delivery_city_summary
with (security_invoker = true)
as
select
  d.challenge_id,
  c.public_name as challenge_name,
  p.city,
  p.state_code,
  count(*)::integer as total_deliveries,
  count(*) filter (where d.status = 'PENDING')::integer as pending_count,
  count(*) filter (where d.status = 'ASSIGNED')::integer as assigned_count,
  count(*) filter (where d.status in ('IN_TRANSIT','AWAITING_CONFIRMATION'))::integer as awaiting_receipt_count,
  count(*) filter (where d.status = 'ISSUE_REPORTED')::integer as issue_count,
  count(*) filter (where d.status = 'CONFIRMED')::integer as confirmed_count,
  count(*) filter (where d.status = 'CANCELLED')::integer as cancelled_count,
  count(distinct d.batch_id) filter (where d.batch_id is not null)::integer as batch_count,
  min(d.created_at) as first_delivery_created_at,
  max(d.updated_at) as last_delivery_updated_at
from public.medal_deliveries d
join public.registrations r on r.id = d.registration_id
join public.participants p on p.id = r.participant_id
join public.challenges c on c.id = d.challenge_id
group by d.challenge_id, c.public_name, p.city, p.state_code;

grant select on public.medal_delivery_city_summary to authenticated;
revoke all on public.medal_delivery_city_summary from anon;

commit;
