begin;

create or replace function public.try_reserve_inventory_for_registration(
  target_registration_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg public.registrations%rowtype;
  item_id uuid;
  physical_balance bigint;
  reserved_quantity bigint;
begin
  select * into reg
  from public.registrations
  where id = target_registration_id
  for update;

  if not found or reg.status not in ('CONFIRMED','COMPLETED') then
    return false;
  end if;

  if exists (
    select 1
    from public.inventory_reservations r
    where r.registration_id = target_registration_id
      and r.status = 'RESERVED'
  ) then
    return true;
  end if;

  select i.id into item_id
  from public.inventory_items i
  where i.challenge_id = reg.challenge_id
    and i.goal_id = reg.goal_id
    and i.status = 'ACTIVE'
  order by i.created_at
  limit 1
  for update;

  if item_id is null then
    return false;
  end if;

  select coalesce(sum(m.quantity),0)::bigint into physical_balance
  from public.inventory_movements m
  where m.inventory_item_id = item_id;

  select coalesce(sum(r.quantity),0)::bigint into reserved_quantity
  from public.inventory_reservations r
  where r.inventory_item_id = item_id
    and r.status = 'RESERVED';

  if physical_balance - reserved_quantity < 1 then
    return false;
  end if;

  insert into public.inventory_reservations (
    registration_id,
    inventory_item_id,
    quantity,
    status,
    notes
  ) values (
    target_registration_id,
    item_id,
    1,
    'RESERVED',
    'Reserva automática após confirmação da inscrição'
  )
  on conflict (registration_id) do nothing;

  return exists (
    select 1
    from public.inventory_reservations r
    where r.registration_id = target_registration_id
      and r.status = 'RESERVED'
  );
end;
$$;

revoke all on function public.try_reserve_inventory_for_registration(uuid) from public;
revoke all on function public.try_reserve_inventory_for_registration(uuid) from anon;

commit;
