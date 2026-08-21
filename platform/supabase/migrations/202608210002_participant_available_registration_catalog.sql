create or replace function public.get_participant_registration_catalog()
returns setof public.public_registration_catalog
language sql
stable
security definer
set search_path = ''
as $$
  with linked_participant as (
    select link.participant_id
    from public.participant_user_links link
    join public.participants p on p.id = link.participant_id
    where link.user_id = auth.uid()
      and p.status = 'ACTIVE'
    limit 1
  )
  select catalog.*
  from public.public_registration_catalog catalog
  join public.challenge_offers offer on offer.id = catalog.offer_id
  cross join linked_participant participant
  where (
    select count(*)
    from public.registrations registration
    where registration.participant_id = participant.participant_id
      and registration.offer_id = catalog.offer_id
      and registration.status not in ('CANCELLED', 'EXPIRED')
  ) < offer.max_per_participant
  order by catalog.reference_year desc, catalog.reference_month desc, catalog.display_order asc;
$$;

revoke all on function public.get_participant_registration_catalog() from public;
revoke all on function public.get_participant_registration_catalog() from anon;
grant execute on function public.get_participant_registration_catalog() to authenticated;
