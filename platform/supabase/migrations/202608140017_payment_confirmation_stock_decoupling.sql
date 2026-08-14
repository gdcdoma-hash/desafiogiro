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
  if exists (
    select 1
    from public.inventory_reservations r
    where r.registration_id = target_registration_id
      and r.status = 'RESERVED'
  ) then
    return true;
  end if;

  select * into reg
  from public.registrations
  where id = target_registration_id;

  if not found or reg.status not in ('CONFIRMED','COMPLETED') then
    return false;
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

create or replace function public.apply_confirmed_payment_to_registration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg public.registrations%rowtype;
  confirmed_total numeric(12,2);
begin
  if new.status <> 'CONFIRMED'
    or (tg_op = 'UPDATE' and old.status = 'CONFIRMED') then
    return new;
  end if;

  select * into reg
  from public.registrations
  where id = new.registration_id
  for update;

  if reg.status <> 'PENDING' then
    return new;
  end if;

  select coalesce(sum(amount),0)::numeric(12,2)
    into confirmed_total
  from public.registration_payments
  where registration_id = new.registration_id
    and status = 'CONFIRMED';

  if confirmed_total < reg.price_snapshot then
    return new;
  end if;

  update public.registrations
  set status = 'CONFIRMED'
  where id = new.registration_id
    and status = 'PENDING';

  perform public.try_reserve_inventory_for_registration(new.registration_id);

  return new;
end;
$$;

create or replace function public.reconcile_confirmed_inventory_reservations(
  target_challenge_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg record;
  reserved_count integer := 0;
begin
  if not public.has_permission('inventory.manage') then
    raise exception 'Permissão insuficiente para reconciliar reservas de estoque';
  end if;

  for reg in
    select r.id
    from public.registrations r
    where r.challenge_id = target_challenge_id
      and r.status in ('CONFIRMED','COMPLETED')
      and not exists (
        select 1
        from public.inventory_reservations ir
        where ir.registration_id = r.id
          and ir.status = 'RESERVED'
      )
    order by r.created_at, r.id
  loop
    if public.try_reserve_inventory_for_registration(reg.id) then
      reserved_count := reserved_count + 1;
    end if;
  end loop;

  return reserved_count;
end;
$$;

revoke all on function public.try_reserve_inventory_for_registration(uuid) from public;
revoke all on function public.apply_confirmed_payment_to_registration() from public;
revoke all on function public.reconcile_confirmed_inventory_reservations(uuid) from public;
grant execute on function public.reconcile_confirmed_inventory_reservations(uuid) to authenticated;

commit;
