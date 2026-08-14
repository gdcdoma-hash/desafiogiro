begin;

create or replace function public.guard_medal_order_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  item_count integer;
begin
  if old.status = 'RECEIVED' and new.status <> 'RECEIVED' then
    raise exception 'Received medal orders cannot change status';
  end if;

  if old.status = 'CANCELLED' and new.status <> 'CANCELLED' then
    raise exception 'Cancelled medal orders cannot be reopened';
  end if;

  if old.status = 'DRAFT' and new.status not in ('DRAFT','ORDERED','CANCELLED') then
    raise exception 'Invalid medal order transition from DRAFT';
  end if;

  if old.status = 'ORDERED' and new.status not in ('ORDERED','RECEIVED','CANCELLED') then
    raise exception 'Invalid medal order transition from ORDERED';
  end if;

  if old.status <> 'DRAFT' and new.challenge_id <> old.challenge_id then
    raise exception 'Challenge cannot be changed after medal order leaves draft';
  end if;

  if old.status = 'DRAFT' and new.status = 'ORDERED' then
    select count(*) into item_count
    from public.medal_order_items
    where medal_order_id = old.id;

    if item_count = 0 then
      raise exception 'Medal order must have at least one item before it can be ordered';
    end if;
  end if;

  return new;
end;
$$;

create trigger medal_orders_lifecycle_guard
before update on public.medal_orders
for each row execute function public.guard_medal_order_lifecycle();

create or replace function public.guard_medal_order_item_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_order_id uuid;
  order_status text;
begin
  target_order_id := case when tg_op = 'DELETE' then old.medal_order_id else new.medal_order_id end;

  select status into order_status
  from public.medal_orders
  where id = target_order_id
  for update;

  if order_status is null then
    raise exception 'Medal order not found';
  end if;

  if order_status <> 'DRAFT' then
    raise exception 'Medal order items can only be changed while the order is in DRAFT';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger medal_order_items_change_guard
before insert or update or delete on public.medal_order_items
for each row execute function public.guard_medal_order_item_changes();

commit;
