begin;

create or replace function public.create_suggested_medal_order(
  p_challenge_id uuid,
  p_order_reference text,
  p_supplier_name text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_order_id uuid;
  suggested_total bigint;
begin
  if not public.has_permission('inventory.manage') then
    raise exception 'Permission denied';
  end if;

  if p_challenge_id is null then
    raise exception 'Challenge is required';
  end if;

  if nullif(btrim(p_order_reference), '') is null then
    raise exception 'Order reference is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_challenge_id::text)::bigint);

  select coalesce(sum(p.suggested_purchase_quantity), 0)::bigint
  into suggested_total
  from public.medal_purchase_planning p
  where p.challenge_id = p_challenge_id
    and p.suggested_purchase_quantity > 0;

  if suggested_total <= 0 then
    raise exception 'No additional medal purchase is currently suggested for this challenge';
  end if;

  insert into public.medal_orders (
    challenge_id,
    order_reference,
    supplier_name
  ) values (
    p_challenge_id,
    btrim(p_order_reference),
    coalesce(btrim(p_supplier_name), '')
  )
  returning id into new_order_id;

  insert into public.medal_order_items (
    medal_order_id,
    goal_id,
    quantity
  )
  select
    new_order_id,
    p.goal_id,
    p.suggested_purchase_quantity::integer
  from public.medal_purchase_planning p
  where p.challenge_id = p_challenge_id
    and p.suggested_purchase_quantity > 0
  order by p.target_km, p.goal_id;

  if not exists (
    select 1
    from public.medal_order_items i
    where i.medal_order_id = new_order_id
  ) then
    raise exception 'No medal order items were created';
  end if;

  return new_order_id;
end;
$$;

revoke all on function public.create_suggested_medal_order(uuid, text, text) from public;
revoke all on function public.create_suggested_medal_order(uuid, text, text) from anon;
grant execute on function public.create_suggested_medal_order(uuid, text, text) to authenticated;

commit;
