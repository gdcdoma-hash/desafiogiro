begin;

create or replace view public.medal_inventory_demand_summary
with (security_invoker = true)
as
select
  c.id as challenge_id,
  c.code as challenge_code,
  c.public_name as challenge_name,
  g.id as goal_id,
  g.target_km,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_label,
  coalesce(regs.confirmed_count, 0)::bigint as confirmed_count,
  coalesce(regs.covered_registration_count, 0)::bigint as reserved_registration_count,
  greatest(
    coalesce(regs.confirmed_count, 0) - coalesce(regs.covered_registration_count, 0),
    0
  )::bigint as confirmed_without_reservation_count,
  coalesce(stock.physical_balance, 0)::bigint as physical_balance,
  coalesce(stock.reserved_quantity, 0)::bigint as reserved_quantity,
  coalesce(stock.available_balance, 0)::bigint as available_balance,
  greatest(
    coalesce(regs.confirmed_count, 0) - coalesce(regs.covered_registration_count, 0) - coalesce(stock.available_balance, 0),
    0
  )::bigint as minimum_additional_medals_needed
from public.challenges c
join public.challenge_goals g on g.challenge_id = c.id
left join lateral (
  select
    count(*) filter (where r.status in ('CONFIRMED','COMPLETED')) as confirmed_count,
    count(*) filter (
      where r.status in ('CONFIRMED','COMPLETED')
        and exists (
          select 1
          from public.inventory_reservations ir
          where ir.registration_id = r.id
            and ir.status in ('RESERVED','FULFILLED')
        )
    ) as covered_registration_count
  from public.registrations r
  where r.challenge_id = c.id
    and r.goal_id = g.id
) regs on true
left join lateral (
  select
    coalesce(sum(a.physical_balance), 0)::bigint as physical_balance,
    coalesce(sum(a.reserved_quantity), 0)::bigint as reserved_quantity,
    coalesce(sum(a.available_balance), 0)::bigint as available_balance
  from public.inventory_items i
  join public.inventory_availability a on a.inventory_item_id = i.id
  where i.challenge_id = c.id
    and i.goal_id = g.id
    and i.status = 'ACTIVE'
) stock on true;

revoke all on public.medal_inventory_demand_summary from anon;
grant select on public.medal_inventory_demand_summary to authenticated;

commit;
