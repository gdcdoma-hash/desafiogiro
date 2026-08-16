begin;

create or replace function public.migration_insert_or_verify_challenge_offer(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_id_desafio_lista text,
  p_legacy_challenge_key text,
  p_internal_name text,
  p_public_name text,
  p_category_code text,
  p_registration_starts_at timestamptz,
  p_registration_ends_at timestamptz,
  p_pricing_mode text,
  p_price numeric,
  p_max_per_participant integer,
  p_priority integer,
  p_status text,
  p_rules jsonb
)
returns table(offer_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_uuid uuid;
  existing public.challenge_offers%rowtype;
  normalized_pricing_mode text := upper(trim(p_pricing_mode));
  normalized_status text := upper(trim(p_status));
  normalized_category text := upper(trim(p_category_code));
  normalized_rules jsonb := coalesce(p_rules, '{}'::jsonb);
begin
  perform public.lock_migration_import_activation(p_activation_id, p_source_fingerprint);

  if p_legacy_id_desafio_lista is null or length(trim(p_legacy_id_desafio_lista)) = 0 then
    raise exception 'Migration challenge offer legacy id is required';
  end if;

  if p_legacy_challenge_key is null or length(trim(p_legacy_challenge_key)) = 0 then
    raise exception 'Migration challenge offer challenge key is required';
  end if;

  if p_internal_name is null or length(trim(p_internal_name)) < 2 then
    raise exception 'Migration challenge offer internal name is required';
  end if;

  if p_public_name is null or length(trim(p_public_name)) < 2 then
    raise exception 'Migration challenge offer public name is required';
  end if;

  if normalized_category is null or normalized_category !~ '^[A-Z][A-Z0-9_]*$' then
    raise exception 'Migration challenge offer category is invalid';
  end if;

  if p_registration_starts_at is null or p_registration_ends_at is null
     or p_registration_ends_at <= p_registration_starts_at then
    raise exception 'Migration challenge offer registration period is invalid';
  end if;

  if normalized_pricing_mode not in ('FIXED', 'LOTS') then
    raise exception 'Migration challenge offer pricing mode is invalid';
  end if;

  if (normalized_pricing_mode = 'FIXED' and (p_price is null or p_price < 0))
     or (normalized_pricing_mode = 'LOTS' and p_price is not null) then
    raise exception 'Migration challenge offer price is invalid for pricing mode';
  end if;

  if p_max_per_participant is null or p_max_per_participant <= 0 then
    raise exception 'Migration challenge offer max per participant is invalid';
  end if;

  if normalized_status not in ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'DISABLED') then
    raise exception 'Migration challenge offer status is invalid';
  end if;

  if jsonb_typeof(normalized_rules) <> 'object' then
    raise exception 'Migration challenge offer rules must be an object';
  end if;

  select c.id
    into challenge_uuid
  from public.challenges c
  where c.legacy_challenge_key = trim(p_legacy_challenge_key);

  if challenge_uuid is null then
    raise exception 'Migration challenge offer destination challenge not found';
  end if;

  select *
    into existing
  from public.challenge_offers o
  where o.legacy_id_desafio_lista = trim(p_legacy_id_desafio_lista);

  if existing.id is null then
    insert into public.challenge_offers (
      challenge_id,
      legacy_id_desafio_lista,
      internal_name,
      public_name,
      category_code,
      registration_starts_at,
      registration_ends_at,
      pricing_mode,
      price,
      max_per_participant,
      priority,
      status,
      rules
    ) values (
      challenge_uuid,
      trim(p_legacy_id_desafio_lista),
      trim(p_internal_name),
      trim(p_public_name),
      normalized_category,
      p_registration_starts_at,
      p_registration_ends_at,
      normalized_pricing_mode,
      p_price,
      p_max_per_participant,
      coalesce(p_priority, 0),
      normalized_status,
      normalized_rules
    )
    returning id into offer_id;

    outcome := 'INSERTED';
    return next;
    return;
  end if;

  if existing.challenge_id = challenge_uuid
     and existing.internal_name = trim(p_internal_name)
     and existing.public_name = trim(p_public_name)
     and existing.category_code = normalized_category
     and existing.registration_starts_at = p_registration_starts_at
     and existing.registration_ends_at = p_registration_ends_at
     and existing.pricing_mode = normalized_pricing_mode
     and existing.price is not distinct from p_price
     and existing.max_per_participant = p_max_per_participant
     and existing.priority = coalesce(p_priority, 0)
     and existing.status = normalized_status
     and existing.rules = normalized_rules then
    offer_id := existing.id;
    outcome := 'VERIFIED_EQUAL';
    return next;
    return;
  end if;

  raise exception 'Migration challenge offer conflicts with existing destination row';
end;
$$;

revoke all on function public.migration_insert_or_verify_challenge_offer(
  text, text, text, text, text, text, text, timestamptz, timestamptz,
  text, numeric, integer, integer, text, jsonb
) from public, anon, authenticated;

commit;
