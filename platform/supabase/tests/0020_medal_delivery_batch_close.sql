begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_function('public','close_medal_delivery_batch',array['uuid'],'batch close function exists');
select has_view('public','medal_delivery_batch_reconciliation','batch reconciliation view exists');

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values (
  'a1111111-1111-1111-1111-111111111111','delivery-close','Fechamento de Lote',2027,1,
  '2027-01-01 03:00+00','2027-02-01 02:59:59+00','DRAFT'
);

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('a2222222-2222-2222-2222-222222222222','a1111111-1111-1111-1111-111111111111',300,'300 km');

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, max_per_participant, status
) values (
  'a3333333-3333-3333-3333-333333333333','a1111111-1111-1111-1111-111111111111',
  'Oferta janeiro','Oferta janeiro','NORMAL','2026-12-01 03:00+00','2027-01-31 02:59:59+00',44.90,1,'DRAFT'
);

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('a3333333-3333-3333-3333-333333333333','a2222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name, city, state_code)
values
  ('a4444444-4444-4444-4444-444444444441','Atleta Confirmado','Santa Ines','MA'),
  ('a4444444-4444-4444-4444-444444444442','Atleta Pendente','Santa Ines','MA');

insert into public.registrations (
  id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status
) values
  ('a5555555-5555-5555-5555-555555555551','a4444444-4444-4444-4444-444444444441','a1111111-1111-1111-1111-111111111111','a2222222-2222-2222-2222-222222222222','a3333333-3333-3333-3333-333333333333',1,44.90,'CONFIRMED'),
  ('a5555555-5555-5555-5555-555555555552','a4444444-4444-4444-4444-444444444442','a1111111-1111-1111-1111-111111111111','a2222222-2222-2222-2222-222222222222','a3333333-3333-3333-3333-333333333333',1,44.90,'CONFIRMED');

insert into public.medal_delivery_batches (
  id, challenge_id, method, label, city, state_code, responsible_name, status, handed_over_at, handoff_evidence
) values (
  'a6666666-6666-6666-6666-666666666666','a1111111-1111-1111-1111-111111111111','EVENT',
  'Lote janeiro','Santa Ines','MA','Responsavel','HANDED_OFF',now(),'Registro de repasse'
);

insert into public.medal_deliveries (
  id, registration_id, challenge_id, batch_id, status, handed_off_at, handoff_recipient_name, handoff_evidence
) values
  ('a7777777-7777-7777-7777-777777777771','a5555555-5555-5555-5555-555555555551','a1111111-1111-1111-1111-111111111111','a6666666-6666-6666-6666-666666666666','CONFIRMED',now(),'Responsavel','Registro de repasse'),
  ('a7777777-7777-7777-7777-777777777772','a5555555-5555-5555-5555-555555555552','a1111111-1111-1111-1111-111111111111','a6666666-6666-6666-6666-666666666666','AWAITING_CONFIRMATION',now(),'Responsavel','Registro de repasse');

select is(
  (select open_count from public.medal_delivery_batch_reconciliation where batch_id = 'a6666666-6666-6666-6666-666666666666'),
  1,
  'reconciliation counts one open delivery'
);

select isnt(
  (select ready_to_close from public.medal_delivery_batch_reconciliation where batch_id = 'a6666666-6666-6666-6666-666666666666'),
  true,
  'batch is not ready while a delivery is open'
);

select throws_ok(
  $$select public.close_medal_delivery_batch('a6666666-6666-6666-6666-666666666666')$$,
  'Batch still has open medal deliveries',
  'batch cannot close with open deliveries'
);

update public.medal_deliveries
set status = 'CONFIRMED'
where id = 'a7777777-7777-7777-7777-777777777772';

select is(
  (select ready_to_close from public.medal_delivery_batch_reconciliation where batch_id = 'a6666666-6666-6666-6666-666666666666'),
  true,
  'batch becomes ready when every delivery is terminal'
);

select lives_ok(
  $$select public.close_medal_delivery_batch('a6666666-6666-6666-6666-666666666666')$$,
  'ready batch closes successfully'
);

select is(
  (select status from public.medal_delivery_batches where id = 'a6666666-6666-6666-6666-666666666666'),
  'CLOSED',
  'batch status becomes closed'
);

select * from finish();
rollback;
