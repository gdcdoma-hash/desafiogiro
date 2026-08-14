begin;

create or replace function public.receive_medal_order(p_medal_order_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.medal_orders%rowtype;
  item_row record;
  inventory_item_id uuid;
  inventory_item_status text;
  received_items integer := 0;
begin
  if not public.has_permission('inventory.manage') then
    raise exception 'Permission denied';
  end if;

  select * into order_row
  from public.medal_orders
  where id = p_medal_order_id
  for update;

  if order_row.id is null then
    raise exception 'Medal order not found';
  end if;

  if order_row.status = 'RECEIVED' then
    raise exception 'Medal order already received';
  end if;

  if order_row.status <> 'ORDERED' then
    raise exception 'Only ordered medal orders can be received';
  end if;

  for item_row in
    select i.id, i.goal_id, i.quantity, g.target_km
    from public.medal_order_items i
    join public.challenge_goals g on g.id = i.goal_id
    where i.medal_order_id = order_row.id
    order by g.display_order, g.target_km
  loop
    inventory_item_id := null;
    inventory_item_status := null;

    select ii.id, ii.status
    into inventory_item_id, inventory_item_status
    from public.inventory_items ii
    where ii.challenge_id = order_row.challenge_id
      and ii.goal_id = item_row.goal_id
    order by case when ii.status = 'ACTIVE' then 0 else 1 end, ii.created_at
    limit 1
    for update;

    if inventory_item_id is null then
      insert into public.inventory_items (
        challenge_id,
        goal_id,
        code,
        public_name,
        notes
      ) values (
        order_row.challenge_id,
        item_row.goal_id,
        'MEDAL-' || replace(item_row.goal_id::text, '-', ''),
        'Medalha ' || item_row.target_km::text || ' km',
        'Item criado automaticamente no recebimento do pedido ' || order_row.order_reference
      )
      returning id into inventory_item_id;
    elsif inventory_item_status <> 'ACTIVE' then
      update public.inventory_items
      set status = 'ACTIVE'
      where id = inventory_item_id;
    end if;

    if exists (
      select 1
      from public.inventory_movements m
      where m.inventory_item_id = inventory_item_id
        and m.movement_type = 'IN'
        and m.reason_code = 'MEDAL_ORDER_RECEIPT'
        and m.reference_type = 'MEDAL_ORDER'
        and m.reference_id = order_row.id
    ) then
      raise exception 'Medal order receipt already recorded for inventory item';
    end if;

    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason_code,
      reference_type,
      reference_id,
      notes
    ) values (
      inventory_item_id,
      'IN',
      item_row.quantity,
      'MEDAL_ORDER_RECEIPT',
      'MEDAL_ORDER',
      order_row.id,
      'Entrada automática pelo recebimento do pedido ' || order_row.order_reference
    );

    received_items := received_items + item_row.quantity;
  end loop;

  if received_items = 0 then
    raise exception 'Medal order has no items';
  end if;

  update public.medal_orders
  set status = 'RECEIVED', received_at = now()
  where id = order_row.id;

  perform public.reconcile_confirmed_inventory_reservations(order_row.challenge_id);

  return received_items;
end;
$$;

revoke all on function public.receive_medal_order(uuid) from public;
revoke all on function public.receive_medal_order(uuid) from anon;
grant execute on function public.receive_medal_order(uuid) to authenticated;

commit;
