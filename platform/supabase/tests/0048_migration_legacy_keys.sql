begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

select has_column('public','challenges','legacy_id_desafio_base','challenge preserves legacy base id');
select has_column('public','challenges','legacy_challenge_key','challenge preserves period-aware legacy key');
select has_column('public','challenge_offers','legacy_id_desafio_lista','offer preserves legacy list id');
select has_column('public','participants','legacy_id_dgmb','participant preserves legacy DGMB id');
select has_column('public','registrations','legacy_id_inscricao','registration preserves legacy registration id');
select has_column('public','inventory_items','legacy_id_item_estoque','inventory item preserves legacy stock id');

select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='challenges'
      and indexname='challenges_legacy_id_desafio_base_idx'
      and indexdef not like 'CREATE UNIQUE INDEX%'
  ),
  'challenge legacy base id remains indexed but may repeat across periods'
);
select ok(
  exists(
    select 1
    from pg_indexes
    where schemaname='public'
      and tablename='challenges'
      and indexname='challenges_legacy_challenge_key_uidx'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'period-aware challenge legacy key is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='challenge_offers' and indexname='challenge_offers_legacy_id_desafio_lista_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'offer legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='registrations' and indexname='registrations_legacy_id_inscricao_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'registration legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='inventory_items' and indexname='inventory_items_legacy_id_item_estoque_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'inventory legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='registration_payments' and indexname='registration_payments_external_reference_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'payment external reference is unique when present'
);

select ok(
  exists(select 1 from pg_constraint where conname='challenges_legacy_challenge_key_nonblank'),
  'challenge period-aware legacy key rejects blank values'
);
select ok(
  exists(select 1 from pg_constraint where conname='participants_legacy_id_dgmb_nonblank'),
  'participant legacy id rejects blank values'
);
select ok(
  exists(select 1 from pg_constraint where conname='registrations_legacy_id_inscricao_nonblank'),
  'registration legacy id rejects blank values'
);
select ok(
  exists(select 1 from pg_constraint where conname='registration_payments_external_reference_nonblank'),
  'payment external reference rejects blank values'
);

insert into public.challenges (
  code,
  public_name,
  reference_year,
  reference_month,
  sports_starts_at,
  sports_ends_at,
  legacy_id_desafio_base,
  legacy_challenge_key
) values
  (
    'legacy-key-aug',
    'Legacy key August',
    2026,
    8,
    '2026-08-01 00:00:00-03',
    '2026-09-01 00:00:00-03',
    'legacy-base-repeatable',
    'legacy-base-repeatable:2026-08'
  ),
  (
    'legacy-key-sep',
    'Legacy key September',
    2026,
    9,
    '2026-09-01 00:00:00-03',
    '2026-10-01 00:00:00-03',
    'legacy-base-repeatable',
    'legacy-base-repeatable:2026-09'
  );

select is(
  (
    select count(*)::integer
    from public.challenges
    where legacy_id_desafio_base = 'legacy-base-repeatable'
  ),
  2,
  'same legacy challenge base can exist in different monthly editions'
);

select throws_ok(
  $$
    insert into public.challenges (
      code,
      public_name,
      reference_year,
      reference_month,
      sports_starts_at,
      sports_ends_at,
      legacy_id_desafio_base,
      legacy_challenge_key
    ) values (
      'legacy-key-duplicate',
      'Legacy key duplicate',
      2026,
      8,
      '2026-08-01 00:00:00-03',
      '2026-09-01 00:00:00-03',
      'legacy-base-repeatable',
      'legacy-base-repeatable:2026-08'
    )
  $$,
  '23505',
  null,
  'same period-aware legacy challenge key cannot be inserted twice'
);

select * from finish();
rollback;
