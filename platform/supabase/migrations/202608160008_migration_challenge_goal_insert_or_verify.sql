begin;

create or replace function public.migration_insert_or_verify_challenge_goal(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_challenge_key text,
  p_target_km integer,
  p_public_label text,
  p_display_order integer,
  p_is_active boolean
)
returns table(goal_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_challenge_id uuid;
  existing public.challenge_goals%rowtype;
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

  select c.id
    into resolved_challenge_id
  from public.challenges c
  where c.legacy_challenge_key = trim(p_legacy_challenge_key);

  if resolved_challenge_id is null then
    raise exception 'Migration challenge destination row does not exist';
  end if;

  select g.*
    into existing
  from public.challenge_goals g
  where g.challenge_id = resolved_challenge_id
    and g.target_km = p_target_km;

  if found then
    if existing.public_label is not distinct from p_public_label
       and existing.display_order = p_display_order
       and existing.is_active = p_is_active then
      return query select existing.id, 'VERIFIED_EQUAL'::text;
      return;
    end if;

    raise exception 'Migration challenge goal conflicts with existing destination row';
  end if;

  insert into public.challenge_goals (
    challenge_id,
    target_km,
    public_label,
    display_order,
    is_active
  ) values (
    resolved_challenge_id,
    p_target_km,
    p_public_label,
    p_display_order,
    p_is_active
  )
  returning id into inserted_id;

  return query select inserted_id, 'INSERTED'::text;
end;
$$;

revoke all on function public.migration_insert_or_verify_challenge_goal(
  text,
  text,
  text,
  integer,
  text,
  integer,
  boolean
) from public, anon, authenticated;

commit;
