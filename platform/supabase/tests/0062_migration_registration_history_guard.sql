begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into public.challenges (
  code,
  public_name,
  reference_year,
  reference_month,
  sports_starts_at,
  sports_ends_at,
  status,
  is_public,
  legacy_challenge_key,
  legacy_id_desafio_base
) values (
  'migration-history-test',
  'Migration History Test',
  2026,
  8,
  '2026-08-01 00:00:00-03',
  '2026-09-01 00:00:00-03',
  'ARCHIVED',
  false,
  'legacy-history:2026-08',
  'legacy-history'
);

insert into public.challenge_goals (challenge_id, target_km, public_label)
select id, 500, '500 km'
from public.challenges
where legacy_challenge_key = 'legacy-history:2026-08';

insert into public.challenge_offers (
  challenge_id,
  internal_name,
  public_name,
  category_code,
  registration_starts_at,
  registration_ends_at,
  price,
  pricing_mode,
  max_per_participant,
  status,
  legacy_id_desafio_lista
)
select
  id,
  'Migration History Offer',
  'Migration History Offer',
  'NORMAL',
  '2026-07-01 00:00:00-03',
  '2026-08-20 23:59:59-03',
  44.90,
  'FIXED',
  1,
  'CLOSED',
  'legacy-history-offer'
from public.challenges
where legacy_challenge_key = 'legacy-history:2026-08';

insert into public.challenge_offer_goals (offer_id, goal_id)
select o.id, g.id
from public.challenge_offers o
join public.challenge_goals g on g.challenge_id = o.challenge_id
where o.legacy_id_desafio_lista = 'legacy-history-offer'
  and g.target_km = 500;

insert into public.participants (legacy_id_dgmb, full_name, city, status)
values ('legacy-history-participant', 'Participante Historico', 'Santa Ines', 'ACTIVE');

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
)
select
  p.id,
  c.id,
  g.id,
  o.id,
  1,
  10.00,
  'CONFIRMED',
  'ADMIN',
  '',
  'legacy-history-normal'
from public.participants p
cross join public.challenges c
join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
join public.challenge_offers o on o.challenge_id = c.id and o.legacy_id_desafio_lista = 'legacy-history-offer'
where p.legacy_id_dgmb = 'legacy-history-participant'
  and c.legacy_challenge_key = 'legacy-history:2026-08';

select is(
  (
    select price_snapshot
    from public.registrations
    where legacy_id_inscricao = 'legacy-history-normal'
  ),
  44.90::numeric,
  'normal fixed-price insert still uses the offer price'
);

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
)
select
  p.id,
  c.id,
  g.id,
  o.id,
  2,
  39.90,
  'COMPLETED',
  'MIGRATION',
  'historical fixture',
  'legacy-history-migration-2'
from public.participants p
cross join public.challenges c
join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
join public.challenge_offers o on o.challenge_id = c.id and o.legacy_id_desafio_lista = 'legacy-history-offer'
where p.legacy_id_dgmb = 'legacy-history-participant'
  and c.legacy_challenge_key = 'legacy-history:2026-08';

select is(
  (
    select price_snapshot
    from public.registrations
    where legacy_id_inscricao = 'legacy-history-migration-2'
  ),
  39.90::numeric,
  'migration insert preserves the historical fixed-offer price snapshot'
);

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
)
select
  p.id,
  c.id,
  g.id,
  o.id,
  3,
  49.90,
  'CANCELLED',
  'MIGRATION',
  'historical fixture',
  'legacy-history-migration-3'
from public.participants p
cross join public.challenges c
join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
join public.challenge_offers o on o.challenge_id = c.id and o.legacy_id_desafio_lista = 'legacy-history-offer'
where p.legacy_id_dgmb = 'legacy-history-participant'
  and c.legacy_challenge_key = 'legacy-history:2026-08';

select is(
  (
    select price_snapshot
    from public.registrations
    where legacy_id_inscricao = 'legacy-history-migration-3'
  ),
  49.90::numeric,
  'migration can preserve another historical occurrence beyond the current offer limit'
);

select is(
  (
    select count(*)::integer
    from public.registrations
    where participant_id = (
      select id from public.participants where legacy_id_dgmb = 'legacy-history-participant'
    )
      and offer_id = (
        select id from public.challenge_offers where legacy_id_desafio_lista = 'legacy-history-offer'
      )
  ),
  3,
  'all historical occurrences remain distinct'
);

select throws_ok(
  $$insert into public.registrations (
    participant_id, challenge_id, goal_id, offer_id, occurrence_number,
    price_snapshot, status, source_code, notes, legacy_id_inscricao
  )
  select p.id, c.id, g.id, o.id, 4, 44.90, 'PENDING', 'ADMIN', '', 'legacy-history-normal-limit'
  from public.participants p
  cross join public.challenges c
  join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
  join public.challenge_offers o on o.challenge_id = c.id and o.legacy_id_desafio_lista = 'legacy-history-offer'
  where p.legacy_id_dgmb = 'legacy-history-participant'
    and c.legacy_challenge_key = 'legacy-history:2026-08'$$,
  'P0001',
  'Participant reached the registration limit for this offer',
  'normal inserts still enforce the operational offer limit'
);

select throws_ok(
  $$insert into public.registrations (
    participant_id, challenge_id, goal_id, offer_id, occurrence_number,
    price_snapshot, status, source_code, notes, legacy_id_inscricao
  )
  select p.id, c.id, g.id, o.id, 4, null, 'COMPLETED', 'MIGRATION', '', 'legacy-history-null-price'
  from public.participants p
  cross join public.challenges c
  join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
  join public.challenge_offers o on o.challenge_id = c.id and o.legacy_id_desafio_lista = 'legacy-history-offer'
  where p.legacy_id_dgmb = 'legacy-history-participant'
    and c.legacy_challenge_key = 'legacy-history:2026-08'$$,
  'P0001',
  'Migration registration requires a valid historical price snapshot',
  'migration cannot invent a missing historical price snapshot'
);

select is(
  (
    select source_code
    from public.registrations
    where legacy_id_inscricao = 'legacy-history-migration-2'
  ),
  'MIGRATION',
  'migration source remains explicit on the historical row'
);

select * from finish();
rollback;
