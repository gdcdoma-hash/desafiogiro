begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

select has_function(
  'public',
  'resolve_challenge_offer_unit_price',
  array['uuid', 'integer', 'timestamp with time zone'],
  'central offer price resolver exists'
);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values (
  '61111111-1111-1111-1111-111111111111',
  'pricing-registration-test',
  'Pricing registration test',
  2026,
  8,
  '2026-08-01 00:00:00-03',
  '2026-09-01 00:00:00-03',
  'DRAFT'
);

insert into public.challenge_goals (
  id, challenge_id, target_km, public_label
) values (
  '62222222-2222-2222-2222-222222222222',
  '61111111-1111-1111-1111-111111111111',
  300,
  '300 km'
);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, pricing_mode,
  max_per_participant, status
) values
  (
    '63333333-3333-3333-3333-333333333333',
    '61111111-1111-1111-1111-111111111111',
    'Fixed offer',
    'Fixed offer',
    'NORMAL',
    '2026-01-01 00:00:00-03',
    '2026-12-31 23:59:59-03',
    55.00,
    'FIXED',
    1,
    'DRAFT'
  ),
  (
    '64444444-4444-4444-4444-444444444444',
    '61111111-1111-1111-1111-111111111111',
    'Lots offer',
    'Lots offer',
    'REPESCAGEM',
    '2026-01-01 00:00:00-03',
    '2026-12-31 23:59:59-03',
    null,
    'LOTS',
    3,
    'DRAFT'
  );

insert into public.challenge_offer_goals (offer_id, goal_id) values
  ('63333333-3333-3333-3333-333333333333', '62222222-2222-2222-2222-222222222222'),
  ('64444444-4444-4444-4444-444444444444', '62222222-2222-2222-2222-222222222222');

insert into public.challenge_pricing_groups (
  id, challenge_id, period_code, external_reference, internal_name
) values (
  '65555555-5555-5555-5555-555555555555',
  null,
  '2026-08',
  'AGO26_TEST',
  'August registration pricing test'
);

insert into public.challenge_pricing_group_offers (pricing_group_id, offer_id)
values (
  '65555555-5555-5555-5555-555555555555',
  '64444444-4444-4444-4444-444444444444'
);

insert into public.challenge_offer_price_lots (
  pricing_group_id, external_reference, internal_name,
  starts_at, ends_at, selection_mode, registration_count,
  unit_price, total_price, status
) values
  (
    '65555555-5555-5555-5555-555555555555',
    'AGO26_TEST_ANY',
    'Fallback price',
    '2026-01-01 00:00:00-03',
    '2026-12-31 23:59:59-03',
    'ANY',
    null,
    49.90,
    null,
    'ACTIVE'
  ),
  (
    '65555555-5555-5555-5555-555555555555',
    'AGO26_TEST_QTD_1',
    'One registration',
    '2026-01-01 00:00:00-03',
    '2026-12-31 23:59:59-03',
    'REGISTRATION_COUNT',
    1,
    44.90,
    44.90,
    'ACTIVE'
  );

select is(
  public.resolve_challenge_offer_unit_price(
    '63333333-3333-3333-3333-333333333333',
    1,
    '2026-08-16 12:00:00-03'
  ),
  55.00::numeric,
  'fixed offer resolution preserves fixed price behavior'
);

select is(
  public.resolve_challenge_offer_unit_price(
    '64444444-4444-4444-4444-444444444444',
    1,
    '2026-08-16 12:00:00-03'
  ),
  44.90::numeric,
  'exact registration-count lot wins over ANY fallback'
);

select is(
  public.resolve_challenge_offer_unit_price(
    '64444444-4444-4444-4444-444444444444',
    2,
    '2026-08-16 12:00:00-03'
  ),
  49.90::numeric,
  'ANY lot is used when no exact registration-count lot exists'
);

insert into public.participants (id, legacy_id_dgmb, full_name)
values
  ('66666666-6666-6666-6666-666666666666', 'pricing-user-historical', 'Historical Price User'),
  ('67777777-7777-7777-7777-777777777777', 'pricing-user-current', 'Current Price User'),
  ('68888888-8888-8888-8888-888888888888', 'pricing-user-fixed', 'Fixed Price User');

insert into public.registrations (
  id, participant_id, challenge_id, goal_id, offer_id,
  occurrence_number, price_snapshot, status, source_code
) values (
  '69999999-9999-9999-9999-999999999999',
  '66666666-6666-6666-6666-666666666666',
  '61111111-1111-1111-1111-111111111111',
  '62222222-2222-2222-2222-222222222222',
  '64444444-4444-4444-4444-444444444444',
  1,
  39.90,
  'PENDING',
  'MIGRATION'
);

select is(
  (select price_snapshot from public.registrations where id = '69999999-9999-9999-9999-999999999999'),
  39.90::numeric,
  'LOTS registration preserves an explicit historical price snapshot'
);

insert into public.registrations (
  id, participant_id, challenge_id, goal_id, offer_id,
  occurrence_number, price_snapshot, status, source_code
) values (
  '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '67777777-7777-7777-7777-777777777777',
  '61111111-1111-1111-1111-111111111111',
  '62222222-2222-2222-2222-222222222222',
  '64444444-4444-4444-4444-444444444444',
  1,
  null,
  'PENDING',
  'ADMIN'
);

select is(
  (select price_snapshot from public.registrations where id = '6aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  44.90::numeric,
  'LOTS registration resolves the current single-registration price when snapshot is omitted'
);

insert into public.registrations (
  id, participant_id, challenge_id, goal_id, offer_id,
  occurrence_number, price_snapshot, status, source_code
) values (
  '6bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '68888888-8888-8888-8888-888888888888',
  '61111111-1111-1111-1111-111111111111',
  '62222222-2222-2222-2222-222222222222',
  '63333333-3333-3333-3333-333333333333',
  1,
  999.00,
  'PENDING',
  'ADMIN'
);

select is(
  (select price_snapshot from public.registrations where id = '6bbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  55.00::numeric,
  'fixed registration still derives snapshot from the offer and ignores caller value'
);

insert into public.challenge_offer_price_lots (
  pricing_group_id, external_reference, internal_name,
  starts_at, ends_at, selection_mode, registration_count,
  unit_price, total_price, status
) values (
  '65555555-5555-5555-5555-555555555555',
  'AGO26_TEST_QTD_1_DUP',
  'Duplicate one-registration price',
  '2026-01-01 00:00:00-03',
  '2026-12-31 23:59:59-03',
  'REGISTRATION_COUNT',
  1,
  43.90,
  43.90,
  'ACTIVE'
);

select throws_ok(
  $$
    select public.resolve_challenge_offer_unit_price(
      '64444444-4444-4444-4444-444444444444',
      1,
      '2026-08-16 12:00:00-03'
    )
  $$,
  'Ambiguous active price lots match this offer and registration count',
  'ambiguous equally specific active lots are rejected instead of choosing arbitrarily'
);

select * from finish();
rollback;
