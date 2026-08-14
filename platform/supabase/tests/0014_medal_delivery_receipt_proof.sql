begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into public.challenges (id, code, public_name, reference_year, reference_month, sports_starts_at, sports_ends_at, status)
values ('a1111111-1111-1111-1111-111111111111', 'delivery-proof', 'Entrega Comprovacao', 2027, 2, '2027-02-01 03:00+00', '2027-03-01 02:59:59+00', 'DRAFT');

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('a2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 300, '300 km');

insert into public.challenge_offers (id, challenge_id, internal_name, public_name, category_code, registration_starts_at, registration_ends_at, price, max_per_participant, status)
values ('a3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'Oferta', 'Oferta', 'NORMAL', '2027-01-01 03:00+00', '2027-02-28 02:59:59+00', 44.90, 1, 'DRAFT');

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('a3333333-3333-3333-3333-333333333333', 'a2222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name, city, state_code)
values ('a4444444-4444-4444-4444-444444444444', 'Atleta Comprovacao', 'Santa Ines', 'MA');

insert into public.registrations (id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status)
values ('a5555555-5555-5555-5555-555555555555', 'a4444444-4444-4444-4444-444444444444', 'a1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED');

insert into public.medal_deliveries (id, registration_id, challenge_id, status, handed_off_at, handoff_recipient_name, handoff_evidence)
values ('a6666666-6666-6666-6666-666666666666', 'a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'AWAITING_CONFIRMATION', now(), 'Responsavel', 'Registro de repasse');

select throws_ok(
  $$select public.report_medal_delivery_issue('a6666666-6666-6666-6666-666666666666', 'nao')$$,
  'Issue description is required',
  'issue requires a meaningful description'
);

select lives_ok(
  $$select public.report_medal_delivery_issue('a6666666-6666-6666-6666-666666666666', 'Atleta informou que ainda nao recebeu')$$,
  'awaiting delivery can report an issue'
);

select is(
  (select status from public.medal_deliveries where id = 'a6666666-6666-6666-6666-666666666666'),
  'ISSUE_REPORTED',
  'issue changes delivery status'
);

select throws_ok(
  $$select public.resume_medal_delivery_confirmation('a6666666-6666-6666-6666-666666666666', 'ok')$$,
  'Resolution note is required',
  'issue resolution requires a note'
);

select lives_ok(
  $$select public.resume_medal_delivery_confirmation('a6666666-6666-6666-6666-666666666666', 'Medalha localizada com o responsavel')$$,
  'resolved issue returns to receipt confirmation'
);

select lives_ok(
  $$select public.confirm_medal_delivery_receipt('a6666666-6666-6666-6666-666666666666', 'Recebimento confirmado pelo atleta')$$,
  'receipt can be confirmed'
);

select ok(
  (select status = 'CONFIRMED' and athlete_confirmed_at is not null and athlete_confirmation_note = 'Recebimento confirmado pelo atleta' from public.medal_deliveries where id = 'a6666666-6666-6666-6666-666666666666'),
  'confirmation stores timestamp and note'
);

select * from finish();
rollback;
