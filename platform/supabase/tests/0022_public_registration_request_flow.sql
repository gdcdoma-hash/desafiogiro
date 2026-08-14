begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

select ok(
  to_regprocedure('public.get_public_registration_catalog()') is not null,
  'public catalog RPC exists'
);

select ok(
  to_regprocedure('public.submit_public_registration_request(uuid,uuid,text,text,text,text,text)') is not null,
  'public registration request RPC exists'
);

insert into public.challenges (
  id, code, public_name, short_description, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status, is_public
) values (
  'c1111111-1111-1111-1111-111111111111',
  'public-request-flow',
  'Desafio Fluxo Público',
  'Teste do fluxo público de inscrição',
  2027,
  3,
  '2027-03-01 03:00+00',
  '2027-04-01 02:59:59+00',
  'ACTIVE',
  true
);

insert into public.challenge_goals (
  id, challenge_id, target_km, public_label, display_order
) values (
  'c2222222-2222-2222-2222-222222222221',
  'c1111111-1111-1111-1111-111111111111',
  300,
  '300 km',
  1
);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, max_per_participant, status
) values (
  'c3333333-3333-3333-3333-333333333331',
  'c1111111-1111-1111-1111-111111111111',
  'Oferta teste pública',
  'Inscrição teste',
  'NORMAL',
  now() - interval '1 day',
  now() + interval '1 day',
  44.90,
  1,
  'OPEN'
);

insert into public.challenge_offer_goals (offer_id, goal_id)
values (
  'c3333333-3333-3333-3333-333333333331',
  'c2222222-2222-2222-2222-222222222221'
);

set local role anon;

select is(
  (select count(*)::integer
   from public.get_public_registration_catalog()
   where challenge_code = 'public-request-flow'),
  1,
  'anon can read the filtered registration catalog through the RPC'
);

select lives_ok(
  $test$
    select public.submit_public_registration_request(
      'c3333333-3333-3333-3333-333333333331'::uuid,
      'c2222222-2222-2222-2222-222222222221'::uuid,
      '  Ciclista Teste  ',
      '+5598999999999',
      '  Santa Inês  ',
      'ma',
      '  1133  '
    )
  $test$,
  'anon can submit a valid public registration request'
);

reset role;

select is(
  (select full_name
   from public.public_registration_requests
   where offer_id = 'c3333333-3333-3333-3333-333333333331'::uuid),
  'Ciclista Teste',
  'request trims the participant name'
);

select is(
  (select city || '|' || state_code || '|' || referral_code
   from public.public_registration_requests
   where offer_id = 'c3333333-3333-3333-3333-333333333331'::uuid),
  'Santa Inês|MA|1133',
  'request normalizes city, state code and referral data'
);

set local role anon;

select throws_ok(
  $test$
    select public.submit_public_registration_request(
      'c3333333-3333-3333-3333-333333333331'::uuid,
      'c2222222-2222-2222-2222-222222222221'::uuid,
      'Ciclista Teste',
      '+5598999999999',
      'Santa Inês',
      'MA',
      '1133'
    )
  $test$,
  'P0001',
  'Já existe uma pré-inscrição pendente para este telefone e oferta',
  'duplicate pending request for the same phone and offer is rejected'
);

reset role;

select is(
  (select count(*)::integer
   from public.public_registration_requests
   where offer_id = 'c3333333-3333-3333-3333-333333333331'::uuid),
  1,
  'duplicate rejection does not create an extra request'
);

select * from finish();
rollback;
