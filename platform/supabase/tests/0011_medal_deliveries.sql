begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into public.challenges (id, code, public_name, reference_year, reference_month, sports_starts_at, sports_ends_at, status)
values
  ('81111111-1111-1111-1111-111111111111', 'delivery-test-a', 'Entrega Teste A', 2026, 10, '2026-10-01 03:00+00', '2026-11-01 02:59:59+00', 'DRAFT'),
  ('81111111-1111-1111-1111-111111111112', 'delivery-test-b', 'Entrega Teste B', 2026, 11, '2026-11-01 03:00+00', '2026-12-01 02:59:59+00', 'DRAFT');

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values
  ('82222222-2222-2222-2222-222222222221', '81111111-1111-1111-1111-111111111111', 300, '300 km'),
  ('82222222-2222-2222-2222-222222222222', '81111111-1111-1111-1111-111111111112', 500, '500 km');

insert into public.challenge_offers (id, challenge_id, internal_name, public_name, category_code, registration_starts_at, registration_ends_at, price, max_per_participant, status)
values
  ('83333333-3333-3333-3333-333333333331', '81111111-1111-1111-1111-111111111111', 'Oferta A', 'Oferta A', 'NORMAL', '2026-09-01 03:00+00', '2026-10-31 02:59:59+00', 44.90, 2, 'DRAFT'),
  ('83333333-3333-3333-3333-333333333332', '81111111-1111-1111-1111-111111111112', 'Oferta B', 'Oferta B', 'NORMAL', '2026-10-01 03:00+00', '2026-11-30 02:59:59+00', 44.90, 1, 'DRAFT');

insert into public.challenge_offer_goals (offer_id, goal_id)
values
  ('83333333-3333-3333-3333-333333333331', '82222222-2222-2222-2222-222222222221'),
  ('83333333-3333-3333-3333-333333333332', '82222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name, city, state_code)
values
  ('84444444-4444-4444-4444-444444444441', 'Atleta Confirmado', 'Santa Ines', 'MA'),
  ('84444444-4444-4444-4444-444444444442', 'Atleta Pendente', 'Santa Ines', 'MA');

insert into public.registrations (id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status)
values
  ('85555555-5555-5555-5555-555555555551', '84444444-4444-4444-4444-444444444441', '81111111-1111-1111-1111-111111111111', '82222222-2222-2222-2222-222222222221', '83333333-3333-3333-3333-333333333331', 1, 0, 'CONFIRMED'),
  ('85555555-5555-5555-5555-555555555552', '84444444-4444-4444-4444-444444444442', '81111111-1111-1111-1111-111111111111', '82222222-2222-2222-2222-222222222221', '83333333-3333-3333-3333-333333333331', 1, 0, 'PENDING');

select throws_ok(
  $$insert into public.medal_deliveries (registration_id, challenge_id) values ('85555555-5555-5555-5555-555555555552', '81111111-1111-1111-1111-111111111111')$$,
  'Medal delivery requires a confirmed or completed registration',
  'pending registration cannot enter medal delivery flow'
);

insert into public.medal_deliveries (id, registration_id, challenge_id)
values ('86666666-6666-6666-6666-666666666661', '85555555-5555-5555-5555-555555555551', '81111111-1111-1111-1111-111111111111');
select is((select status from public.medal_deliveries where id = '86666666-6666-6666-6666-666666666661'), 'PENDING', 'eligible delivery starts pending');

insert into public.medal_delivery_batches (id, challenge_id, method, label, city, state_code, responsible_name)
values
  ('87777777-7777-7777-7777-777777777771', '81111111-1111-1111-1111-111111111111', 'EVENT', 'Evento teste', 'Santa Ines', 'MA', 'Responsavel A'),
  ('87777777-7777-7777-7777-777777777772', '81111111-1111-1111-1111-111111111112', 'STORE_PICKUP', 'Lote outro desafio', 'Santa Ines', 'MA', 'Responsavel B');

select throws_ok(
  $$update public.medal_deliveries set batch_id = '87777777-7777-7777-7777-777777777772', status = 'ASSIGNED' where id = '86666666-6666-6666-6666-666666666661'$$,
  'Medal delivery batch must belong to the same challenge',
  'delivery cannot use batch from another challenge'
);

select throws_ok(
  $$update public.medal_deliveries set status = 'CONFIRMED' where id = '86666666-6666-6666-6666-666666666661'$$,
  'Invalid medal delivery status transition: PENDING -> CONFIRMED',
  'delivery cannot skip directly to confirmed'
);

update public.medal_deliveries
set batch_id = '87777777-7777-7777-7777-777777777771', status = 'ASSIGNED'
where id = '86666666-6666-6666-6666-666666666661';
select is((select status from public.medal_deliveries where id = '86666666-6666-6666-6666-666666666661'), 'ASSIGNED', 'delivery can be assigned to a valid batch');

update public.medal_deliveries set status = 'AWAITING_CONFIRMATION', handed_off_at = now(), handoff_recipient_name = 'Responsavel A'
where id = '86666666-6666-6666-6666-666666666661';
select is((select status from public.medal_deliveries where id = '86666666-6666-6666-6666-666666666661'), 'AWAITING_CONFIRMATION', 'handoff can wait for athlete confirmation');

update public.medal_deliveries set status = 'CONFIRMED'
where id = '86666666-6666-6666-6666-666666666661';
select ok((select athlete_confirmed_at is not null from public.medal_deliveries where id = '86666666-6666-6666-6666-666666666661'), 'confirmation timestamp is recorded automatically');

select throws_ok(
  $$update public.medal_deliveries set status = 'ISSUE_REPORTED' where id = '86666666-6666-6666-6666-666666666661'$$,
  'Invalid medal delivery status transition: CONFIRMED -> ISSUE_REPORTED',
  'confirmed delivery is final'
);

select * from finish();
rollback;
