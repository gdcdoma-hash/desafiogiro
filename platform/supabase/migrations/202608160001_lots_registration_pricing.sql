begin;

create or replace function public.resolve_challenge_offer_unit_price(
  target_offer_id uuid,
  target_registration_count integer default 1,
  target_at timestamptz default now()
)
returns numeric(12,2)
language plpgsql
stable
set search_path = ''
as $$
declare
  offer_mode text;
  fixed_price numeric(12,2);
  best_specificity integer;
  match_count integer;
  resolved_price numeric(12,2);
begin
  if target_registration_count is null or target_registration_count <= 0 then
    raise exception 'Registration count must be positive for price resolution';
  end if;

  select o.pricing_mode, o.price
    into offer_mode, fixed_price
  from public.challenge_offers o
  where o.id = target_offer_id;

  if offer_mode is null then
    raise exception 'Offer not found for price resolution';
  end if;

  if offer_mode = 'FIXED' then
    if fixed_price is null then
      raise exception 'Fixed-price offer has no price';
    end if;
    return fixed_price;
  end if;

  with eligible as (
    select
      lot.id,
      lot.unit_price,
      case
        when lot.selection_mode = 'REGISTRATION_COUNT'
          and lot.registration_count = target_registration_count then 0
        when lot.selection_mode = 'ANY' then 1
        else 2
      end as specificity
    from public.challenge_offer_price_lots lot
    where lot.status = 'ACTIVE'
      and lot.offer_id = target_offer_id
      and lot.starts_at <= target_at
      and (lot.ends_at is null or target_at <= lot.ends_at)
      and (
        (lot.selection_mode = 'REGISTRATION_COUNT'
          and lot.registration_count = target_registration_count)
        or lot.selection_mode = 'ANY'
      )

    union all

    select
      lot.id,
      lot.unit_price,
      case
        when lot.selection_mode = 'REGISTRATION_COUNT'
          and lot.registration_count = target_registration_count then 0
        when lot.selection_mode = 'ANY' then 1
        else 2
      end as specificity
    from public.challenge_pricing_group_offers link
    join public.challenge_offer_price_lots lot
      on lot.pricing_group_id = link.pricing_group_id
    where link.offer_id = target_offer_id
      and lot.status = 'ACTIVE'
      and lot.starts_at <= target_at
      and (lot.ends_at is null or target_at <= lot.ends_at)
      and (
        (lot.selection_mode = 'REGISTRATION_COUNT'
          and lot.registration_count = target_registration_count)
        or lot.selection_mode = 'ANY'
      )
  ), best as (
    select min(specificity) as specificity
    from eligible
  )
  select count(*)::integer, min(eligible.unit_price), min(best.specificity)
    into match_count, resolved_price, best_specificity
  from eligible
  cross join best
  where eligible.specificity = best.specificity;

  if match_count = 0 or best_specificity is null then
    raise exception 'No active price lot matches this offer and registration count';
  end if;

  if match_count > 1 then
    raise exception 'Ambiguous active price lots match this offer and registration count';
  end if;

  return resolved_price;
end;
$$;

revoke all on function public.resolve_challenge_offer_unit_price(uuid, integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.resolve_challenge_offer_unit_price(uuid, integer, timestamptz)
  to authenticated;

create or replace function public.validate_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_challenge uuid;
  goal_challenge uuid;
  offer_price numeric(12,2);
  offer_pricing_mode text;
  offer_limit integer;
  existing_count integer;
begin
  select challenge_id, price, pricing_mode, max_per_participant
    into offer_challenge, offer_price, offer_pricing_mode, offer_limit
  from public.challenge_offers
  where id = new.offer_id;

  select challenge_id into goal_challenge
  from public.challenge_goals
  where id = new.goal_id;

  if offer_challenge is null or goal_challenge is null then
    raise exception 'Registration references an unknown offer or goal';
  end if;

  if new.challenge_id <> offer_challenge or new.challenge_id <> goal_challenge then
    raise exception 'Registration offer and goal must belong to its challenge';
  end if;

  if not exists (
    select 1 from public.challenge_offer_goals cog
    where cog.offer_id = new.offer_id and cog.goal_id = new.goal_id
  ) then
    raise exception 'Registration goal is not enabled for this offer';
  end if;

  if tg_op = 'INSERT' then
    if offer_pricing_mode = 'FIXED' then
      new.price_snapshot := offer_price;
    elsif offer_pricing_mode = 'LOTS' and new.price_snapshot is null then
      new.price_snapshot := public.resolve_challenge_offer_unit_price(
        new.offer_id,
        1,
        now()
      );
    end if;

    if new.price_snapshot is null or new.price_snapshot < 0 then
      raise exception 'Registration requires a valid price snapshot';
    end if;

    select count(*) into existing_count
    from public.registrations r
    where r.participant_id = new.participant_id
      and r.offer_id = new.offer_id
      and r.status not in ('CANCELLED','EXPIRED');

    if existing_count >= offer_limit then
      raise exception 'Participant reached the registration limit for this offer';
    end if;
  else
    if new.participant_id <> old.participant_id
      or new.challenge_id <> old.challenge_id
      or new.goal_id <> old.goal_id
      or new.offer_id <> old.offer_id
      or new.occurrence_number <> old.occurrence_number
      or new.price_snapshot <> old.price_snapshot then
      raise exception 'Registration structural fields are immutable after creation';
    end if;
  end if;

  return new;
end;
$$;

create or replace view public.public_registration_catalog
with (security_invoker = true)
as
select
  c.id as challenge_id,
  c.code as challenge_code,
  c.public_name as challenge_name,
  c.short_description,
  c.reference_year,
  c.reference_month,
  c.sports_starts_at,
  c.sports_ends_at,
  c.timezone,
  o.id as offer_id,
  o.public_name as offer_name,
  o.category_code,
  o.registration_starts_at,
  o.registration_ends_at,
  (case
    when o.pricing_mode = 'FIXED' then o.price
    else public.resolve_challenge_offer_unit_price(o.id, 1, now())
  end)::numeric(12,2) as price,
  o.max_per_participant,
  g.id as goal_id,
  g.target_km,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_label,
  g.display_order,
  o.pricing_mode
from public.challenges c
join public.challenge_offers o on o.challenge_id = c.id
join public.challenge_offer_goals og on og.offer_id = o.id
join public.challenge_goals g on g.id = og.goal_id
where c.is_public = true
  and c.status in ('SCHEDULED','ACTIVE')
  and o.status = 'OPEN'
  and g.is_active = true
  and now() >= o.registration_starts_at
  and now() < o.registration_ends_at;

create or replace function public.process_public_registration_request(
  target_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.public_registration_requests%rowtype;
  target_challenge_id uuid;
  target_price numeric(12,2);
  found_participant_id uuid;
  participant_matches integer;
  new_registration_id uuid;
  new_payment_id uuid;
  next_occurrence integer;
begin
  if not public.has_permission('public_registrations.manage')
    or not public.has_permission('registrations.manage')
    or not public.has_permission('payments.manage') then
    raise exception 'Permissão insuficiente para processar a solicitação';
  end if;

  select * into req
  from public.public_registration_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;

  if req.status <> 'RECEIVED' then
    raise exception 'Solicitação já processada ou rejeitada';
  end if;

  select o.challenge_id,
         public.resolve_challenge_offer_unit_price(o.id, 1, now())
    into target_challenge_id, target_price
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = req.offer_id
    and c.is_public = true
    and c.status in ('SCHEDULED','ACTIVE')
    and o.status = 'OPEN'
    and now() >= o.registration_starts_at
    and now() < o.registration_ends_at;

  if target_challenge_id is null then
    raise exception 'Oferta não está mais disponível para inscrição';
  end if;

  if target_price <= 0 then
    raise exception 'Oferta sem cobrança deve ser tratada pelo fluxo de isenção';
  end if;

  if not exists (
    select 1
    from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = req.offer_id
      and cog.goal_id = req.goal_id
      and g.challenge_id = target_challenge_id
      and g.is_active = true
  ) then
    raise exception 'Meta não está mais disponível para esta oferta';
  end if;

  select count(*)::integer
    into participant_matches
  from public.participants p
  where p.phone_e164 = req.phone_e164
    and p.status = 'ACTIVE';

  if participant_matches > 1 then
    raise exception 'Há mais de um participante ativo com este telefone; revisão manual necessária';
  end if;

  if participant_matches = 1 then
    select p.id
      into found_participant_id
    from public.participants p
    where p.phone_e164 = req.phone_e164
      and p.status = 'ACTIVE'
    order by p.created_at, p.id
    limit 1;
  else
    insert into public.participants (
      full_name, phone_e164, city, state_code, notes
    ) values (
      req.full_name,
      req.phone_e164,
      req.city,
      req.state_code,
      'Criado a partir da pré-inscrição pública ' || req.id::text
    ) returning id into found_participant_id;
  end if;

  select coalesce(max(r.occurrence_number), 0) + 1
    into next_occurrence
  from public.registrations r
  where r.participant_id = found_participant_id
    and r.offer_id = req.offer_id;

  insert into public.registrations (
    participant_id,
    challenge_id,
    goal_id,
    offer_id,
    occurrence_number,
    price_snapshot,
    status,
    source_code,
    notes
  ) values (
    found_participant_id,
    target_challenge_id,
    req.goal_id,
    req.offer_id,
    next_occurrence,
    target_price,
    'PENDING',
    'PUBLIC',
    case when req.referral_code is null then '' else 'REF=' || req.referral_code end
  ) returning id, price_snapshot into new_registration_id, target_price;

  insert into public.registration_payments (
    registration_id,
    amount,
    method_code,
    status,
    external_reference,
    notes
  ) values (
    new_registration_id,
    target_price,
    'PIX',
    'PENDING',
    'PUBLIC_REQUEST:' || req.id::text,
    'Pagamento pendente originado da pré-inscrição pública'
  ) returning id into new_payment_id;

  update public.public_registration_requests
  set status = 'PROCESSED',
      processed_at = now(),
      participant_id = found_participant_id,
      registration_id = new_registration_id
  where id = req.id;

  return jsonb_build_object(
    'request_id', req.id,
    'participant_id', found_participant_id,
    'registration_id', new_registration_id,
    'payment_id', new_payment_id,
    'registration_status', 'PENDING',
    'payment_status', 'PENDING',
    'medal_reserved', false
  );
end;
$$;

revoke all on function public.process_public_registration_request(uuid)
  from public, anon, authenticated;
grant execute on function public.process_public_registration_request(uuid)
  to authenticated;

commit;
