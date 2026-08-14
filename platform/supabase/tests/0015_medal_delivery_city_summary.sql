begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into public.challenges (id, code, public_name, reference_year, reference_month, sports_starts_at, sports_ends_at, status)
values ('b1111111-1111-1111-1111-111111111111', 'delivery-city-summary', 'Resumo Cidade', 2027, 3, '2027-03-01 03:00+00', '2027-04-01 02:59:59+00', 'DRAFT');

insert into public.challenge_goals (id, challenge_id, target_km, public_label)
values ('b2222222-2222-2222-2222-222222222222', 'b1111111-1111-1111-1111-111111111111', 300, '300 km');

insert into public.challenge_offers (id, challenge_id, internal_name, public_name, category_code, registration_starts_at, registration_ends_at, price, max_per_participant, status)
values ('b3333333-3333-3333-3333-333333333333', 'b1111111-1111-1111-1111-111111111111', 'Oferta', 'Oferta', 'NORMAL', '2027-02-01 03:00+00', '2027-03-31 02:59:59+00', 44.90, 2, 'DRAFT');

insert into public.challenge_offer_goals (offer_id, goal_id)
values ('b3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222');

insert into public.participants (id, full_name, city, state_code)
values
  ('b4444444-4444-4444-4444-444444444441', 'Atleta Um', 'Santa Ines', 'MA'),
  ('b4444444-4444-4444-4444-444444444442', 'Atleta Dois', 'Santa Ines', 'MA'),
  ('b4444444-4444-4444-4444-444444444443', 'Atleta Tres', 'Pindare Mirim', 'MA');

insert into public.registrations (id, participant_id, challenge_id, goal_id, offer_id, occurrence_number, price_snapshot, status)
values
  ('b5555555-5555-5555-5555-555555555551', 'b4444444-4444-4444-4444-444444444441', 'b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'b3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED'),
  ('b5555555-5555-5555-5555-555555555552', 'b4444444-4444-4444-4444-444444444442', 'b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'b3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED'),
  ('b5555555-5555-5555-5555-555555555553', 'b4444444-4444-4444-4444-444444444443', 'b1111111-1111-1111-1111-111111111111', 'b2222222-2222-2222-2222-222222222222', 'b3333333-3333-3333-3333-333333333333', 1, 44.90, 'CONFIRMED');

insert into public.medal_deliveries (id, registration_id, challenge_id)
values
  ('b6666666-6666-6666-6666-666666666661', 'b5555555-5555-5555-5555-555555555551', 'b1111111-1111-1111-1111-111111111111'),
  ('b6666666-6666-6666-6666-666666666662', 'b5555555-5555-5555-5555-555555555552', 'b1111111-1111-1111-1111-111111111111'),
  ('b6666666-6666-6666-6666-666666666663', 'b5555555-5555-5555-5555-555555555553', 'b1111111-1111-1111-1111-111111111111');

update public.medal_deliveries
set status = 'ASSIGNED'
where id = 'b6666666-6666-6666-6666-666666666662';

select is((select count(*)::integer from public.medal_delivery_city_summary where challenge_id = 'b1111111-1111-1111-1111-111111111111'), 2, 'summary groups deliveries by city');
select is((select total_deliveries from public.medal_delivery_city_summary where city = 'Santa Ines'), 2, 'city total is counted');
select is((select pending_count from public.medal_delivery_city_summary where city = 'Santa Ines'), 1, 'pending count is calculated');
select is((select assigned_count from public.medal_delivery_city_summary where city = 'Santa Ines'), 1, 'assigned count is calculated');
select is((select total_deliveries from public.medal_delivery_city_summary where city = 'Pindare Mirim'), 1, 'second city remains separate');

select * from finish();
rollback;
