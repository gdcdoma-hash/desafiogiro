begin;

create or replace view public.registration_operations_overview
with (security_invoker = true)
as
select
  r.id as registration_id,
  r.participant_id,
  p.full_name as participant_name,
  r.challenge_id,
  c.public_name as challenge_name,
  r.goal_id,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_name,
  r.offer_id,
  o.public_name as offer_name,
  r.status as registration_status,
  r.price_snapshot,
  coalesce(pay.confirmed_amount, 0)::numeric(12,2) as confirmed_amount,
  coalesce(pay.pending_amount, 0)::numeric(12,2) as pending_amount,
  case
    when coalesce(pay.confirmed_amount, 0) >= r.price_snapshot then 'PAID'
    when coalesce(pay.confirmed_amount, 0) > 0 then 'PARTIAL'
    when coalesce(pay.pending_amount, 0) > 0 then 'PENDING'
    else 'UNPAID'
  end as payment_summary,
  r.created_at,
  ir.status as reservation_status,
  ir.inventory_item_id,
  case
    when r.status = 'CONFIRMED' and ir.status = 'RESERVED' then true
    else false
  end as avatar_acceptance_ready
from public.registrations r
join public.participants p on p.id = r.participant_id
join public.challenges c on c.id = r.challenge_id
join public.challenge_goals g on g.id = r.goal_id
join public.challenge_offers o on o.id = r.offer_id
left join public.inventory_reservations ir
  on ir.registration_id = r.id
left join lateral (
  select
    coalesce(sum(rp.amount) filter (where rp.status = 'CONFIRMED'), 0) as confirmed_amount,
    coalesce(sum(rp.amount) filter (where rp.status = 'PENDING'), 0) as pending_amount
  from public.registration_payments rp
  where rp.registration_id = r.id
) pay on true;

commit;