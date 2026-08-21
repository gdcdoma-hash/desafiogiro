create table if not exists public.participant_registration_category_rules (
  category_code text primary key check (category_code ~ '^[A-Z][A-Z0-9_]*$'),
  max_items integer not null check (max_items > 0),
  reserve_on_add boolean not null default false,
  reservation_minutes integer not null default 60 check (reservation_minutes between 10 and 1440),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.participant_registration_category_rules
  (category_code, max_items, reserve_on_add, reservation_minutes, is_active)
values
  ('NORMAL', 1, false, 60, true),
  ('REPESCAGEM', 3, true, 60, true),
  ('TESTE_FLUXO', 3, true, 60, true)
on conflict (category_code) do nothing;

alter table public.participant_registration_category_rules enable row level security;
revoke all on table public.participant_registration_category_rules from anon, authenticated;

create table if not exists public.participant_pix_keys (
  registration_count integer primary key check (registration_count between 1 and 20),
  pix_key text not null check (length(trim(pix_key)) > 0),
  pix_holder text not null check (length(trim(pix_holder)) > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.participant_pix_keys
  (registration_count, pix_key, pix_holder, is_active)
values
  (1, 'PIX-DEV-QTD-1-NAO-PAGAR', 'Portal Giro - ambiente de desenvolvimento', true),
  (2, 'PIX-DEV-QTD-2-NAO-PAGAR', 'Portal Giro - ambiente de desenvolvimento', true),
  (3, 'PIX-DEV-QTD-3-NAO-PAGAR', 'Portal Giro - ambiente de desenvolvimento', true),
  (4, 'PIX-DEV-QTD-4-NAO-PAGAR', 'Portal Giro - ambiente de desenvolvimento', true)
on conflict (registration_count) do nothing;

alter table public.participant_pix_keys enable row level security;
revoke all on table public.participant_pix_keys from anon, authenticated;

create table if not exists public.participant_checkouts (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','CONFIRMED','CANCELLED','EXPIRED')),
  item_count integer not null default 0 check (item_count >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  pix_key_snapshot text,
  pix_holder_snapshot text,
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status <> 'SUBMITTED') or submitted_at is not null),
  check ((status <> 'CONFIRMED') or confirmed_at is not null)
);

create unique index if not exists participant_checkouts_one_draft_per_participant
  on public.participant_checkouts(participant_id)
  where status = 'DRAFT';

alter table public.participant_checkouts enable row level security;
revoke all on table public.participant_checkouts from anon, authenticated;

alter table public.registrations
  add column if not exists checkout_id uuid references public.participant_checkouts(id) on delete restrict;

create index if not exists registrations_checkout_id_idx
  on public.registrations(checkout_id)
  where checkout_id is not null;

create table if not exists public.participant_checkout_media (
  id uuid primary key default gen_random_uuid(),
  checkout_id uuid not null references public.participant_checkouts(id) on delete cascade,
  kind text not null check (kind in ('AVATAR','PAYMENT_PROOF')),
  object_path text not null,
  mime_type text not null,
  original_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkout_id, kind)
);

alter table public.participant_checkout_media enable row level security;
revoke all on table public.participant_checkout_media from anon, authenticated;

create or replace function public.expire_participant_checkouts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer := 0;
begin
  with targets as (
    select c.id
    from public.participant_checkouts c
    where c.status = 'DRAFT'
      and c.expires_at <= now()
    for update skip locked
  ), released as (
    update public.inventory_reservations ir
       set status = 'RELEASED',
           released_at = now(),
           updated_at = now(),
           notes = trim(concat_ws(E'\n', nullif(ir.notes,''), 'Reserva liberada por expiração do checkout.'))
     where ir.status = 'RESERVED'
       and ir.registration_id in (
         select r.id
         from public.registrations r
         join targets t on t.id = r.checkout_id
       )
    returning ir.id
  ), expired_registrations as (
    update public.registrations r
       set status = 'EXPIRED',
           updated_at = now(),
           notes = trim(concat_ws(E'\n', nullif(r.notes,''), 'Inscrição expirada junto com o checkout.'))
     where r.status = 'PENDING'
       and r.checkout_id in (select id from targets)
    returning r.id
  )
  update public.participant_checkouts c
     set status = 'EXPIRED',
         updated_at = now()
   where c.id in (select id from targets);

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_participant_checkouts() from public, anon, authenticated;

create or replace function public.recalculate_participant_checkout(target_checkout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  checkout_status text;
  checkout_count integer;
  checkout_total numeric(12,2) := 0;
  pix_key_value text;
  pix_holder_value text;
  row_item record;
begin
  select c.status into checkout_status
  from public.participant_checkouts c
  where c.id = target_checkout_id
  for update;

  if checkout_status is null then
    raise exception 'Checkout not found';
  end if;

  if checkout_status <> 'DRAFT' then
    return;
  end if;

  select count(*)::integer into checkout_count
  from public.registrations r
  where r.checkout_id = target_checkout_id
    and r.status = 'PENDING';

  if checkout_count = 0 then
    update public.participant_checkouts
       set item_count = 0,
           total_amount = 0,
           pix_key_snapshot = null,
           pix_holder_snapshot = null,
           updated_at = now()
     where id = target_checkout_id;
    return;
  end if;

  select k.pix_key, k.pix_holder
    into pix_key_value, pix_holder_value
  from public.participant_pix_keys k
  where k.registration_count = checkout_count
    and k.is_active = true;

  if pix_key_value is null then
    raise exception 'No active PIX key configured for % registrations', checkout_count;
  end if;

  for row_item in
    select r.id, r.offer_id
    from public.registrations r
    where r.checkout_id = target_checkout_id
      and r.status = 'PENDING'
    order by r.created_at, r.id
  loop
    update public.registrations r
       set price_snapshot = public.resolve_challenge_offer_unit_price(row_item.offer_id, checkout_count, now()),
           updated_at = now()
     where r.id = row_item.id;
  end loop;

  select coalesce(sum(r.price_snapshot),0)::numeric(12,2)
    into checkout_total
  from public.registrations r
  where r.checkout_id = target_checkout_id
    and r.status = 'PENDING';

  update public.participant_checkouts
     set item_count = checkout_count,
         total_amount = checkout_total,
         pix_key_snapshot = pix_key_value,
         pix_holder_snapshot = pix_holder_value,
         updated_at = now()
   where id = target_checkout_id;
end;
$$;

revoke all on function public.recalculate_participant_checkout(uuid) from public, anon, authenticated;

create or replace function public.get_participant_checkout_state(target_checkout_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
  checkout_row public.participant_checkouts%rowtype;
  result_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.expire_participant_checkouts();

  select l.participant_id into linked_participant_id
  from public.participant_user_links l
  join public.participants p on p.id = l.participant_id and p.status = 'ACTIVE'
  where l.user_id = auth.uid();

  if linked_participant_id is null then
    raise exception 'Participant account is not linked';
  end if;

  if target_checkout_id is not null then
    select * into checkout_row
    from public.participant_checkouts c
    where c.id = target_checkout_id
      and c.participant_id = linked_participant_id;
  else
    select * into checkout_row
    from public.participant_checkouts c
    where c.participant_id = linked_participant_id
      and c.status = 'DRAFT'
    order by c.created_at desc
    limit 1;
  end if;

  if checkout_row.id is null then
    insert into public.participant_checkouts (participant_id, status, expires_at)
    values (linked_participant_id, 'DRAFT', now() + interval '60 minutes')
    returning * into checkout_row;
  end if;

  if checkout_row.status = 'DRAFT' then
    perform public.recalculate_participant_checkout(checkout_row.id);
    select * into checkout_row from public.participant_checkouts where id = checkout_row.id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'registration_id', r.id,
    'offer_id', r.offer_id,
    'challenge_id', r.challenge_id,
    'challenge_name', c.public_name,
    'goal_id', r.goal_id,
    'goal_label', coalesce(g.public_label, g.target_km::text || ' km'),
    'target_km', g.target_km,
    'category_code', o.category_code,
    'price', r.price_snapshot,
    'reservation_status', ir.status,
    'inventory_item_id', ir.inventory_item_id
  ) order by r.created_at, r.id), '[]'::jsonb)
  into result_items
  from public.registrations r
  join public.challenges c on c.id = r.challenge_id
  join public.challenge_goals g on g.id = r.goal_id
  join public.challenge_offers o on o.id = r.offer_id
  left join public.inventory_reservations ir on ir.registration_id = r.id and ir.status = 'RESERVED'
  where r.checkout_id = checkout_row.id
    and r.status = 'PENDING';

  return jsonb_build_object(
    'checkout_id', checkout_row.id,
    'status', checkout_row.status,
    'item_count', checkout_row.item_count,
    'total_amount', checkout_row.total_amount,
    'pix_key', checkout_row.pix_key_snapshot,
    'pix_holder', checkout_row.pix_holder_snapshot,
    'expires_at', checkout_row.expires_at,
    'items', result_items
  );
end;
$$;

revoke all on function public.get_participant_checkout_state(uuid) from public, anon;
grant execute on function public.get_participant_checkout_state(uuid) to authenticated;

create or replace function public.get_participant_checkout_catalog()
returns table (
  challenge_id uuid,
  challenge_name text,
  short_description text,
  reference_year smallint,
  reference_month smallint,
  offer_id uuid,
  offer_name text,
  category_code text,
  price numeric,
  goal_id uuid,
  goal_label text,
  target_km integer,
  display_order integer,
  reserve_on_add boolean,
  available_balance bigint,
  category_limit integer,
  category_used integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with linked as (
    select l.participant_id
    from public.participant_user_links l
    join public.participants p on p.id = l.participant_id and p.status = 'ACTIVE'
    where l.user_id = auth.uid()
    limit 1
  ), catalog as (
    select pc.*,
           coalesce(rule.max_items, o.max_per_participant) as category_limit,
           coalesce(rule.reserve_on_add, false) as reserve_on_add
    from public.public_registration_catalog pc
    join public.challenge_offers o on o.id = pc.offer_id
    left join public.participant_registration_category_rules rule
      on rule.category_code = pc.category_code and rule.is_active = true
  )
  select
    cat.challenge_id,
    cat.challenge_name,
    cat.short_description,
    cat.reference_year,
    cat.reference_month,
    cat.offer_id,
    cat.offer_name,
    cat.category_code,
    public.resolve_challenge_offer_unit_price(cat.offer_id, 1, now()) as price,
    cat.goal_id,
    cat.goal_label,
    cat.target_km,
    cat.display_order,
    cat.reserve_on_add,
    coalesce(av.available_balance, 0) as available_balance,
    cat.category_limit,
    (
      select count(*)::integer
      from public.registrations r
      join public.challenge_offers ro on ro.id = r.offer_id
      cross join linked lp
      where r.participant_id = lp.participant_id
        and ro.category_code = cat.category_code
        and r.status not in ('CANCELLED','EXPIRED')
    ) as category_used
  from catalog cat
  cross join linked lp
  left join public.inventory_availability av
    on av.challenge_id = cat.challenge_id and av.goal_id = cat.goal_id
  where (
    select count(*)
    from public.registrations r
    where r.participant_id = lp.participant_id
      and r.offer_id = cat.offer_id
      and r.status not in ('CANCELLED','EXPIRED')
  ) < (
    select o.max_per_participant from public.challenge_offers o where o.id = cat.offer_id
  )
  and (
    select count(*)
    from public.registrations r
    join public.challenge_offers ro on ro.id = r.offer_id
    where r.participant_id = lp.participant_id
      and ro.category_code = cat.category_code
      and r.status not in ('CANCELLED','EXPIRED')
  ) < cat.category_limit
  and (cat.reserve_on_add = false or coalesce(av.available_balance, 0) > 0)
  order by cat.reference_year desc, cat.reference_month desc, cat.display_order asc;
$$;

revoke all on function public.get_participant_checkout_catalog() from public, anon;
grant execute on function public.get_participant_checkout_catalog() to authenticated;

create or replace function public.add_participant_checkout_item(
  target_checkout_id uuid,
  target_offer_id uuid,
  target_goal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
  checkout_row public.participant_checkouts%rowtype;
  offer_row public.challenge_offers%rowtype;
  target_challenge_id uuid;
  target_limit integer;
  reserve_now boolean;
  hold_minutes integer;
  category_used integer;
  offer_used integer;
  next_occurrence integer;
  new_registration_id uuid;
  item_id uuid;
  physical_balance bigint;
  reserved_quantity bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_participant_checkouts();

  select l.participant_id into linked_participant_id
  from public.participant_user_links l
  join public.participants p on p.id = l.participant_id and p.status = 'ACTIVE'
  where l.user_id = auth.uid();
  if linked_participant_id is null then raise exception 'Participant account is not linked'; end if;

  select * into checkout_row
  from public.participant_checkouts c
  where c.id = target_checkout_id
    and c.participant_id = linked_participant_id
    and c.status = 'DRAFT'
  for update;
  if checkout_row.id is null then raise exception 'Checkout is not available'; end if;

  select o.* into offer_row
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = target_offer_id
    and o.status = 'OPEN'
    and c.is_public = true
    and c.status in ('SCHEDULED','ACTIVE')
    and now() >= o.registration_starts_at
    and now() < o.registration_ends_at;
  if offer_row.id is null then raise exception 'Offer is not available'; end if;
  target_challenge_id := offer_row.challenge_id;

  if not exists (
    select 1 from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = target_offer_id and cog.goal_id = target_goal_id
      and g.challenge_id = target_challenge_id and g.is_active = true
  ) then raise exception 'Goal is not available'; end if;

  select coalesce(rule.max_items, offer_row.max_per_participant),
         coalesce(rule.reserve_on_add, false),
         coalesce(rule.reservation_minutes, 60)
    into target_limit, reserve_now, hold_minutes
  from (select 1) x
  left join public.participant_registration_category_rules rule
    on rule.category_code = offer_row.category_code and rule.is_active = true;

  select count(*)::integer into category_used
  from public.registrations r
  join public.challenge_offers ro on ro.id = r.offer_id
  where r.participant_id = linked_participant_id
    and ro.category_code = offer_row.category_code
    and r.status not in ('CANCELLED','EXPIRED');
  if category_used >= target_limit then raise exception 'Category registration limit reached'; end if;

  select count(*)::integer into offer_used
  from public.registrations r
  where r.participant_id = linked_participant_id
    and r.offer_id = target_offer_id
    and r.status not in ('CANCELLED','EXPIRED');
  if offer_used >= offer_row.max_per_participant then raise exception 'Offer registration limit reached'; end if;

  if exists (
    select 1 from public.registrations r
    where r.checkout_id = target_checkout_id and r.status = 'PENDING'
      and r.offer_id = target_offer_id and r.goal_id = target_goal_id
  ) then raise exception 'This item is already in the checkout'; end if;

  select coalesce(max(r.occurrence_number),0)+1 into next_occurrence
  from public.registrations r
  where r.participant_id = linked_participant_id and r.offer_id = target_offer_id;

  insert into public.registrations (
    participant_id, challenge_id, goal_id, offer_id, occurrence_number,
    price_snapshot, status, source_code, notes, checkout_id
  ) values (
    linked_participant_id, target_challenge_id, target_goal_id, target_offer_id, next_occurrence,
    public.resolve_challenge_offer_unit_price(target_offer_id, 1, now()),
    'PENDING','PARTICIPANT','Item adicionado ao checkout do participante.',target_checkout_id
  ) returning id into new_registration_id;

  if reserve_now then
    select i.id into item_id
    from public.inventory_items i
    where i.challenge_id = target_challenge_id
      and i.goal_id = target_goal_id
      and i.status = 'ACTIVE'
    order by i.created_at
    limit 1
    for update;
    if item_id is null then raise exception 'Medal inventory is not configured'; end if;

    select coalesce(sum(m.quantity),0)::bigint into physical_balance
    from public.inventory_movements m where m.inventory_item_id = item_id;
    select coalesce(sum(ir.quantity),0)::bigint into reserved_quantity
    from public.inventory_reservations ir where ir.inventory_item_id = item_id and ir.status = 'RESERVED';
    if physical_balance - reserved_quantity < 1 then raise exception 'Medal is no longer available'; end if;

    insert into public.inventory_reservations
      (registration_id, inventory_item_id, quantity, status, notes)
    values
      (new_registration_id, item_id, 1, 'RESERVED', 'Reserva temporária criada ao adicionar item no checkout.');
  end if;

  update public.participant_checkouts
     set expires_at = greatest(expires_at, now() + make_interval(mins => hold_minutes)),
         updated_at = now()
   where id = target_checkout_id;

  perform public.recalculate_participant_checkout(target_checkout_id);
  return public.get_participant_checkout_state(target_checkout_id);
end;
$$;

revoke all on function public.add_participant_checkout_item(uuid,uuid,uuid) from public, anon;
grant execute on function public.add_participant_checkout_item(uuid,uuid,uuid) to authenticated;

create or replace function public.remove_participant_checkout_item(
  target_checkout_id uuid,
  target_registration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select l.participant_id into linked_participant_id
  from public.participant_user_links l where l.user_id = auth.uid();

  if not exists (
    select 1 from public.participant_checkouts c
    where c.id = target_checkout_id and c.participant_id = linked_participant_id and c.status = 'DRAFT'
    for update
  ) then raise exception 'Checkout is not available'; end if;

  if not exists (
    select 1 from public.registrations r
    where r.id = target_registration_id and r.checkout_id = target_checkout_id and r.status = 'PENDING'
    for update
  ) then raise exception 'Checkout item not found'; end if;

  update public.inventory_reservations
     set status = 'RELEASED', released_at = now(), updated_at = now(),
         notes = trim(concat_ws(E'\n', nullif(notes,''), 'Reserva liberada após remoção do checkout.'))
   where registration_id = target_registration_id and status = 'RESERVED';

  update public.registrations
     set status = 'CANCELLED', updated_at = now(),
         notes = trim(concat_ws(E'\n', nullif(notes,''), 'Item removido do checkout pelo participante.'))
   where id = target_registration_id;

  perform public.recalculate_participant_checkout(target_checkout_id);
  return public.get_participant_checkout_state(target_checkout_id);
end;
$$;

revoke all on function public.remove_participant_checkout_item(uuid,uuid) from public, anon;
grant execute on function public.remove_participant_checkout_item(uuid,uuid) to authenticated;

create or replace function public.swap_participant_checkout_item(
  target_checkout_id uuid,
  target_registration_id uuid,
  target_offer_id uuid,
  target_goal_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
  old_registration public.registrations%rowtype;
  old_offer public.challenge_offers%rowtype;
  new_offer public.challenge_offers%rowtype;
  target_limit integer;
  reserve_now boolean;
  category_used integer;
  offer_used integer;
  next_occurrence integer;
  new_item_id uuid;
  current_item_id uuid;
  physical_balance bigint;
  reserved_quantity bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_participant_checkouts();

  select l.participant_id into linked_participant_id
  from public.participant_user_links l where l.user_id = auth.uid();

  if not exists (
    select 1 from public.participant_checkouts c
    where c.id = target_checkout_id and c.participant_id = linked_participant_id and c.status = 'DRAFT'
    for update
  ) then raise exception 'Checkout is not available'; end if;

  select * into old_registration
  from public.registrations r
  where r.id = target_registration_id and r.checkout_id = target_checkout_id and r.status = 'PENDING'
  for update;
  if old_registration.id is null then raise exception 'Checkout item not found'; end if;
  select * into old_offer from public.challenge_offers where id = old_registration.offer_id;

  select o.* into new_offer
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = target_offer_id and o.status = 'OPEN' and c.is_public = true
    and c.status in ('SCHEDULED','ACTIVE')
    and now() >= o.registration_starts_at and now() < o.registration_ends_at;
  if new_offer.id is null then raise exception 'New offer is not available'; end if;

  if not exists (
    select 1 from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = target_offer_id and cog.goal_id = target_goal_id
      and g.challenge_id = new_offer.challenge_id and g.is_active = true
  ) then raise exception 'New goal is not available'; end if;

  select coalesce(rule.max_items, new_offer.max_per_participant), coalesce(rule.reserve_on_add,false)
    into target_limit, reserve_now
  from (select 1) x
  left join public.participant_registration_category_rules rule
    on rule.category_code = new_offer.category_code and rule.is_active = true;

  select count(*)::integer into category_used
  from public.registrations r
  join public.challenge_offers ro on ro.id = r.offer_id
  where r.participant_id = linked_participant_id
    and r.id <> target_registration_id
    and ro.category_code = new_offer.category_code
    and r.status not in ('CANCELLED','EXPIRED');
  if category_used >= target_limit then raise exception 'Category registration limit reached'; end if;

  select count(*)::integer into offer_used
  from public.registrations r
  where r.participant_id = linked_participant_id
    and r.id <> target_registration_id
    and r.offer_id = target_offer_id
    and r.status not in ('CANCELLED','EXPIRED');
  if offer_used >= new_offer.max_per_participant then raise exception 'Offer registration limit reached'; end if;

  if exists (
    select 1 from public.registrations r
    where r.checkout_id = target_checkout_id and r.status = 'PENDING'
      and r.id <> target_registration_id
      and r.offer_id = target_offer_id and r.goal_id = target_goal_id
  ) then raise exception 'This item is already in the checkout'; end if;

  select ir.inventory_item_id into current_item_id
  from public.inventory_reservations ir
  where ir.registration_id = target_registration_id and ir.status = 'RESERVED'
  for update;

  if reserve_now then
    select i.id into new_item_id
    from public.inventory_items i
    where i.challenge_id = new_offer.challenge_id and i.goal_id = target_goal_id and i.status = 'ACTIVE'
    order by i.created_at limit 1 for update;
    if new_item_id is null then raise exception 'Medal inventory is not configured'; end if;

    if current_item_id is distinct from new_item_id then
      select coalesce(sum(m.quantity),0)::bigint into physical_balance
      from public.inventory_movements m where m.inventory_item_id = new_item_id;
      select coalesce(sum(ir.quantity),0)::bigint into reserved_quantity
      from public.inventory_reservations ir where ir.inventory_item_id = new_item_id and ir.status = 'RESERVED';
      if physical_balance - reserved_quantity < 1 then raise exception 'Requested medal is not available; current selection was preserved'; end if;
    end if;
  end if;

  select coalesce(max(r.occurrence_number),0)+1 into next_occurrence
  from public.registrations r
  where r.participant_id = linked_participant_id and r.offer_id = target_offer_id and r.id <> target_registration_id;

  if reserve_now then
    if current_item_id is null then
      insert into public.inventory_reservations
        (registration_id, inventory_item_id, quantity, status, notes)
      values
        (target_registration_id, new_item_id, 1, 'RESERVED', 'Reserva criada durante troca segura do checkout.');
    elsif current_item_id is distinct from new_item_id then
      update public.inventory_reservations
         set inventory_item_id = new_item_id,
             updated_at = now(),
             notes = trim(concat_ws(E'\n', nullif(notes,''), 'Reserva transferida atomicamente durante troca de item.'))
       where registration_id = target_registration_id and status = 'RESERVED';
    end if;
  elsif current_item_id is not null then
    update public.inventory_reservations
       set status = 'RELEASED', released_at = now(), updated_at = now(),
           notes = trim(concat_ws(E'\n', nullif(notes,''), 'Reserva liberada após troca para categoria sem reserva antecipada.'))
     where registration_id = target_registration_id and status = 'RESERVED';
  end if;

  update public.registrations
     set challenge_id = new_offer.challenge_id,
         goal_id = target_goal_id,
         offer_id = target_offer_id,
         occurrence_number = next_occurrence,
         updated_at = now(),
         notes = trim(concat_ws(E'\n', nullif(notes,''), 'Item alterado de forma segura pelo participante.'))
   where id = target_registration_id;

  perform public.recalculate_participant_checkout(target_checkout_id);
  return public.get_participant_checkout_state(target_checkout_id);
end;
$$;

revoke all on function public.swap_participant_checkout_item(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.swap_participant_checkout_item(uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.attach_participant_checkout_media(
  target_checkout_id uuid,
  target_kind text,
  target_object_path text,
  target_mime_type text,
  target_original_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_kind not in ('AVATAR','PAYMENT_PROOF') then raise exception 'Invalid media kind'; end if;
  select l.participant_id into linked_participant_id from public.participant_user_links l where l.user_id = auth.uid();
  if not exists (
    select 1 from public.participant_checkouts c
    where c.id = target_checkout_id and c.participant_id = linked_participant_id and c.status = 'DRAFT'
  ) then raise exception 'Checkout is not available for media upload'; end if;
  if split_part(target_object_path,'/',1) <> auth.uid()::text then raise exception 'Invalid object path'; end if;

  insert into public.participant_checkout_media
    (checkout_id,kind,object_path,mime_type,original_name)
  values
    (target_checkout_id,target_kind,target_object_path,target_mime_type,target_original_name)
  on conflict (checkout_id,kind) do update set
    object_path = excluded.object_path,
    mime_type = excluded.mime_type,
    original_name = excluded.original_name,
    updated_at = now();
end;
$$;

revoke all on function public.attach_participant_checkout_media(uuid,text,text,text,text) from public, anon;
grant execute on function public.attach_participant_checkout_media(uuid,text,text,text,text) to authenticated;

create or replace function public.submit_participant_checkout(target_checkout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
  checkout_row public.participant_checkouts%rowtype;
  media_avatar public.participant_checkout_media%rowtype;
  media_proof public.participant_checkout_media%rowtype;
  reg record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select l.participant_id into linked_participant_id from public.participant_user_links l where l.user_id = auth.uid();

  select * into checkout_row
  from public.participant_checkouts c
  where c.id = target_checkout_id and c.participant_id = linked_participant_id and c.status = 'DRAFT'
  for update;
  if checkout_row.id is null then raise exception 'Checkout is not available'; end if;

  perform public.recalculate_participant_checkout(target_checkout_id);
  select * into checkout_row from public.participant_checkouts where id = target_checkout_id;
  if checkout_row.item_count < 1 then raise exception 'Checkout has no registrations'; end if;

  select * into media_avatar from public.participant_checkout_media where checkout_id = target_checkout_id and kind = 'AVATAR';
  select * into media_proof from public.participant_checkout_media where checkout_id = target_checkout_id and kind = 'PAYMENT_PROOF';
  if media_avatar.id is null then raise exception 'Avatar photo is required'; end if;
  if media_proof.id is null then raise exception 'Payment proof is required'; end if;

  for reg in
    select r.* from public.registrations r
    where r.checkout_id = target_checkout_id and r.status = 'PENDING'
    order by r.created_at, r.id
  loop
    if not exists (select 1 from public.registration_payments p where p.registration_id = reg.id and p.status = 'PENDING') then
      insert into public.registration_payments
        (registration_id,amount,method_code,status,external_reference,notes)
      values
        (reg.id,reg.price_snapshot,'PIX','PENDING','PARTICIPANT_CHECKOUT:' || target_checkout_id::text,
         'Pagamento faz parte de checkout com ' || checkout_row.item_count::text || ' inscrições. Total PIX: ' || checkout_row.total_amount::text);
    end if;

    insert into public.registration_media
      (registration_id,kind,object_path,mime_type,original_name)
    values
      (reg.id,'AVATAR',media_avatar.object_path,media_avatar.mime_type,media_avatar.original_name)
    on conflict (registration_id,kind) do update set
      object_path=excluded.object_path,mime_type=excluded.mime_type,original_name=excluded.original_name,updated_at=now();

    insert into public.registration_media
      (registration_id,kind,object_path,mime_type,original_name)
    values
      (reg.id,'PAYMENT_PROOF',media_proof.object_path,media_proof.mime_type,media_proof.original_name)
    on conflict (registration_id,kind) do update set
      object_path=excluded.object_path,mime_type=excluded.mime_type,original_name=excluded.original_name,updated_at=now();
  end loop;

  update public.participant_checkouts
     set status='SUBMITTED',submitted_at=now(),updated_at=now()
   where id=target_checkout_id;

  return public.get_participant_checkout_state(target_checkout_id);
end;
$$;

revoke all on function public.submit_participant_checkout(uuid) from public, anon;
grant execute on function public.submit_participant_checkout(uuid) to authenticated;

create or replace function public.confirm_participant_checkout_payment(target_checkout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg record;
begin
  if not public.has_permission('payments.manage') then
    raise exception 'Permissão insuficiente para confirmar pagamento';
  end if;

  if not exists (
    select 1 from public.participant_checkouts c
    where c.id = target_checkout_id and c.status = 'SUBMITTED'
    for update
  ) then raise exception 'Checkout is not awaiting confirmation'; end if;

  for reg in
    select r.id from public.registrations r
    where r.checkout_id = target_checkout_id and r.status = 'PENDING'
    order by r.created_at, r.id
  loop
    if not exists (
      select 1 from public.inventory_reservations ir
      where ir.registration_id = reg.id and ir.status = 'RESERVED'
    ) then
      update public.registrations set status='CONFIRMED',updated_at=now() where id=reg.id;
      if not public.try_reserve_inventory_for_registration(reg.id) then
        raise exception 'Estoque insuficiente para confirmar todas as inscrições do checkout';
      end if;
    else
      update public.registrations set status='CONFIRMED',updated_at=now() where id=reg.id;
    end if;
  end loop;

  update public.registration_payments p
     set status='CONFIRMED',paid_at=now(),updated_at=now(),
         notes=trim(concat_ws(E'\n',nullif(p.notes,''),'Pagamento do checkout confirmado administrativamente.'))
   where p.registration_id in (select r.id from public.registrations r where r.checkout_id=target_checkout_id)
     and p.status='PENDING';

  update public.participant_checkouts
     set status='CONFIRMED',confirmed_at=now(),updated_at=now()
   where id=target_checkout_id;
end;
$$;

revoke all on function public.confirm_participant_checkout_payment(uuid) from public, anon;
grant execute on function public.confirm_participant_checkout_payment(uuid) to authenticated;
