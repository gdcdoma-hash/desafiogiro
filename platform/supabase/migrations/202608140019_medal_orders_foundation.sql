begin;

create table public.medal_orders (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  order_reference text not null,
  supplier_name text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','ORDERED','RECEIVED','CANCELLED')),
  ordered_at timestamptz,
  expected_at timestamptz,
  received_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, order_reference),
  check ((status = 'DRAFT' and ordered_at is null and received_at is null)
      or (status = 'ORDERED' and ordered_at is not null and received_at is null)
      or (status = 'RECEIVED' and ordered_at is not null and received_at is not null)
      or (status = 'CANCELLED' and received_at is null))
);

create table public.medal_order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  medal_order_id uuid not null references public.medal_orders(id) on delete cascade,
  goal_id uuid not null references public.challenge_goals(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medal_order_id, goal_id)
);

create index medal_orders_challenge_idx on public.medal_orders(challenge_id, status, created_at desc);
create index medal_order_items_order_idx on public.medal_order_items(medal_order_id);
create index medal_order_items_goal_idx on public.medal_order_items(goal_id);

create or replace function public.validate_medal_order_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  order_challenge uuid;
  goal_challenge uuid;
begin
  select challenge_id into order_challenge
  from public.medal_orders
  where id = new.medal_order_id;

  select challenge_id into goal_challenge
  from public.challenge_goals
  where id = new.goal_id;

  if order_challenge is null or goal_challenge is null or order_challenge <> goal_challenge then
    raise exception 'Medal order goal must belong to the order challenge';
  end if;

  return new;
end;
$$;

create trigger medal_order_items_validate
before insert or update on public.medal_order_items
for each row execute function public.validate_medal_order_item();

create trigger medal_orders_set_updated_at
before update on public.medal_orders
for each row execute function public.set_updated_at();

create trigger medal_order_items_set_updated_at
before update on public.medal_order_items
for each row execute function public.set_updated_at();

create or replace view public.medal_orders_overview
with (security_invoker = true)
as
select
  o.id as medal_order_id,
  o.challenge_id,
  c.code as challenge_code,
  c.public_name as challenge_name,
  o.order_reference,
  o.supplier_name,
  o.status,
  o.ordered_at,
  o.expected_at,
  o.received_at,
  o.notes,
  o.created_at,
  coalesce(items.item_count, 0)::bigint as item_count,
  coalesce(items.total_quantity, 0)::bigint as total_quantity
from public.medal_orders o
join public.challenges c on c.id = o.challenge_id
left join lateral (
  select count(*) as item_count, coalesce(sum(i.quantity), 0) as total_quantity
  from public.medal_order_items i
  where i.medal_order_id = o.id
) items on true;

alter table public.medal_orders enable row level security;
alter table public.medal_order_items enable row level security;

create policy medal_orders_admin_read
on public.medal_orders for select to authenticated
using (public.has_permission('inventory.read'));
create policy medal_orders_admin_insert
on public.medal_orders for insert to authenticated
with check (public.has_permission('inventory.manage'));
create policy medal_orders_admin_update
on public.medal_orders for update to authenticated
using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));

create policy medal_order_items_admin_read
on public.medal_order_items for select to authenticated
using (public.has_permission('inventory.read'));
create policy medal_order_items_admin_insert
on public.medal_order_items for insert to authenticated
with check (public.has_permission('inventory.manage'));
create policy medal_order_items_admin_update
on public.medal_order_items for update to authenticated
using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));
create policy medal_order_items_admin_delete
on public.medal_order_items for delete to authenticated
using (public.has_permission('inventory.manage'));

revoke all on public.medal_orders from anon;
revoke all on public.medal_order_items from anon;
revoke all on public.medal_orders_overview from anon;
grant select, insert, update on public.medal_orders to authenticated;
grant select, insert, update, delete on public.medal_order_items to authenticated;
grant select on public.medal_orders_overview to authenticated;

commit;
