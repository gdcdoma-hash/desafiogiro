begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(16);

select has_function(
  'public',
  'migration_insert_or_verify_payment',
  array['text','text','text','text','numeric','text','text'],
  'payment migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_payment(text,text,text,text,numeric,text,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute payment migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_payment(text,text,text,text,numeric,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute payment migration primitive'
);

insert into public.migration_import_activations (activation_id, source_fingerprint)
values ('payment-writer-test', 'sha256:payment-writer-source');

insert into public.challenges (
  code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status, is_public,
  legacy_challenge_key, legacy_id_desafio_base
) values (
  'migration-payment-test', 'Migration Payment Test', 2026, 8,
  '2026-08-01 00:00:00-03', '2026-09-01 00:00:00-03', 'ARCHIVED', false,
  'legacy-payment-base:2026-08', 'legacy-payment-base'
);

insert into public.challenge_goals (challenge_id, target_km, public_label)
select id, 500, '500 km'
from public.challenges
where legacy_challenge_key = 'legacy-payment-base:2026-08';

insert into public.challenge_offers (
  challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at,
  price, pricing_mode, max_per_participant, status, legacy_id_desafio_lista
)
select id, 'Migration Payment Offer', 'Migration Payment Offer', 'NORMAL',
  '2026-07-01 00:00:00-03', '2026-08-20 23:59:59-03',
  44.90, 'FIXED', 1, 'CLOSED', 'legacy-payment-offer'
from public.challenges
where legacy_challenge_key = 'legacy-payment-base:2026-08';

insert into public.challenge_offer_goals (offer_id, goal_id)
select o.id, g.id
from public.challenge_offers o
join public.challenge_goals g on g.challenge_id = o.challenge_id
where o.legacy_id_desafio_lista = 'legacy-payment-offer'
  and g.target_km = 500;

insert into public.participants (legacy_id_dgmb, full_name, city, status)
values ('legacy-payment-participant', 'Participante Pagamento', 'Santa Ines', 'ACTIVE');

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
  39.90,
  'COMPLETED',
  'MIGRATION',
  'historical payment registration fixture',
  'legacy-payment-registration-1'
from public.participants p
join public.challenges c on c.legacy_challenge_key = 'legacy-payment-base:2026-08'
join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
join public.challenge_offers o on o.challenge_id = c.id and o.legacy_id_desafio_lista = 'legacy-payment-offer'
where p.legacy_id_dgmb = 'legacy-payment-participant';

select is(
  (
    select outcome
    from public.migration_insert_or_verify_payment(
      'payment-writer-test',
      'sha256:payment-writer-source',
      'legacy-payment-registration-1',
      'LEGACY_PAYMENT:fixture-batch-1',
      39.90,
      'CONFIRMED',
      'historical payment fixture'
    )
  ),
  'INSERTED',
  'missing historical payment is inserted'
);

select is(
  (
    select count(*)::integer
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-1'
  ),
  1,
  'historical payment is inserted only once'
);

select is(
  (
    select method_code
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-1'
  ),
  'LEGACY_UNSPECIFIED',
  'historical payment uses explicit unspecified legacy method'
);

select is(
  (
    select status
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-1'
  ),
  'CONFIRMED',
  'historical payment status is preserved'
);

select is(
  (
    select paid_at
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-1'
  ),
  null::timestamptz,
  'confirmed historical payment does not fabricate paid_at'
);

select is(
  (
    select paid_at_unknown
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-1'
  ),
  true,
  'confirmed historical payment marks paid_at as unknown'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_payment(
      'payment-writer-test',
      'sha256:payment-writer-source',
      'legacy-payment-registration-1',
      'LEGACY_PAYMENT:fixture-batch-1',
      39.90,
      'confirmed',
      'historical payment fixture'
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_payment(
    'payment-writer-test',
    'sha256:payment-writer-source',
    'legacy-payment-registration-1',
    'LEGACY_PAYMENT:fixture-batch-1',
    49.90,
    'CONFIRMED',
    'historical payment fixture'
  )$$,
  'P0001',
  'Migration payment conflicts with existing destination row',
  'divergent historical amount is blocked'
);

select is(
  (
    select amount
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-1'
  ),
  39.90::numeric,
  'blocked divergence does not overwrite historical amount'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_payment(
      'payment-writer-test',
      'sha256:payment-writer-source',
      'legacy-payment-registration-1',
      'LEGACY_PAYMENT:fixture-batch-2',
      39.90,
      'PENDING',
      ''
    )
  ),
  'INSERTED',
  'pending historical payment is inserted'
);

select is(
  (
    select paid_at_unknown
    from public.registration_payments
    where external_reference = 'LEGACY_PAYMENT:fixture-batch-2'
  ),
  false,
  'pending historical payment does not mark paid_at as unknown'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_payment(
    'payment-writer-test',
    'sha256:payment-writer-source',
    'missing-registration',
    'LEGACY_PAYMENT:fixture-batch-3',
    39.90,
    'PENDING',
    ''
  )$$,
  'P0001',
  'Migration payment destination registration not found',
  'missing registration dependency is blocked'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'payment-writer-test'
  ),
  'AUTHORIZED',
  'payment primitive does not complete the overall migration activation'
);

select * from finish();
rollback;
