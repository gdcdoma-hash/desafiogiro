begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

select has_function(
  'public',
  'assign_pending_medal_deliveries_by_city',
  array['uuid','text','text'],
  'bulk city assignment function exists'
);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values (
  '91111111-1111-1111-1111-111111111111',
  'delivery-bulk-city',
  'Entrega por Cidade',
  2026,
  12,
  '2026-12-01 03:00+00',
  '2027-01-01 02:59:59+00',
  'DRAFT'
);

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('92222222-2222-2222-2222-222222222222', '91111111-1111-1111-1111-111111111111', 300, '300 km');

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price,
  max_per_participant, status
) values (
  '93333333-3333-3333-3333-333333333333',
  '91111111-1111-1111-1111-111111111111',
  'Oferta dezembro',
  'Oferta dezembro',
  'NORMAL',
  '2026-11-01 03:00+00',
  '2026-12-31 02:59:59+00',
  44.90,
  1,
  'DRAFT'
);

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('93333333-3333-3333-3333-333333333333', '92222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name, city, state_code)
values
  ('94444444-4444-4444-4444-444444444441', 'Atleta Cidade A', 'Santa Ines', 'MA'),
  ('94444444-4444-4444-4444-444444444442', 'Atleta Cidade B', 'Santa Ines', 'MA'),
  ('94444444-4444-4444-4444-444444444443', 'Atleta Outra Cidade', 'Bacabal', 'MA');

insert into public.registrations (
  id, participant_id, challenge_id, goal_id, offer_id,
  occurrence_number, price_snapshot, status
) values
  ('95555555-5555-5555-5555-555555555551', '94444444-4444-4444-4444-444444444441', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222222', '93333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED'),
  ('95555555-5555-5555-5555-555555555552', '94444444-4444-4444-4444-444444444442', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222222', '93333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED'),
  ('95555555-5555-5555-5555-555555555553', '94444444-4444-4444-4444-444444444443', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222222', '93333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED');

insert into public.medal_deliveries (id, registration_id, challenge_id)
values
  ('96666666-6666-6666-6666-666666666661', '95555555-5555-5555-5555-555555555551', '91111111-1111-1111-1111-111111111111'),
  ('96666666-6666-6666-6666-666666666662', '95555555-5555-5555-5555-555555555552', '91111111-1111-1111-1111-111111111111'),
  ('96666666-6666-6666-6666-666666666663', '95555555-5555-5555-5555-555555555553', '91111111-1111-1111-1111-111111111111');

insert into public.medal_delivery_batches (
  id, challenge_id, method, label, city, state_code, responsible_name
) values (
  '97777777-7777-7777-7777-777777777777',
  '91111111-1111-1111-1111-111111111111',
  'EVENT',
  'Lote Santa Ines',
  'Santa Ines',
  'MA',
  'Responsavel'
);

select is(
  public.assign_pending_medal_deliveries_by_city(
    '97777777-7777-7777-7777-777777777777',
    'Santa Ines',
    'ma'
  ),
  2,
  'assigns every pending delivery from selected city and state'
);

select results_eq(
  $$select count(*)::bigint from public.medal_deliveries where batch_id = '97777777-7777-7777-7777-777777777777' and status = 'ASSIGNED'$$,
  array[2::bigint],
  'two deliveries are assigned to the batch'
);

select is(
  (select status from public.medal_deliveries where id = '96666666-6666-6666-6666-666666666663'),
  'PENDING',
  'delivery from another city remains pending'
);

select throws_ok(
  $$select public.assign_pending_medal_deliveries_by_city('97777777-7777-7777-7777-777777777777', '', 'MA')$$,
  'City is required',
  'city is required for bulk assignment'
);

select throws_ok(
  $$select public.assign_pending_medal_deliveries_by_city('97777777-7777-7777-7777-777777777777', 'Santa Ines', 'M')$$,
  'State code must contain two letters',
  'state code is validated'
);

select * from finish();
rollback;
