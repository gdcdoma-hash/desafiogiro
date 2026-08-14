begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

insert into public.challenges (id, code, public_name, reference_year, reference_month, sports_starts_at, sports_ends_at, status)
values ('91111111-1111-1111-1111-111111111111', 'delivery-period-test', 'Periodo de Entrega', 2026, 12, '2026-12-01 03:00+00', '2027-01-01 02:59:59+00', 'DRAFT');

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('92222222-2222-2222-2222-222222222222', '91111111-1111-1111-1111-111111111111', 300, '300 km');

insert into public.challenge_offers (id, challenge_id, internal_name, public_name, category_code, registration_starts_at, registration_ends_at, price, max_per_participant, status)
values ('93333333-3333-3333-3333-333333333333', '91111111-1111-1111-1111-111111111111', 'Oferta', 'Oferta', 'NORMAL', '2026-11-01 03:00+00', '2026-12-31 02:59:59+00', 44.90, 3, 'DRAFT');

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('93333333-3333-3333-3333-333333333333', '92222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name)
values
  ('94444444-4444-4444-4444-444444444441', 'Atleta Um'),
  ('94444444-4444-4444-4444-444444444442', 'Atleta Dois'),
  ('94444444-4444-4444-4444-444444444443', 'Atleta Tres');

insert into public.registrations (id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status)
values
  ('95555555-5555-5555-5555-555555555551', '94444444-4444-4444-4444-444444444441', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222222', '93333333-3333-3333-3333-333333333333', 1, 0, 'CONFIRMED'),
  ('95555555-5555-5555-5555-555555555552', '94444444-4444-4444-4444-444444444442', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222222', '93333333-3333-3333-3333-333333333333', 1, 0, 'PENDING'),
  ('95555555-5555-5555-5555-555555555553', '94444444-4444-4444-4444-444444444443', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222222', '93333333-3333-3333-3333-333333333333', 1, 0, 'PENDING');

select is(
  public.activate_medal_delivery_period('91111111-1111-1111-1111-111111111111', '2027-01-05 03:00+00', '2027-02-01 03:00+00', 'Entrega inicial'),
  1,
  'activation creates delivery for already confirmed registration'
);
select is((select status from public.medal_delivery_periods where challenge_id = '91111111-1111-1111-1111-111111111111'), 'OPEN', 'delivery period is open');
select results_eq('select count(*)::integer from public.medal_deliveries where challenge_id = ''91111111-1111-1111-1111-111111111111''', array[1], 'only eligible registration entered initially');

update public.registrations set status = 'CONFIRMED' where id = '95555555-5555-5555-5555-555555555552';
select results_eq('select count(*)::integer from public.medal_deliveries where challenge_id = ''91111111-1111-1111-1111-111111111111''', array[2], 'newly confirmed registration enters open delivery period automatically');

select is(
  public.activate_medal_delivery_period('91111111-1111-1111-1111-111111111111', '2027-01-05 03:00+00', '2027-02-01 03:00+00', 'Entrega inicial'),
  0,
  'reactivation is idempotent for existing deliveries'
);

select public.close_medal_delivery_period('91111111-1111-1111-1111-111111111111');
update public.registrations set status = 'CONFIRMED' where id = '95555555-5555-5555-5555-555555555553';
select results_eq('select count(*)::integer from public.medal_deliveries where challenge_id = ''91111111-1111-1111-1111-111111111111''', array[2], 'closed period does not enroll later confirmations');

select * from finish();
rollback;
