begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_column(
  'public',
  'challenge_pricing_groups',
  'period_code',
  'pricing groups expose monthly period scope'
);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values
  (
    'd1111111-1111-1111-1111-111111111111',
    'monthly-scope-a-aug',
    'Monthly scope A August',
    2026,
    8,
    '2026-08-01 00:00:00-03',
    '2026-09-01 00:00:00-03',
    'DRAFT'
  ),
  (
    'd2222222-2222-2222-2222-222222222222',
    'monthly-scope-b-aug',
    'Monthly scope B August',
    2026,
    8,
    '2026-08-01 00:00:00-03',
    '2026-09-01 00:00:00-03',
    'DRAFT'
  ),
  (
    'd3333333-3333-3333-3333-333333333333',
    'monthly-scope-a-sep',
    'Monthly scope A September',
    2026,
    9,
    '2026-09-01 00:00:00-03',
    '2026-10-01 00:00:00-03',
    'DRAFT'
  );

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, pricing_mode,
  max_per_participant, status
) values
  (
    'e1111111-1111-1111-1111-111111111111',
    'd1111111-1111-1111-1111-111111111111',
    'August offer A',
    'August offer A',
    'NORMAL',
    '2026-07-01 00:00:00-03',
    '2026-08-31 23:59:59-03',
    null,
    'LOTS',
    1,
    'DRAFT'
  ),
  (
    'e2222222-2222-2222-2222-222222222222',
    'd2222222-2222-2222-2222-222222222222',
    'August offer B',
    'August offer B',
    'REPESCAGEM',
    '2026-08-01 00:00:00-03',
    '2026-08-31 23:59:59-03',
    null,
    'LOTS',
    3,
    'DRAFT'
  ),
  (
    'e3333333-3333-3333-3333-333333333333',
    'd3333333-3333-3333-3333-333333333333',
    'September offer',
    'September offer',
    'NORMAL',
    '2026-08-01 00:00:00-03',
    '2026-09-30 23:59:59-03',
    null,
    'LOTS',
    1,
    'DRAFT'
  );

insert into public.challenge_pricing_groups (
  id, challenge_id, period_code, external_reference, internal_name
) values (
  'f1111111-1111-1111-1111-111111111111',
  null,
  '2026-08',
  'AGO26',
  'August shared pricing'
);

select is(
  (select period_code from public.challenge_pricing_groups where id = 'f1111111-1111-1111-1111-111111111111'),
  '2026-08',
  'monthly pricing group stores normalized period code'
);

insert into public.challenge_pricing_group_offers (pricing_group_id, offer_id) values
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111'),
  ('f1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::integer from public.challenge_pricing_group_offers
   where pricing_group_id = 'f1111111-1111-1111-1111-111111111111'),
  2,
  'one monthly group can link offers from different challenge bases in the same month'
);

insert into public.challenge_offer_price_lots (
  pricing_group_id, external_reference, internal_name,
  starts_at, selection_mode, registration_count, unit_price, total_price
) values (
  'f1111111-1111-1111-1111-111111111111',
  'AGO26_QTD_3',
  'August three registrations',
  '2026-08-01 00:00:00-03',
  'REGISTRATION_COUNT',
  3,
  40.00,
  120.00
);

select is(
  (select total_price from public.challenge_offer_price_lots where external_reference = 'AGO26_QTD_3'),
  120.00::numeric,
  'monthly group price lot preserves total price'
);

select throws_ok(
  $$
    insert into public.challenge_pricing_group_offers (pricing_group_id, offer_id)
    values ('f1111111-1111-1111-1111-111111111111', 'e3333333-3333-3333-3333-333333333333')
  $$,
  'Monthly pricing group and offer must belong to the same period',
  'monthly group rejects an offer from another month'
);

select throws_ok(
  $$
    insert into public.challenge_pricing_groups (
      challenge_id, period_code, internal_name
    ) values (
      'd1111111-1111-1111-1111-111111111111',
      '2026-08',
      'Invalid dual scope'
    )
  $$,
  '23514',
  null,
  'pricing group rejects simultaneous challenge and monthly scope'
);

select throws_ok(
  $$
    insert into public.challenge_pricing_groups (
      challenge_id, period_code, internal_name
    ) values (
      null,
      null,
      'Invalid empty scope'
    )
  $$,
  '23514',
  null,
  'pricing group requires exactly one scope'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'challenge_pricing_groups_period_external_reference_uidx'
  ),
  'monthly pricing external references are indexed uniquely per period'
);

select * from finish();
rollback;
