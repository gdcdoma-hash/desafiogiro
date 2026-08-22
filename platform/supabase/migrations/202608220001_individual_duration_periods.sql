alter table public.challenges
  add column if not exists participant_start_opens_on date,
  add column if not exists participant_start_closes_on date;

alter table public.challenges
  drop constraint if exists challenges_participant_start_window_check,
  add constraint challenges_participant_start_window_check
    check (
      (goal_mode = 'DISTANCE_KM'
        and participant_start_opens_on is null
        and participant_start_closes_on is null)
      or
      (goal_mode = 'DURATION_DAYS'
        and participant_start_opens_on is not null
        and participant_start_closes_on is not null
        and participant_start_closes_on >= participant_start_opens_on)
    );

comment on column public.challenges.participant_start_opens_on is
  'Primeiro dia em que um participante pode iniciar um desafio com prazo individual.';
comment on column public.challenges.participant_start_closes_on is
  'Ultimo dia em que um participante pode iniciar um desafio com prazo individual.';

comment on column public.registrations.planned_starts_at is
  'Inicio efetivo da janela individual. Em desafios por dias, parte da data escolhida pelo participante; em desafios por km, replica o periodo global.';
comment on column public.registrations.planned_ends_at is
  'Fim exclusivo da janela individual. Atividades futuras devem usar started_at >= planned_starts_at e started_at < planned_ends_at.';

create or replace function public.sync_duration_challenge_envelope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_days integer;
  zone_name text;
begin
  if new.goal_mode = 'DURATION_DAYS' then
    if new.participant_start_opens_on is null or new.participant_start_closes_on is null then
      raise exception 'Informe a janela permitida para início dos participantes';
    end if;

    select coalesce(max(g.duration_days), 1)
      into max_days
    from public.challenge_goals g
    where g.challenge_id = new.id
      and g.is_active = true
      and g.duration_days is not null;

    zone_name := coalesce(nullif(new.timezone, ''), 'America/Fortaleza');
    new.sports_starts_at := new.participant_start_opens_on::timestamp at time zone zone_name;
    new.sports_ends_at := (new.participant_start_closes_on + max_days)::timestamp at time zone zone_name;
  else
    new.participant_start_opens_on := null;
    new.participant_start_closes_on := null;
  end if;
  return new;
end;
$$;

drop trigger if exists challenges_sync_duration_envelope on public.challenges;
create trigger challenges_sync_duration_envelope
before insert or update of goal_mode, participant_start_opens_on, participant_start_closes_on, timezone
on public.challenges
for each row execute function public.sync_duration_challenge_envelope();

create or replace function public.refresh_duration_challenge_envelope()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  challenge_key uuid;
  max_days integer;
  c record;
begin
  challenge_key := coalesce(new.challenge_id, old.challenge_id);
  select id, goal_mode, participant_start_opens_on, participant_start_closes_on, timezone
    into c
  from public.challenges
  where id = challenge_key;

  if c.id is null or c.goal_mode <> 'DURATION_DAYS' then
    return coalesce(new, old);
  end if;

  select coalesce(max(g.duration_days) filter (where g.is_active), 1)
    into max_days
  from public.challenge_goals g
  where g.challenge_id = challenge_key
    and g.duration_days is not null;

  update public.challenges
     set sports_starts_at = c.participant_start_opens_on::timestamp at time zone coalesce(nullif(c.timezone,''),'America/Fortaleza'),
         sports_ends_at = (c.participant_start_closes_on + max_days)::timestamp at time zone coalesce(nullif(c.timezone,''),'America/Fortaleza'),
         updated_at = now()
   where id = challenge_key;

  return coalesce(new, old);
end;
$$;

drop trigger if exists challenge_goals_refresh_duration_envelope on public.challenge_goals;
create trigger challenge_goals_refresh_duration_envelope
after insert or update of duration_days, is_active or delete
on public.challenge_goals
for each row execute function public.refresh_duration_challenge_envelope();

create or replace function public.apply_registration_activity_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c record;
  g record;
  chosen_start date;
  today_local date;
  earliest_start date;
  zone_name text;
begin
  select goal_mode, sports_starts_at, sports_ends_at,
         participant_start_opens_on, participant_start_closes_on, timezone
    into c
  from public.challenges
  where id = new.challenge_id;

  select duration_days into g
  from public.challenge_goals
  where id = new.goal_id
    and challenge_id = new.challenge_id;

  if c.goal_mode = 'DURATION_DAYS' then
    if g.duration_days is null then
      raise exception 'Prazo em dias não configurado para esta meta';
    end if;
    zone_name := coalesce(nullif(c.timezone,''), 'America/Fortaleza');
    today_local := (now() at time zone zone_name)::date;
    earliest_start := greatest(c.participant_start_opens_on, today_local);
    chosen_start := coalesce((new.planned_starts_at at time zone zone_name)::date, earliest_start);

    if chosen_start < earliest_start then
      raise exception 'A data de início não pode ser anterior a %', earliest_start;
    end if;
    if chosen_start > c.participant_start_closes_on then
      raise exception 'A data de início não pode ser posterior a %', c.participant_start_closes_on;
    end if;

    new.planned_starts_at := chosen_start::timestamp at time zone zone_name;
    new.planned_ends_at := (chosen_start + g.duration_days)::timestamp at time zone zone_name;
  else
    new.planned_starts_at := c.sports_starts_at;
    new.planned_ends_at := c.sports_ends_at;
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_apply_activity_period on public.registrations;
create trigger registrations_apply_activity_period
before insert or update of challenge_id, goal_id, planned_starts_at
on public.registrations
for each row execute function public.apply_registration_activity_period();

update public.registrations r
   set planned_starts_at = c.sports_starts_at,
       planned_ends_at = c.sports_ends_at
  from public.challenges c
 where c.id = r.challenge_id
   and c.goal_mode = 'DISTANCE_KM'
   and (r.planned_starts_at is null or r.planned_ends_at is null);

create or replace function public.set_participant_checkout_start_date(
  target_checkout_id uuid,
  target_registration_id uuid,
  target_start_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
  challenge_mode text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select l.participant_id into linked_participant_id
  from public.participant_user_links l
  where l.user_id = auth.uid();

  if not exists (
    select 1
    from public.participant_checkouts c
    where c.id = target_checkout_id
      and c.participant_id = linked_participant_id
      and c.status = 'DRAFT'
    for update
  ) then raise exception 'Checkout is not available'; end if;

  select c.goal_mode into challenge_mode
  from public.registrations r
  join public.challenges c on c.id = r.challenge_id
  where r.id = target_registration_id
    and r.checkout_id = target_checkout_id
    and r.participant_id = linked_participant_id
    and r.status = 'PENDING'
  for update of r;

  if challenge_mode is null then raise exception 'Checkout item not found'; end if;
  if challenge_mode <> 'DURATION_DAYS' then raise exception 'This challenge uses a fixed global period'; end if;
  if target_start_on is null then raise exception 'Start date is required'; end if;

  update public.registrations
     set planned_starts_at = target_start_on::timestamp,
         updated_at = now()
   where id = target_registration_id;

  return public.get_participant_checkout_state(target_checkout_id);
end;
$$;

revoke all on function public.set_participant_checkout_start_date(uuid,uuid,date) from public, anon;
grant execute on function public.set_participant_checkout_start_date(uuid,uuid,date) to authenticated;

create or replace function public.add_participant_checkout_item_scheduled(
  target_checkout_id uuid,
  target_offer_id uuid,
  target_goal_id uuid,
  target_start_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_state jsonb;
  new_registration_id uuid;
  challenge_mode text;
begin
  result_state := public.add_participant_checkout_item(target_checkout_id, target_offer_id, target_goal_id);

  select r.id, c.goal_mode
    into new_registration_id, challenge_mode
  from public.registrations r
  join public.challenges c on c.id = r.challenge_id
  where r.checkout_id = target_checkout_id
    and r.offer_id = target_offer_id
    and r.goal_id = target_goal_id
    and r.status = 'PENDING'
  order by r.created_at desc, r.id desc
  limit 1;

  if challenge_mode = 'DURATION_DAYS' and target_start_on is not null then
    return public.set_participant_checkout_start_date(target_checkout_id, new_registration_id, target_start_on);
  end if;
  return result_state;
end;
$$;

revoke all on function public.add_participant_checkout_item_scheduled(uuid,uuid,uuid,date) from public, anon;
grant execute on function public.add_participant_checkout_item_scheduled(uuid,uuid,uuid,date) to authenticated;

create or replace function public.swap_participant_checkout_item_scheduled(
  target_checkout_id uuid,
  target_registration_id uuid,
  target_offer_id uuid,
  target_goal_id uuid,
  target_start_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_state jsonb;
  challenge_mode text;
begin
  result_state := public.swap_participant_checkout_item(
    target_checkout_id,
    target_registration_id,
    target_offer_id,
    target_goal_id
  );

  select c.goal_mode into challenge_mode
  from public.registrations r
  join public.challenges c on c.id = r.challenge_id
  where r.id = target_registration_id;

  if challenge_mode = 'DURATION_DAYS' and target_start_on is not null then
    return public.set_participant_checkout_start_date(target_checkout_id, target_registration_id, target_start_on);
  end if;
  return result_state;
end;
$$;

revoke all on function public.swap_participant_checkout_item_scheduled(uuid,uuid,uuid,uuid,date) from public, anon;
grant execute on function public.swap_participant_checkout_item_scheduled(uuid,uuid,uuid,uuid,date) to authenticated;

create or replace function public.validate_duration_checkout_submission()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'SUBMITTED' and old.status = 'DRAFT' and exists (
    select 1
    from public.registrations r
    join public.challenges c on c.id = r.challenge_id
    where r.checkout_id = new.id
      and r.status = 'PENDING'
      and c.goal_mode = 'DURATION_DAYS'
      and (r.planned_starts_at is null or r.planned_ends_at is null)
  ) then
    raise exception 'Defina a data de início de todos os desafios por prazo antes de enviar';
  end if;
  return new;
end;
$$;

drop trigger if exists participant_checkouts_validate_duration_submission on public.participant_checkouts;
create trigger participant_checkouts_validate_duration_submission
before update of status on public.participant_checkouts
for each row execute function public.validate_duration_checkout_submission();

drop function if exists public.get_participant_checkout_catalog();
create function public.get_participant_checkout_catalog()
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
  category_used integer,
  medal_image_path text,
  goal_mode text,
  duration_days integer,
  participant_start_opens_on date,
  participant_start_closes_on date
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
  ), current_checkout as (
    select c.id
    from public.participant_checkouts c
    cross join linked lp
    where c.participant_id = lp.participant_id
      and c.status = 'DRAFT'
    order by c.created_at desc
    limit 1
  ), prospective as (
    select coalesce((
      select count(*)::integer
      from public.registrations r
      join current_checkout cc on cc.id = r.checkout_id
      where r.status = 'PENDING'
    ), 0) + 1 as registration_count
  ), catalog as (
    select pc.*,
           c.medal_image_path,
           c.goal_mode,
           c.participant_start_opens_on,
           c.participant_start_closes_on,
           g.duration_days,
           coalesce(rule.max_items, o.max_per_participant) as category_limit,
           coalesce(rule.reserve_on_add, false) as reserve_on_add
    from public.public_registration_catalog pc
    join public.challenge_offers o on o.id = pc.offer_id
    join public.challenges c on c.id = pc.challenge_id
    join public.challenge_goals g on g.id = pc.goal_id
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
    public.resolve_challenge_offer_unit_price(cat.offer_id, prospective.registration_count, now()) as price,
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
      cross join linked lp2
      left join current_checkout cc2 on true
      where r.participant_id = lp2.participant_id
        and ro.category_code = cat.category_code
        and r.status not in ('CANCELLED','EXPIRED')
        and (cc2.id is null or r.checkout_id is distinct from cc2.id)
    ) as category_used,
    cat.medal_image_path,
    cat.goal_mode,
    cat.duration_days,
    cat.participant_start_opens_on,
    cat.participant_start_closes_on
  from catalog cat
  cross join linked lp
  cross join prospective
  left join current_checkout cc on true
  left join public.inventory_availability av
    on av.challenge_id = cat.challenge_id and av.goal_id = cat.goal_id
  where not exists (
    select 1
    from public.registrations r
    where r.participant_id = lp.participant_id
      and r.challenge_id = cat.challenge_id
      and r.status not in ('CANCELLED','EXPIRED')
      and (cc.id is null or r.checkout_id is distinct from cc.id)
  )
  and (
    select count(*)
    from public.registrations r
    where r.participant_id = lp.participant_id
      and r.offer_id = cat.offer_id
      and r.status not in ('CANCELLED','EXPIRED')
      and (cc.id is null or r.checkout_id is distinct from cc.id)
  ) < (
    select o.max_per_participant
    from public.challenge_offers o
    where o.id = cat.offer_id
  )
  and (cat.reserve_on_add = false or coalesce(av.available_balance, 0) > 0)
  order by cat.reference_year desc, cat.reference_month desc, cat.display_order asc;
$$;

revoke all on function public.get_participant_checkout_catalog() from public, anon;
grant execute on function public.get_participant_checkout_catalog() to authenticated;

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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform public.expire_participant_checkouts();

  select l.participant_id into linked_participant_id
  from public.participant_user_links l
  join public.participants p on p.id = l.participant_id and p.status = 'ACTIVE'
  where l.user_id = auth.uid();
  if linked_participant_id is null then raise exception 'Participant account is not linked'; end if;

  if target_checkout_id is not null then
    select * into checkout_row
    from public.participant_checkouts c
    where c.id = target_checkout_id and c.participant_id = linked_participant_id;
  else
    select * into checkout_row
    from public.participant_checkouts c
    where c.participant_id = linked_participant_id and c.status = 'DRAFT'
    order by c.created_at desc limit 1;
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
    'goal_mode', c.goal_mode,
    'duration_days', g.duration_days,
    'planned_starts_at', r.planned_starts_at,
    'planned_ends_at', r.planned_ends_at,
    'participant_start_opens_on', c.participant_start_opens_on,
    'participant_start_closes_on', c.participant_start_closes_on,
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