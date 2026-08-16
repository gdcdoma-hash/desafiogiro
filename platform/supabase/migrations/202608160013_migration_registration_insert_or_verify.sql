begin;

create or replace function public.migration_insert_or_verify_registration(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_id_inscricao text,
  p_legacy_id_dgmb text,
  p_legacy_id_desafio_lista text,
  p_target_km integer,
  p_occurrence_number integer,
  p_price_snapshot numeric,
  p_status text,
  p_notes text
)
returns table(registration_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_uuid uuid;
  challenge_uuid uuid;
  offer_uuid uuid;
  goal_uuid uuid;
  existing public.registrations%rowtype;
  normalized_status text := upper(trim(p_status));
  normalized_notes text := coalesce(p_notes, '');
begin
  perform public.lock_migration_import_activation(p_activation_id, p_source_fingerprint);

  if p_legacy_id_inscricao is null or length(trim(p_legacy_id_inscricao)) = 0 then
    raise exception 'Migration registration legacy id is required';
  end if;

  if p_legacy_id_dgmb is null or length(trim(p_legacy_id_dgmb)) = 0 then
    raise exception 'Migration registration participant legacy id is required';
  end if;

  if p_legacy_id_desafio_lista is null or length(trim(p_legacy_id_desafio_lista)) = 0 then
    raise exception 'Migration registration offer legacy id is required';
  end if;

  if p_target_km is null or p_target_km <= 0 then
    raise exception 'Migration registration target km is invalid';
  end if;

  if p_occurrence_number is null or p_occurrence_number <= 0 then
    raise exception 'Migration registration occurrence number is invalid';
  end if;

  if p_price_snapshot is null or p_price_snapshot < 0 then
    raise exception 'Migration registration historical price snapshot is invalid';
  end if;

  if normalized_status not in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','EXPIRED') then
    raise exception 'Migration registration status is invalid';
  end if;

  select p.id
    into participant_uuid
  from public.participants p
  where p.legacy_id_dgmb = trim(p_legacy_id_dgmb);

  if participant_uuid is null then
    raise exception 'Migration registration destination participant not found';
  end if;

  select o.id, o.challenge_id
    into offer_uuid, challenge_uuid
  from public.challenge_offers o
  where o.legacy_id_desafio_lista = trim(p_legacy_id_desafio_lista);

  if offer_uuid is null or challenge_uuid is null then
    raise exception 'Migration registration destination offer not found';
  end if;

  select g.id
    into goal_uuid
  from public.challenge_goals g
  join public.challenge_offer_goals og on og.goal_id = g.id
  where g.challenge_id = challenge_uuid
    and g.target_km = p_target_km
    and og.offer_id = offer_uuid;

  if goal_uuid is null then
    raise exception 'Migration registration destination goal is not enabled for offer';
  end if;

  select *
    into existing
  from public.registrations r
  where r.legacy_id_inscricao = trim(p_legacy_id_inscricao);

  if existing.id is null then
    insert into public.registrations (
      participant_id,
      challenge_id,
      goal_id,
      offer_id,
      occurrence_number,
      price_snapshot,
      status,
      source_code,
      notes,
      legacy_id_inscricao
    ) values (
      participant_uuid,
      challenge_uuid,
      goal_uuid,
      offer_uuid,
      p_occurrence_number,
      p_price_snapshot,
      normalized_status,
      'MIGRATION',
      normalized_notes,
      trim(p_legacy_id_inscricao)
    )
    returning id into registration_id;

    outcome := 'INSERTED';
    return next;
    return;
  end if;

  if existing.participant_id = participant_uuid
     and existing.challenge_id = challenge_uuid
     and existing.goal_id = goal_uuid
     and existing.offer_id = offer_uuid
     and existing.occurrence_number = p_occurrence_number
     and existing.price_snapshot = p_price_snapshot
     and existing.status = normalized_status
     and existing.source_code = 'MIGRATION'
     and existing.notes = normalized_notes then
    registration_id := existing.id;
    outcome := 'VERIFIED_EQUAL';
    return next;
    return;
  end if;

  raise exception 'Migration registration conflicts with existing destination row';
end;
$$;

revoke all on function public.migration_insert_or_verify_registration(
  text, text, text, text, text, integer, integer, numeric, text, text
) from public, anon, authenticated;

commit;
