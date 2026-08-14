begin;

alter table public.medal_orders
  add constraint medal_orders_reference_nonblank
  check (btrim(order_reference) <> '');

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

  if new.challenge_id <> old.challenge_id then
    select count(*) into item_count
    from public.medal_order_items
    where medal_order_id = old.id;

    if item_count > 0 then
      raise exception 'Challenge cannot be changed while the medal order has items';
    end if;
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

create or replace function public.guard_goal_challenge_for_medal_orders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.challenge_id = old.challenge_id then
    return new;
  end if;

  if exists (
    select 1
    from public.medal_order_items i
    where i.goal_id = old.id
  ) then
    raise exception 'Challenge cannot be changed for a goal referenced by a medal order';
  end if;

  return new;
end;
$$;

create trigger challenge_goals_medal_order_guard
before update of challenge_id on public.challenge_goals
for each row execute function public.guard_goal_challenge_for_medal_orders();

commit;
