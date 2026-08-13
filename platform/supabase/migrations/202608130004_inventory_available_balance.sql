begin;

create or replace view public.inventory_balances
with (security_invoker = true)
as
select
  a.inventory_item_id,
  a.challenge_id,
  a.goal_id,
  a.code,
  a.public_name,
  a.status,
  a.available_balance as balance
from public.inventory_availability a;

create or replace view public.inventory_operations_overview
with (security_invoker = true)
as
select
  i.id as inventory_item_id,
  i.challenge_id,
  c.public_name as challenge_name,
  i.goal_id,
  coalesce(g.public_label, case when g.target_km is not null then g.target_km::text || ' km' else null end) as goal_name,
  i.code,
  i.public_name,
  i.status,
  a.physical_balance,
  a.reserved_quantity,
  a.available_balance as balance,
  max(m.occurred_at) as last_movement_at,
  count(m.id)::bigint as movement_count
from public.inventory_items i
join public.challenges c on c.id = i.challenge_id
left join public.challenge_goals g on g.id = i.goal_id
join public.inventory_availability a on a.inventory_item_id = i.id
left join public.inventory_movements m on m.inventory_item_id = i.id
group by i.id, i.challenge_id, c.public_name, i.goal_id, g.public_label, g.target_km, i.code, i.public_name, i.status, a.physical_balance, a.reserved_quantity, a.available_balance;

commit;
