begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(2);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'challenge_offer_price_lots'
      and indexname = 'challenge_offer_price_lots_group_external_reference_uidx'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'shared pricing lot external reference is unique within its pricing group'
);

insert into public.challenge_pricing_groups (
  id,
  challenge_id,
  period_code,
  external_reference,
  internal_name
) values (
  '81111111-1111-1111-1111-111111111111',
  null,
  '2026-08',
  'AGO26_IDEMPOTENCY',
  'August idempotency group'
);

insert into public.challenge_offer_price_lots (
  pricing_group_id,
  external_reference,
  internal_name,
  starts_at,
  selection_mode,
  registration_count,
  unit_price,
  total_price
) values (
  '81111111-1111-1111-1111-111111111111',
  'AGO26_QTD_1_IDEMPOTENCY',
  'August one registration',
  '2026-08-01 00:00:00-03',
  'REGISTRATION_COUNT',
  1,
  44.90,
  44.90
);

select throws_ok(
  $$
    insert into public.challenge_offer_price_lots (
      pricing_group_id,
      external_reference,
      internal_name,
      starts_at,
      selection_mode,
      registration_count,
      unit_price,
      total_price
    ) values (
      '81111111-1111-1111-1111-111111111111',
      'AGO26_QTD_1_IDEMPOTENCY',
      'August duplicate one registration',
      '2026-08-01 00:00:00-03',
      'REGISTRATION_COUNT',
      1,
      44.90,
      44.90
    )
  $$,
  '23505',
  null,
  'replaying the same shared pricing lot is rejected'
);

select * from finish();
rollback;
