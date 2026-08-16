begin;

create or replace function public.migration_insert_or_verify_pricing_group(
  p_activation_id text,
  p_source_fingerprint text,
  p_period_code text,
  p_external_reference text,
  p_internal_name text
)
returns table(pricing_group_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.challenge_pricing_groups%rowtype;
  inserted_id uuid;
  normalized_period text := trim(p_period_code);
  normalized_reference text := trim(p_external_reference);
  normalized_name text := trim(p_internal_name);
begin
  perform public.lock_migration_import_activation(
    p_activation_id,
    p_source_fingerprint
  );

  if normalized_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Migration pricing group period code is invalid';
  end if;

  if length(normalized_reference) = 0 then
    raise exception 'Migration pricing group external reference is required';
  end if;

  if length(normalized_name) = 0 then
    raise exception 'Migration pricing group internal name is required';
  end if;

  select group_row.*
    into existing
  from public.challenge_pricing_groups group_row
  where group_row.period_code = normalized_period
    and group_row.external_reference = normalized_reference;

  if found then
    if existing.challenge_id is null
       and existing.internal_name = normalized_name
       and existing.status = 'ACTIVE' then
      return query select existing.id, 'VERIFIED_EQUAL'::text;
      return;
    end if;

    raise exception 'Migration pricing group conflicts with existing destination row';
  end if;

  insert into public.challenge_pricing_groups (
    challenge_id,
    period_code,
    external_reference,
    internal_name,
    status
  ) values (
    null,
    normalized_period,
    normalized_reference,
    normalized_name,
    'ACTIVE'
  )
  returning id into inserted_id;

  return query select inserted_id, 'INSERTED'::text;
end;
$$;

revoke all on function public.migration_insert_or_verify_pricing_group(
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

commit;
