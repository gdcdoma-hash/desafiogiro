begin;

create or replace function public.lock_migration_import_activation(
  p_activation_id text,
  p_source_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  activation_uuid uuid;
begin
  if p_activation_id is null or length(trim(p_activation_id)) = 0 then
    raise exception 'Migration activation id is required';
  end if;

  if p_source_fingerprint is null or length(trim(p_source_fingerprint)) = 0 then
    raise exception 'Migration source fingerprint is required';
  end if;

  select a.id
    into activation_uuid
  from public.migration_import_activations a
  where a.activation_id = trim(p_activation_id)
    and a.source_fingerprint = trim(p_source_fingerprint)
    and a.status = 'AUTHORIZED'
  for update;

  if activation_uuid is null then
    raise exception 'Migration activation is not authorized';
  end if;

  return activation_uuid;
end;
$$;

create or replace function public.complete_migration_import_activation(
  p_activation_id text,
  p_source_fingerprint text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.migration_import_activations a
  set status = 'COMPLETED',
      completed_at = now()
  where a.activation_id = trim(p_activation_id)
    and a.source_fingerprint = trim(p_source_fingerprint)
    and a.status = 'AUTHORIZED';

  if not found then
    raise exception 'Migration activation is not authorized';
  end if;
end;
$$;

revoke all on function public.lock_migration_import_activation(text, text)
  from public, anon, authenticated;
revoke all on function public.complete_migration_import_activation(text, text)
  from public, anon, authenticated;

commit;
