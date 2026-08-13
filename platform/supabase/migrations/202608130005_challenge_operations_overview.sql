begin;

create or replace view public.challenge_operations_overview
with (security_invoker = true)
as
select
  c.id as challenge_id,
  c.code,
  c.public_name as challenge_name,
  c.reference_year,
  c.reference_month,
  c.sports_starts_at,
  c.sports_ends_at,
  c.status,
  c.is_public,
  coalesce(goals.goal_count, 0)::bigint as goal_count,
  coalesce(goals.active_goal_count, 0)::bigint as active_goal_count,
  coalesce(offers.offer_count, 0)::bigint as offer_count,
  coalesce(offers.open_offer_count, 0)::bigint as open_offer_count,
  coalesce(regs.registration_count, 0)::bigint as registration_count,
  coalesce(regs.pending_registration_count, 0)::bigint as pending_registration_count,
  coalesce(regs.confirmed_registration_count, 0)::bigint as confirmed_registration_count,
  coalesce(regs.completed_registration_count, 0)::bigint as completed_registration_count,
  coalesce(regs.cancelled_registration_count, 0)::bigint as cancelled_registration_count,
  coalesce(regs.expired_registration_count, 0)::bigint as expired_registration_count
from public.challenges c
left join lateral (
  select
    count(*) as goal_count,
    count(*) filter (where g.is_active) as active_goal_count
  from public.challenge_goals g
  where g.challenge_id = c.id
) goals on true
left join lateral (
  select
    count(*) as offer_count,
    count(*) filter (where o.status = 'OPEN') as open_offer_count
  from public.challenge_offers o
  where o.challenge_id = c.id
) offers on true
left join lateral (
  select
    count(*) as registration_count,
    count(*) filter (where r.status = 'PENDING') as pending_registration_count,
    count(*) filter (where r.status = 'CONFIRMED') as confirmed_registration_count,
    count(*) filter (where r.status = 'COMPLETED') as completed_registration_count,
    count(*) filter (where r.status = 'CANCELLED') as cancelled_registration_count,
    count(*) filter (where r.status = 'EXPIRED') as expired_registration_count
  from public.registrations r
  where r.challenge_id = c.id
) regs on true;

revoke all on public.challenge_operations_overview from anon;
grant select on public.challenge_operations_overview to authenticated;

commit;
