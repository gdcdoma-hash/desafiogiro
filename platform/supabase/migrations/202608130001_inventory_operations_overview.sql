begin;

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
  coalesce(sum(m.quantity), 0)::bigint as balance,
  max(m.occurred_at) as last_movement_at,
  count(m.id)::bigint as movement_count
from public.inventory_items i
join public.challenges c on c.id = i.challenge_id
left join public.challenge_goals g on g.id = i.goal_id
left join public.inventory_movements m on m.inventory_item_id = i.id
group by i.id, i.challenge_id, c.public_name, i.goal_id, g.public_label, g.target_km, i.code, i.public_name, i.status;

revoke all on public.inventory_operations_overview from anon;
grant select on public.inventory_operations_overview to authenticated;

commit;
