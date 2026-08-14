begin;

create or replace view public.public_registration_catalog
with (security_invoker = true)
as
select
  c.id as challenge_id,
  c.code as challenge_code,
  c.public_name as challenge_name,
  c.short_description,
  c.reference_year,
  c.reference_month,
  c.sports_starts_at,
  c.sports_ends_at,
  c.timezone,
  o.id as offer_id,
  o.public_name as offer_name,
  o.category_code,
  o.registration_starts_at,
  o.registration_ends_at,
  o.price,
  o.max_per_participant,
  g.id as goal_id,
  g.target_km,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_label,
  g.display_order
from public.challenges c
join public.challenge_offers o on o.challenge_id = c.id
join public.challenge_offer_goals og on og.offer_id = o.id
join public.challenge_goals g on g.id = og.goal_id
where c.is_public = true
  and c.status in ('SCHEDULED','ACTIVE')
  and o.status = 'OPEN'
  and g.is_active = true
  and now() >= o.registration_starts_at
  and now() < o.registration_ends_at;

grant select on public.public_registration_catalog to anon, authenticated;

commit;
