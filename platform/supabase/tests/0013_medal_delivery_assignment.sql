begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

insert into public.challenges (id, code, public_name, reference_year, reference_month, sports_starts_at, sports_ends_at, status)
values
  ('91111111-1111-1111-1111-111111111111', 'delivery-assignment-a', 'Entrega Atribuicao A', 2026, 12, '2026-12-01 03:00+00', '2027-01-01 02:59:59+00', 'DRAFT'),
  ('91111111-1111-1111-1111-111111111112', 'delivery-assignment-b', 'Entrega Atribuicao B', 2027, 1, '2027-01-01 03:00+00', '2027-02-01 02:59:59+00', 'DRAFT');

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('92222222-2222-2222-2222-222222222221', '91111111-1111-1111-1111-111111111111', 300, '300 km');

insert into public.challenge_offers (id, challenge_id, internal_name, public_name, category_code, registration_starts_at, registration_ends_at, price, max_per_participant, status)
values ('93333333-3333-3333-3333-333333333331', '91111111-1111-1111-1111-111111111111', 'Oferta', 'Oferta', 'NORMAL', '2026-11-01 03:00+00', '2026-12-31 02:59:59+00', 44.90, 1, 'DRAFT');

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('93333333-3333-3333-3333-333333333331', '92222222-2222-2222-2222-222222222221');

insert into public.participants (id, full_name, city, state_code)
values ('94444444-4444-4444-4444-444444444441', 'Atleta Atribuicao', 'Santa Ines', 'MA');

insert into public.registrations (id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status)
values ('95555555-5555-5555-5555-555555555551', '94444444-4444-4444-4444-444444444441', '91111111-1111-1111-1111-111111111111', '92222222-2222-2222-2222-222222222221', '93333333-3333-3333-3333-333333333331', 1, 44.90, 'CONFIRMED');

insert into public.medal_deliveries (id, registration_id, challenge_id)
values ('96666666-6666-6666-6666-666666666661', '95555555-5555-5555-5555-555555555551', '91111111-1111-1111-1111-111111111111');

insert into public.medal_delivery_batches (id, challenge_id, method, label, responsible_name)
values
  ('97777777-7777-7777-7777-777777777771', '91111111-1111-1111-1111-111111111111', 'EVENT', 'Evento dezembro', 'Responsavel Evento'),
  ('97777777-7777-7777-7777-777777777772', '91111111-1111-1111-1111-111111111112', 'POSTAL', 'Outro desafio', 'Responsavel Outro');

select throws_ok(
  $$select public.assign_medal_delivery_to_batch('96666666-6666-6666-6666-666666666661', '97777777-7777-7777-7777-777777777772')$$,
  'Medal delivery batch must belong to the same challenge',
  'assignment rejects a batch from another challenge'
);

select lives_ok(
  $$select public.assign_medal_delivery_to_batch('96666666-6666-6666-6666-666666666661', '97777777-7777-7777-7777-777777777771')$$,
  'pending delivery can be assigned to a preparing batch'
);

select is(
  (select status from public.medal_deliveries where id = '96666666-6666-6666-6666-666666666661'),
  'ASSIGNED',
  'assignment moves delivery to assigned'
);

select throws_ok(
  $$select public.handoff_medal_delivery_batch('97777777-7777-7777-7777-777777777771', 'Responsavel Evento', '')$$,
  'Handoff evidence is required',
  'handoff requires evidence'
);

select is(
  public.handoff_medal_delivery_batch('97777777-7777-7777-7777-777777777771', 'Responsavel Evento', 'Registro de entrega no evento'),
  1,
  'handoff returns number of deliveries transferred'
);

select ok(
  (select status = 'AWAITING_CONFIRMATION' and handed_off_at is not null and handoff_evidence <> '' from public.medal_deliveries where id = '96666666-6666-6666-6666-666666666661'),
  'event handoff records evidence and waits for athlete confirmation'
);

select * from finish();
rollback;
