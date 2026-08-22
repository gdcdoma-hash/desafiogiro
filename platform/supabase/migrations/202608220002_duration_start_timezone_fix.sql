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
  zone_name text;
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

  select c.goal_mode, coalesce(nullif(c.timezone,''),'America/Fortaleza')
    into challenge_mode, zone_name
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
     set planned_starts_at = target_start_on::timestamp at time zone zone_name,
         updated_at = now()
   where id = target_registration_id;

  return public.get_participant_checkout_state(target_checkout_id);
end;
$$;

revoke all on function public.set_participant_checkout_start_date(uuid,uuid,date) from public, anon;
grant execute on function public.set_participant_checkout_start_date(uuid,uuid,date) to authenticated;