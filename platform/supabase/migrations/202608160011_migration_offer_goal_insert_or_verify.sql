begin;

create or replace function public.migration_insert_or_verify_offer_goal(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_id_desafio_lista text,
  p_legacy_challenge_key text,
  p_target_km integer
)
returns table(offer_id uuid, goal_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenge_uuid uuid;
  offer_uuid uuid;
  goal_uuid uuid;
begin
  perform public.lock_migration_import_activation(p_activation_id, p_source_fingerprint);

  if p_legacy_id_desafio_lista is null or length(trim(p_legacy_id_desafio_lista)) = 0 then
    raise exception 'Migration offer goal legacy offer id is required';
  end if;

  if p_legacy_challenge_key is null or length(trim(p_legacy_challenge_key)) = 0 then
    raise exception 'Migration offer goal challenge key is required';
  end if;

  if p_target_km is null or p_target_km <= 0 then
    raise exception 'Migration offer goal target km is invalid';
  end if;

  select c.id
    into challenge_uuid
  from public.challenges c
  where c.legacy_challenge_key = trim(p_legacy_challenge_key);

  if challenge_uuid is null then
    raise exception 'Migration offer goal destination challenge not found';
  end if;

  select o.id
    into offer_uuid
  from public.challenge_offers o
  where o.legacy_id_desafio_lista = trim(p_legacy_id_desafio_lista)
    and o.challenge_id = challenge_uuid;

  if offer_uuid is null then
    raise exception 'Migration offer goal destination offer not found for challenge';
  end if;

  select g.id
    into goal_uuid
  from public.challenge_goals g
  where g.challenge_id = challenge_uuid
    and g.target_km = p_target_km;

  if goal_uuid is null then
    raise exception 'Migration offer goal destination goal not found';
  end if;

  if exists (
    select 1
    from public.challenge_offer_goals og
    where og.offer_id = offer_uuid
      and og.goal_id = goal_uuid
  ) then
    offer_id := offer_uuid;
    goal_id := goal_uuid;
    outcome := 'VERIFIED_EQUAL';
    return next;
    return;
  end if;

  insert into public.challenge_offer_goals (offer_id, goal_id)
  values (offer_uuid, goal_uuid);

  offer_id := offer_uuid;
  goal_id := goal_uuid;
  outcome := 'INSERTED';
  return next;
end;
$$;

revoke all on function public.migration_insert_or_verify_offer_goal(
  text, text, text, text, integer
) from public, anon, authenticated;

commit;
