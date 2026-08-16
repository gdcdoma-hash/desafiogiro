begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_function(
  'public',
  'migration_insert_or_verify_registration',
  array['text','text','text','text','text','integer','integer','numeric','text','text'],
  'registration migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_registration(text,text,text,text,text,integer,integer,numeric,text,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute registration migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_registration(text,text,text,text,text,integer,integer,numeric,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute registration migration primitive'
);

insert into public.migration_import_activations (activation_id, source_fingerprint)
values ('registration-writer-test', 'sha256:registration-writer-source');

insert into public.challenges (
  code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status, is_public,
  legacy_challenge_key, legacy_id_desafio_base
) values (
  'migration-registration-test', 'Migration Registration Test', 2026, 8,
  '2026-08-01 00:00:00-03', '2026-09-01 00:00:00-03', 'ARCHIVED', false,
  'legacy-registration-base:2026-08', 'legacy-registration-base'
);

insert into public.challenge_goals (challenge_id, target_km, public_label)
select id, 500, '500 km'
from public.challenges
where legacy_challenge_key = 'legacy-registration-base:2026-08';

insert into public.challenge_offers (
  challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at,
  price, pricing_mode, max_per_participant, status, legacy_id_desafio_lista
)
select id, 'Migration Registration Offer', 'Migration Registration Offer', 'NORMAL',
  '2026-07-01 00:00:00-03', '2026-08-20 23:59:59-03',
  44.90, 'FIXED', 1, 'CLOSED', 'legacy-registration-offer'
from public.challenges
where legacy_challenge_key = 'legacy-registration-base:2026-08';

insert into public.challenge_offer_goals (offer_id, goal_id)
select o.id, g.id
from public.challenge_offers o
join public.challenge_goals g on g.challenge_id = o.challenge_id
where o.legacy_id_desafio_lista = 'legacy-registration-offer'
  and g.target_km = 500;

insert into public.participants (legacy_id_dgmb, full_name, city, status)
values ('legacy-registration-participant', 'Participante Registro', 'Santa Ines', 'ACTIVE');

select is(
  (
    select outcome
    from public.migration_insert_or_verify_registration(
      'registration-writer-test',
      'sha256:registration-writer-source',
      'legacy-registration-id-1',
      'legacy-registration-participant',
      'legacy-registration-offer',
      500,
      1,
      39.90,
      'COMPLETED',
      'historical registration fixture'
    )
  ),
  'INSERTED',
  'missing historical registration is inserted'
);

select is(
  (
    select count(*)::integer
    from public.registrations
    where legacy_id_inscricao = 'legacy-registration-id-1'
  ),
  1,
  'historical registration is inserted only once'
);

select is(
  (
    select price_snapshot
    from public.registrations
    where legacy_id_inscricao = 'legacy-registration-id-1'
  ),
  39.90::numeric,
  'historical price snapshot is preserved instead of fixed offer price'
);

select is(
  (
    select source_code
    from public.registrations
    where legacy_id_inscricao = 'legacy-registration-id-1'
  ),
  'MIGRATION',
  'writer marks the row with migration source'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_registration(
      'registration-writer-test',
      'sha256:registration-writer-source',
      'legacy-registration-id-1',
      'legacy-registration-participant',
      'legacy-registration-offer',
      500,
      1,
      39.90,
      'completed',
      'historical registration fixture'
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select is(
  (
    select count(*)::integer
    from public.registrations
    where legacy_id_inscricao = 'legacy-registration-id-1'
  ),
  1,
  'equivalent replay leaves one registration row'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_registration(
    'registration-writer-test',
    'sha256:registration-writer-source',
    'legacy-registration-id-1',
    'legacy-registration-participant',
    'legacy-registration-offer',
    500,
    1,
    49.90,
    'COMPLETED',
    'historical registration fixture'
  )$$,
  'P0001',
  'Migration registration conflicts with existing destination row',
  'divergent historical price is blocked'
);

select is(
  (
    select price_snapshot
    from public.registrations
    where legacy_id_inscricao = 'legacy-registration-id-1'
  ),
  39.90::numeric,
  'blocked divergence does not overwrite destination data'
);

select is(
  (
    select status
    from public.registrations
    where legacy_id_inscricao = 'legacy-registration-id-1'
  ),
  'COMPLETED',
  'historical registration status is stored explicitly'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'registration-writer-test'
  ),
  'AUTHORIZED',
  'primitive does not complete the overall migration activation'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_registration(
    'registration-writer-test',
    'sha256:registration-writer-source',
    'legacy-registration-id-missing-participant',
    'missing-participant',
    'legacy-registration-offer',
    500,
    1,
    39.90,
    'COMPLETED',
    ''
  )$$,
  'P0001',
  'Migration registration destination participant not found',
  'missing participant dependency is blocked'
);

select * from finish();
rollback;
