begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status, is_public
) values (
  'd1111111-1111-1111-1111-111111111111', 'v1-e2e-core', 'V1 E2E Core', 2027, 4,
  now() - interval '1 day', now() + interval '30 days', 'ACTIVE', true
);

insert into public.challenge_goals (id, challenge_id, target_km, public_label, display_order)
values ('d2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 300, '300 km', 1);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, max_per_participant, status
) values (
  'd3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111',
  'V1 E2E', 'Inscrição V1 E2E', 'NORMAL', now() - interval '1 day', now() + interval '1 day', 44.90, 1, 'OPEN'
);
insert into public.challenge_offer_goals (offer_id, goal_id)
values ('d3333333-3333-3333-3333-333333333333', 'd2222222-2222-2222-2222-222222222222');

set local role anon;
select lives_ok($q$
  select public.submit_public_registration_request(
    'd3333333-3333-3333-3333-333333333333'::uuid,
    'd2222222-2222-2222-2222-222222222222'::uuid,
    'Ciclista V1', '+5598999990001', 'Santa Inês', 'MA', '1133')
$q$, 'public request is accepted');
reset role;

select is((select status from public.public_registration_requests where phone_e164 = '+5598999990001'), 'RECEIVED', 'request enters admin queue');

-- Unit-test the definer processing path while preserving its permission guard contract.
create or replace function public.has_permission(required_permission text)
returns boolean language sql stable as $$ select true $$;

select lives_ok($q$
  select public.process_public_registration_request(
    (select id from public.public_registration_requests where phone_e164 = '+5598999990001'))
$q$, 'admin processing creates operational records');

select is((select status from public.public_registration_requests where phone_e164 = '+5598999990001'), 'PROCESSED', 'request is marked processed');
select is((select count(*)::integer from public.participants where phone_e164 = '+5598999990001'), 1, 'participant is created exactly once');
select is((select r.status || '|' || r.price_snapshot::text from public.registrations r join public.participants p on p.id=r.participant_id where p.phone_e164 = '+5598999990001'), 'PENDING|44.90', 'registration keeps pending status and price snapshot');
select is((select rp.status || '|' || rp.method_code || '|' || rp.amount::text from public.registration_payments rp join public.registrations r on r.id=rp.registration_id join public.participants p on p.id=r.participant_id where p.phone_e164 = '+5598999990001'), 'PENDING|PIX|44.90', 'pending PIX payment is created consistently');

select * from finish();
rollback;
