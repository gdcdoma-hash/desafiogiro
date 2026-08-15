begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

select has_table(
  'public',
  'challenge_offer_price_lots',
  'challenge offer price lots table exists'
);
select has_column(
  'public',
  'challenge_offers',
  'pricing_mode',
  'challenge offers expose pricing mode'
);
select has_column(
  'public',
  'public_registration_catalog',
  'pricing_mode',
  'public catalog exposes pricing mode'
);
select ok(
  (select relrowsecurity
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname = 'challenge_offer_price_lots'),
  'RLS enabled on challenge offer price lots'
);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values (
  '91111111-1111-1111-1111-111111111111',
  'pricing-lots-test',
  'Pricing lots test',
  2026,
  8,
  '2026-08-01 00:00:00-03',
  '2026-08-31 23:59:59-03',
  'DRAFT'
);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price,
  max_per_participant, status
) values (
  '92222222-2222-2222-2222-222222222222',
  '91111111-1111-1111-1111-111111111111',
  'Fixed pricing',
  'Fixed pricing',
  'NORMAL',
  '2026-07-01 00:00:00-03',
  '2026-08-31 23:59:59-03',
  44.90,
  1,
  'DRAFT'
);

select is(
  (select pricing_mode from public.challenge_offers where id = '92222222-2222-2222-2222-222222222222'),
  'FIXED',
  'existing offer behavior defaults to FIXED pricing'
);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, pricing_mode,
  max_per_participant, status
) values (
  '93333333-3333-3333-3333-333333333333',
  '91111111-1111-1111-1111-111111111111',
  'Lot pricing',
  'Lot pricing',
  'NORMAL',
  '2026-07-01 00:00:00-03',
  '2026-08-31 23:59:59-03',
  null,
  'LOTS',
  4,
  'DRAFT'
);

select is(
  (select pricing_mode from public.challenge_offers where id = '93333333-3333-3333-3333-333333333333'),
  'LOTS',
  'LOTS pricing does not require a manufactured fixed price'
);

insert into public.challenge_offer_price_lots (
  offer_id, external_reference, internal_name,
  starts_at, ends_at, selection_mode, registration_count,
  unit_price, total_price
) values (
  '93333333-3333-3333-3333-333333333333',
  'fixture-lot-1',
  'Fixture one registration',
  '2026-08-01 00:00:00-03',
  '2026-08-11 00:00:00-03',
  'REGISTRATION_COUNT',
  1,
  44.90,
  44.90
);

select is(
  (select unit_price from public.challenge_offer_price_lots where external_reference = 'fixture-lot-1'),
  44.90::numeric,
  'price lot preserves its unit price'
);

select throws_ok(
  $$
    insert into public.challenge_offer_price_lots (
      offer_id, internal_name, starts_at, selection_mode, unit_price
    ) values (
      '92222222-2222-2222-2222-222222222222',
      'Invalid lot on fixed offer',
      '2026-08-01 00:00:00-03',
      'ANY',
      44.90
    )
  $$,
  'Price lots require an offer with LOTS pricing mode',
  'fixed-price offers reject price lots'
);

select throws_ok(
  $$
    update public.challenge_offers
    set pricing_mode = 'FIXED', price = 44.90
    where id = '93333333-3333-3333-3333-333333333333'
  $$,
  'Cannot switch an offer with price lots to FIXED pricing',
  'offers with price lots cannot be flattened back to FIXED pricing'
);

select * from finish();
rollback;
