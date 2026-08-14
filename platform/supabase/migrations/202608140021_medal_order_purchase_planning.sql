begin;

create or replace view public.medal_purchase_planning
with (security_invoker = true)
as
select
  d.challenge_id,
  d.challenge_code,
  d.challenge_name,
  d.goal_id,
  d.target_km,
  d.goal_label,
  d.confirmed_count,
  d.reserved_registration_count,
  d.confirmed_without_reservation_count,
  d.physical_balance,
  d.reserved_quantity,
  d.available_balance,
  d.minimum_additional_medals_needed,
  coalesce(po.open_order_quantity, 0)::bigint as open_order_quantity,
  greatest(
    d.minimum_additional_medals_needed - coalesce(po.open_order_quantity, 0),
    0
  )::bigint as suggested_purchase_quantity
from public.medal_inventory_demand_summary d
left join lateral (
  select coalesce(sum(i.quantity), 0)::bigint as open_order_quantity
  from public.medal_order_items i
  join public.medal_orders o on o.id = i.medal_order_id
  where i.goal_id = d.goal_id
    and o.challenge_id = d.challenge_id
    and o.status in ('DRAFT','ORDERED')
) po on true;

revoke all on public.medal_purchase_planning from anon;
grant select on public.medal_purchase_planning to authenticated;

commit;
