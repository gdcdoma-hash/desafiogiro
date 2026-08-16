begin;

create or replace function public.migration_insert_or_verify_participant(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_id_dgmb text,
  p_full_name text,
  p_phone_e164 text,
  p_city text,
  p_state_code text,
  p_status text,
  p_notes text
)
returns table(participant_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.participants%rowtype;
  inserted_id uuid;
  normalized_legacy_id text := trim(p_legacy_id_dgmb);
  normalized_full_name text := trim(p_full_name);
  normalized_phone text := nullif(trim(p_phone_e164), '');
  normalized_city text := coalesce(trim(p_city), '');
  normalized_state text := nullif(upper(trim(p_state_code)), '');
  normalized_status text := trim(p_status);
  normalized_notes text := coalesce(p_notes, '');
begin
  perform public.lock_migration_import_activation(
    p_activation_id,
    p_source_fingerprint
  );

  if normalized_legacy_id is null or length(normalized_legacy_id) = 0 then
    raise exception 'Migration participant legacy id is required';
  end if;

  if normalized_full_name is null or length(normalized_full_name) < 2 then
    raise exception 'Migration participant full name is required';
  end if;

  if normalized_status is null or normalized_status not in ('ACTIVE', 'INACTIVE', 'MERGED') then
    raise exception 'Migration participant status is invalid';
  end if;

  select p.*
    into existing
  from public.participants p
  where p.legacy_id_dgmb = normalized_legacy_id
  for update;

  if not found then
    insert into public.participants (
      legacy_id_dgmb,
      full_name,
      phone_e164,
      city,
      state_code,
      status,
      notes
    ) values (
      normalized_legacy_id,
      normalized_full_name,
      normalized_phone,
      normalized_city,
      normalized_state,
      normalized_status,
      normalized_notes
    )
    returning id into inserted_id;

    return query select inserted_id, 'INSERTED'::text;
    return;
  end if;

  if existing.full_name is distinct from normalized_full_name
    or existing.phone_e164 is distinct from normalized_phone
    or existing.city is distinct from normalized_city
    or existing.state_code is distinct from normalized_state
    or existing.status is distinct from normalized_status
    or existing.notes is distinct from normalized_notes then
    raise exception 'Migration participant conflicts with existing destination row';
  end if;

  return query select existing.id, 'VERIFIED_EQUAL'::text;
end;
$$;

revoke all on function public.migration_insert_or_verify_participant(
  text, text, text, text, text, text, text, text, text
) from public, anon, authenticated;

commit;
