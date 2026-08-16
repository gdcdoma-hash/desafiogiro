begin;

create or replace function public.migration_insert_or_verify_challenge(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_challenge_key text,
  p_legacy_id_desafio_base text,
  p_code text,
  p_public_name text,
  p_reference_year smallint,
  p_reference_month smallint,
  p_sports_starts_at timestamptz,
  p_sports_ends_at timestamptz,
  p_timezone text,
  p_status text,
  p_is_public boolean
)
returns table(challenge_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.challenges%rowtype;
  inserted_id uuid;
begin
  perform public.lock_migration_import_activation(
    p_activation_id,
    p_source_fingerprint
  );

  if p_legacy_challenge_key is null
     or length(trim(p_legacy_challenge_key)) = 0 then
    raise exception 'Legacy challenge key is required';
  end if;

  select c.*
    into existing
  from public.challenges c
  where c.legacy_challenge_key = trim(p_legacy_challenge_key);

  if found then
    if existing.legacy_id_desafio_base is not distinct from nullif(trim(p_legacy_id_desafio_base), '')
       and existing.code = p_code
       and existing.public_name = p_public_name
       and existing.reference_year = p_reference_year
       and existing.reference_month is not distinct from p_reference_month
       and existing.sports_starts_at = p_sports_starts_at
       and existing.sports_ends_at = p_sports_ends_at
       and existing.timezone = p_timezone
       and existing.status = p_status
       and existing.is_public = p_is_public then
      return query select existing.id, 'VERIFIED_EQUAL'::text;
      return;
    end if;

    raise exception 'Migration challenge conflicts with existing destination row';
  end if;

  insert into public.challenges (
    legacy_challenge_key,
    legacy_id_desafio_base,
    code,
    public_name,
    reference_year,
    reference_month,
    sports_starts_at,
    sports_ends_at,
    timezone,
    status,
    is_public
  ) values (
    trim(p_legacy_challenge_key),
    nullif(trim(p_legacy_id_desafio_base), ''),
    p_code,
    p_public_name,
    p_reference_year,
    p_reference_month,
    p_sports_starts_at,
    p_sports_ends_at,
    p_timezone,
    p_status,
    p_is_public
  )
  returning id into inserted_id;

  return query select inserted_id, 'INSERTED'::text;
end;
$$;

revoke all on function public.migration_insert_or_verify_challenge(
  text,
  text,
  text,
  text,
  text,
  text,
  smallint,
  smallint,
  timestamptz,
  timestamptz,
  text,
  text,
  boolean
) from public, anon, authenticated;

commit;
