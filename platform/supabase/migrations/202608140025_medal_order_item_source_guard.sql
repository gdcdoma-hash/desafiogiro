begin;

create or replace function public.guard_medal_order_item_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  source_status text;
  target_status text;
begin
  if tg_op = 'INSERT' then
    select status into target_status
    from public.medal_orders
    where id = new.medal_order_id
    for update;

    if target_status is null then
      raise exception 'Medal order not found';
    end if;

    if target_status <> 'DRAFT' then
      raise exception 'Medal order items can only be changed while the order is in DRAFT';
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    select status into source_status
    from public.medal_orders
    where id = old.medal_order_id
    for update;

    if source_status is null then
      raise exception 'Medal order not found';
    end if;

    if source_status <> 'DRAFT' then
      raise exception 'Medal order items can only be changed while the order is in DRAFT';
    end if;

    return old;
  end if;

  select status into source_status
  from public.medal_orders
  where id = old.medal_order_id
  for update;

  if source_status is null then
    raise exception 'Source medal order not found';
  end if;

  if source_status <> 'DRAFT' then
    raise exception 'Items cannot be moved or changed from a medal order that is not in DRAFT';
  end if;

  if new.medal_order_id = old.medal_order_id then
    return new;
  end if;

  select status into target_status
  from public.medal_orders
  where id = new.medal_order_id
  for update;

  if target_status is null then
    raise exception 'Target medal order not found';
  end if;

  if target_status <> 'DRAFT' then
    raise exception 'Items can only be moved to a medal order in DRAFT';
  end if;

  return new;
end;
$$;

commit;
