begin;

create table public.inventory_reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  status text not null default 'RESERVED' check (status in ('RESERVED','RELEASED','FULFILLED')),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  fulfilled_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'RESERVED' and released_at is null and fulfilled_at is null)
      or (status = 'RELEASED' and released_at is not null and fulfilled_at is null)
      or (status = 'FULFILLED' and fulfilled_at is not null and released_at is null))
);

create index inventory_reservations_item_idx on public.inventory_reservations(inventory_item_id, status);

create trigger inventory_reservations_set_updated_at
before update on public.inventory_reservations
for each row execute function public.set_updated_at();

create or replace view public.inventory_availability
with (security_invoker = true)
as
select i.id as inventory_item_id, i.challenge_id, i.goal_id, i.code, i.public_name, i.status,
  coalesce((select sum(m.quantity) from public.inventory_movements m where m.inventory_item_id=i.id),0)::bigint as physical_balance,
  coalesce((select sum(r.quantity) from public.inventory_reservations r where r.inventory_item_id=i.id and r.status='RESERVED'),0)::bigint as reserved_quantity,
  (coalesce((select sum(m.quantity) from public.inventory_movements m where m.inventory_item_id=i.id),0)
   - coalesce((select sum(r.quantity) from public.inventory_reservations r where r.inventory_item_id=i.id and r.status='RESERVED'),0))::bigint as available_balance
from public.inventory_items i;

create or replace function public.apply_confirmed_payment_to_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reg public.registrations%rowtype;
  confirmed_total numeric(12,2);
  item_id uuid;
  physical_balance bigint;
  reserved_quantity bigint;
begin
  if new.status <> 'CONFIRMED' or (tg_op='UPDATE' and old.status='CONFIRMED') then return new; end if;

  select * into reg from public.registrations where id=new.registration_id for update;
  if reg.status <> 'PENDING' then return new; end if;

  select coalesce(sum(amount),0)::numeric(12,2) into confirmed_total
  from public.registration_payments where registration_id=new.registration_id and status='CONFIRMED';
  if confirmed_total < reg.price_snapshot then return new; end if;

  select id into item_id from public.inventory_items
  where challenge_id=reg.challenge_id and goal_id=reg.goal_id and status='ACTIVE'
  order by created_at limit 1 for update;
  if item_id is null then raise exception 'No active inventory item is configured for this registration goal'; end if;

  select coalesce(sum(quantity),0)::bigint into physical_balance from public.inventory_movements where inventory_item_id=item_id;
  select coalesce(sum(quantity),0)::bigint into reserved_quantity from public.inventory_reservations where inventory_item_id=item_id and status='RESERVED';
  if physical_balance-reserved_quantity < 1 then raise exception 'No inventory available to reserve for this registration'; end if;

  insert into public.inventory_reservations(registration_id,inventory_item_id) values(new.registration_id,item_id)
  on conflict(registration_id) do nothing;

  update public.registrations set status='CONFIRMED' where id=new.registration_id and status='PENDING';
  return new;
end;
$$;

create trigger registration_payments_apply_confirmation
after insert or update on public.registration_payments
for each row execute function public.apply_confirmed_payment_to_registration();

create or replace function public.release_inventory_reservation_on_registration_cancel()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status='CANCELLED' and old.status<>'CANCELLED' then
    update public.inventory_reservations set status='RELEASED',released_at=now()
    where registration_id=new.id and status='RESERVED';
  end if;
  return new;
end;
$$;

create trigger registrations_release_reservation_on_cancel
before update on public.registrations
for each row execute function public.release_inventory_reservation_on_registration_cancel();

alter table public.inventory_reservations enable row level security;
create policy inventory_reservations_admin_read on public.inventory_reservations for select to authenticated using (public.has_permission('inventory.read'));
revoke all on public.inventory_reservations from anon;
revoke all on public.inventory_availability from anon;
grant select on public.inventory_reservations to authenticated;
grant select on public.inventory_availability to authenticated;

commit;
