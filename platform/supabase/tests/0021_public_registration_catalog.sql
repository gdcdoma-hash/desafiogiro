begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

select has_view('public','public_registration_catalog','public registration catalog view exists');

insert into public.challenges (
  id, code, public_name, short_description, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status, is_public
) values
  ('b1111111-1111-1111-1111-111111111111','public-open','Desafio Público','Visível para inscrição',2027,2,'2027-02-01 03:00+00','2027-03-01 02:59:59+00','ACTIVE',true),
  ('b1111111-1111-1111-1111-111111111112','private-open','Desafio Privado','Não deve aparecer',2027,2,'2027-02-01 03:00+00','2027-03-01 02:59:59+00','ACTIVE',false);

insert into public.challenge_goals (id, challenge_id, target_km, public_label, display_order)
values
  ('b2222222-2222-2222-2222-222222222221','b1111111-1111-1111-1111-111111111111',300,'300 km',1),
  ('b2222222-2222-2222-2222-222222222222','b1111111-1111-1111-1111-111111111111',500,'500 km',2),
  ('b2222222-2222-2222-2222-222222222223','b1111111-1111-1111-1111-111111111112',300,'300 km',1);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, max_per_participant, status
) values
  ('b3333333-3333-3333-3333-333333333331','b1111111-1111-1111-1111-111111111111','Oferta aberta','Inscrição normal','NORMAL',now() - interval '1 day',now() + interval '1 day',44.90,1,'OPEN'),
  ('b3333333-3333-3333-3333-333333333332','b1111111-1111-1111-1111-111111111111','Oferta fechada','Oferta antiga','NORMAL',now() - interval '3 days',now() - interval '1 day',39.90,1,'CLOSED'),
  ('b3333333-3333-3333-3333-333333333333','b1111111-1111-1111-1111-111111111112','Oferta privada','Oferta privada','NORMAL',now() - interval '1 day',now() + interval '1 day',44.90,1,'OPEN');

insert into public.challenge_offer_goals (offer_id, goal_id)
values
  ('b3333333-3333-3333-3333-333333333331','b2222222-2222-2222-2222-222222222221'),
  ('b3333333-3333-3333-3333-333333333331','b2222222-2222-2222-2222-222222222222'),
  ('b3333333-3333-3333-3333-333333333332','b2222222-2222-2222-2222-222222222221'),
  ('b3333333-3333-3333-3333-333333333333','b2222222-2222-2222-2222-222222222223');

select is(
  (select count(*)::integer from public.public_registration_catalog where challenge_code = 'public-open'),
  2,
  'catalog exposes active goals from the open public offer'
);

select is(
  (select count(*)::integer from public.public_registration_catalog where challenge_code = 'private-open'),
  0,
  'catalog hides non-public challenges'
);

select is(
  (select count(*)::integer from public.public_registration_catalog where offer_name = 'Oferta antiga'),
  0,
  'catalog hides closed offers'
);

select is(
  (select price from public.public_registration_catalog where challenge_code = 'public-open' order by target_km limit 1),
  44.90::numeric,
  'catalog preserves the configured offer price'
);

select * from finish();
rollback;
