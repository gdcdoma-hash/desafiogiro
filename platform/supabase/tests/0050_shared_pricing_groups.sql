begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

select has_table(
  'public',
  'challenge_pricing_groups',
  'shared challenge pricing groups table exists'
);
select has_table(
  'public',
  'challenge_pricing_group_offers',
  'pricing group offer links table exists'
);
select has_column(
  'public',
  'challenge_offer_price_lots',
  'pricing_group_id',
  'price lots can be scoped to a shared pricing group'
);
select ok(
  (select relrowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'challenge_pricing_groups'),
  'RLS enabled on shared pricing groups'
);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values
  (
    'a1111111-1111-1111-1111-111111111111',
    'shared-pricing-aug',
    'Shared pricing August',
    2026,
    8,
    '2026-08-01 00:00:00-03',
    '2026-09-01 00:00:00-03',
    'DRAFT'
  ),
  (
    'a2222222-2222-2222-2222-222222222222',
    'shared-pricing-sep',
    'Shared pricing September',
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
    'b1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111',
    'August normal',
    'August normal',
    'NORMAL',
    '2026-07-01 00:00:00-03',
    '2026-08-31 23:59:59-03',
    null,
    'LOTS',
    1,
    'DRAFT'
  ),
  (
    'b2222222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111111',
    'August repescagem',
    'August repescagem',
    'REPESCAGEM',
    '2026-08-01 00:00:00-03',
    '2026-08-31 23:59:59-03',
    null,
    'LOTS',
    3,
    'DRAFT'
  ),
  (
    'b3333333-3333-3333-3333-333333333333',
    'a1111111-1111-1111-1111-111111111111',
    'August fixed',
    'August fixed',
    'NORMAL',
    '2026-07-01 00:00:00-03',
    '2026-08-31 23:59:59-03',
    44.90,
    'FIXED',
    1,
    'DRAFT'
  ),
  (
    'b4444444-4444-4444-4444-444444444444',
    'a2222222-2222-2222-2222-222222222222',
    'September lots',
    'September lots',
    'NORMAL',
    '2026-08-01 00:00:00-03',
    '2026-09-30 23:59:59-03',
    null,
    'LOTS',
    1,
    'DRAFT'
  );

insert into public.challenge_pricing_groups (
  id, challenge_id, external_reference, internal_name
) values (
  'c1111111-1111-1111-1111-111111111111',
  'a1111111-1111-1111-1111-111111111111',
  'AGO26',
  'August shared pricing'
);

insert into public.challenge_pricing_group_offers (pricing_group_id, offer_id) values
  ('c1111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111'),
  ('c1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222');

select is(
  (select count(*)::integer from public.challenge_pricing_group_offers
   where pricing_group_id = 'c1111111-1111-1111-1111-111111111111'),
  2,
  'one monthly pricing group can serve multiple offers'
);

insert into public.challenge_offer_price_lots (
  pricing_group_id, external_reference, internal_name,
  starts_at, ends_at, selection_mode, registration_count,
  unit_price, total_price
) values (
  'c1111111-1111-1111-1111-111111111111',
  'AGO26_QTD_2',
  'August two registrations',
  '2026-08-01 00:00:00-03',
  '2026-09-01 00:00:00-03',
  'REGISTRATION_COUNT',
  2,
  40.00,
  80.00
);

select is(
  (select registration_count from public.challenge_offer_price_lots
   where external_reference = 'AGO26_QTD_2'),
  2,
  'shared price lot preserves pending-registration quantity rule'
);

select throws_ok(
  $$
    insert into public.challenge_pricing_group_offers (pricing_group_id, offer_id)
    values ('c1111111-1111-1111-1111-111111111111', 'b3333333-3333-3333-3333-333333333333')
  $$,
  'Shared pricing groups require offers with LOTS pricing mode',
  'fixed-price offer cannot join a shared pricing group'
);

select throws_ok(
  $$
    insert into public.challenge_pricing_group_offers (pricing_group_id, offer_id)
    values ('c1111111-1111-1111-1111-111111111111', 'b4444444-4444-4444-4444-444444444444')
  $$,
  'Pricing group and offer must belong to the same challenge',
  'pricing group cannot span different monthly challenge editions'
);

select throws_ok(
  $$
    update public.challenge_offers
    set pricing_mode = 'FIXED', price = 44.90
    where id = 'b1111111-1111-1111-1111-111111111111'
  $$,
  'Cannot switch an offer with shared price lots to FIXED pricing',
  'offer linked to shared pricing cannot be flattened to FIXED'
);

select throws_ok(
  $$
    insert into public.challenge_offer_price_lots (
      offer_id, pricing_group_id, internal_name, starts_at, unit_price
    ) values (
      'b1111111-1111-1111-1111-111111111111',
      'c1111111-1111-1111-1111-111111111111',
      'Invalid dual scope',
      '2026-08-01 00:00:00-03',
      40.00
    )
  $$,
  'Price lot must belong to exactly one offer or pricing group',
  'price lot rejects simultaneous offer and group scope'
);

select * from finish();
rollback;
