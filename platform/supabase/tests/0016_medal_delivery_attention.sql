begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into public.challenges (id, code, public_name, reference_year, reference_month, sports_starts_at, sports_ends_at, status)
values ('c1111111-1111-1111-1111-111111111111', 'delivery-attention', 'Entrega Atencao', 2027, 4, '2027-04-01 03:00+00', '2027-05-01 02:59:59+00', 'DRAFT');

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 300, '300 km');

insert into public.challenge_offers (id, challenge_id, internal_name, public_name, category_code, registration_starts_at, registration_ends_at, price, max_per_participant, status)
values ('c3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'Oferta', 'Oferta', 'NORMAL', '2027-03-01 03:00+00', '2027-04-30 02:59:59+00', 44.90, 3, 'DRAFT');

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('c3333333-3333-3333-3333-333333333333', 'c2222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name, city, state_code)
values
  ('c4444444-4444-4444-4444-444444444441', 'Atleta Pendente', 'Santa Ines', 'MA'),
  ('c4444444-4444-4444-4444-444444444442', 'Atleta Aguardando', 'Santa Ines', 'MA'),
  ('c4444444-4444-4444-4444-444444444443', 'Atleta Problema', 'Santa Ines', 'MA');

insert into public.registrations (id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status)
values
  ('c5555555-5555-5555-5555-555555555551', 'c4444444-4444-4444-4444-444444444441', 'c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED'),
  ('c5555555-5555-5555-5555-555555555552', 'c4444444-4444-4444-4444-444444444442', 'c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED'),
  ('c5555555-5555-5555-5555-555555555553', 'c4444444-4444-4444-4444-444444444443', 'c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED');

insert into public.medal_deliveries (id, registration_id, challenge_id)
values
  ('c6666666-6666-6666-6666-666666666661', 'c5555555-5555-5555-5555-555555555551', 'c1111111-1111-1111-1111-111111111111'),
  ('c6666666-6666-6666-6666-666666666662', 'c5555555-5555-5555-5555-555555555552', 'c1111111-1111-1111-1111-111111111111'),
  ('c6666666-6666-6666-6666-666666666663', 'c5555555-5555-5555-5555-555555555553', 'c1111111-1111-1111-1111-111111111111');

update public.medal_deliveries
set status = 'ASSIGNED'
where id in ('c6666666-6666-6666-6666-666666666662','c6666666-6666-6666-6666-666666666663');

update public.medal_deliveries
set status = 'AWAITING_CONFIRMATION', handed_off_at = now() - interval '8 days', handoff_recipient_name = 'Responsavel', handoff_evidence = 'Registro'
where id = 'c6666666-6666-6666-6666-666666666662';

update public.medal_deliveries
set status = 'AWAITING_CONFIRMATION', handed_off_at = now(), handoff_recipient_name = 'Responsavel', handoff_evidence = 'Registro'
where id = 'c6666666-6666-6666-6666-666666666663';

update public.medal_deliveries
set status = 'ISSUE_REPORTED', issue_note = 'Nao recebeu'
where id = 'c6666666-6666-6666-6666-666666666663';

select is((select attention_reason from public.medal_delivery_attention where id = 'c6666666-6666-6666-6666-666666666661'), 'PENDING', 'pending delivery is highlighted');
select is((select attention_reason from public.medal_delivery_attention where id = 'c6666666-6666-6666-6666-666666666662'), 'AWAITING_7_DAYS', 'old handoff is highlighted after seven days');
select ok((select days_since_handoff >= 8 from public.medal_delivery_attention where id = 'c6666666-6666-6666-6666-666666666662'), 'days since handoff are calculated');
select is((select attention_priority from public.medal_delivery_attention where id = 'c6666666-6666-6666-6666-666666666663'), 1, 'reported issue has highest priority');

select * from finish();
rollback;
