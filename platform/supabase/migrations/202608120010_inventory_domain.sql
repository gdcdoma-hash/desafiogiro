begin;

insert into public.app_permissions (code, description) values
  ('inventory.read', 'Consultar estoque'),
  ('inventory.manage', 'Gerenciar estoque')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('inventory.read', 'inventory.manage')
on conflict do nothing;

create table public.inventory_items (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  goal_id uuid references public.challenge_goals(id) on delete restrict,
  code text not null,
  public_name text not null,
  unit_code text not null default 'UNIT' check (unit_code in ('UNIT')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, code)
);

create table public.inventory_movements (
  id uuid primary key default extensions.gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_type text not null check (movement_type in ('IN','OUT','ADJUSTMENT')),
  quantity integer not null check (quantity <> 0),
  reason_code text not null default 'MANUAL' check (reason_code ~ '^[A-Z][A-Z0-9_]*$'),
  reference_type text,
  reference_id uuid,
  notes text not null default '',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((movement_type = 'IN' and quantity > 0)
      or (movement_type = 'OUT' and quantity < 0)
      or movement_type = 'ADJUSTMENT')
);

create index inventory_items_challenge_idx on public.inventory_items(challenge_id, status);
create index inventory_items_goal_idx on public.inventory_items(goal_id) where goal_id is not null;
create index inventory_movements_item_idx on public.inventory_movements(inventory_item_id, occurred_at desc);
create index inventory_movements_reference_idx on public.inventory_movements(reference_type, reference_id)
  where reference_type is not null and reference_id is not null;

create or replace function public.validate_inventory_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  goal_challenge uuid;
begin
  if new.goal_id is not null then
    select challenge_id into goal_challenge
    from public.challenge_goals
    where id = new.goal_id;

    if goal_challenge is null or goal_challenge <> new.challenge_id then
      raise exception 'Inventory goal must belong to its challenge';
    end if;
  end if;
  return new;
end;
$$;

create trigger inventory_items_validate
before insert or update on public.inventory_items
for each row execute function public.validate_inventory_item();

create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create or replace view public.inventory_balances
with (security_invoker = true)
as
select
  i.id as inventory_item_id,
  i.challenge_id,
  i.goal_id,
  i.code,
  i.public_name,
  i.status,
  coalesce(sum(m.quantity), 0)::bigint as balance
from public.inventory_items i
left join public.inventory_movements m on m.inventory_item_id = i.id
group by i.id, i.challenge_id, i.goal_id, i.code, i.public_name, i.status;

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy inventory_items_admin_read
on public.inventory_items for select to authenticated
using (public.has_permission('inventory.read'));
create policy inventory_items_admin_insert
on public.inventory_items for insert to authenticated
with check (public.has_permission('inventory.manage'));
create policy inventory_items_admin_update
on public.inventory_items for update to authenticated
using (public.has_permission('inventory.manage'))
with check (public.has_permission('inventory.manage'));

create policy inventory_movements_admin_read
on public.inventory_movements for select to authenticated
using (public.has_permission('inventory.read'));
create policy inventory_movements_admin_insert
on public.inventory_movements for insert to authenticated
with check (public.has_permission('inventory.manage'));

revoke all on public.inventory_items from anon;
revoke all on public.inventory_movements from anon;
revoke all on public.inventory_balances from anon;
grant select, insert, update on public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select on public.inventory_balances to authenticated;

commit;
