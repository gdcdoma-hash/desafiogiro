begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

insert into public.participants(id,full_name) values
('91111111-1111-1111-1111-111111111111','Atleta Um'),
('92222222-2222-2222-2222-222222222222','Atleta Dois');

insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('93333333-3333-3333-3333-333333333333','payment-reservation','Pagamento Reserva',2026,12,'2026-12-01 03:00+00','2027-01-01 02:59:59+00','DRAFT');

insert into public.challenge_goals(id,challenge_id,target_km,public_label)
values ('94444444-4444-4444-4444-444444444444','93333333-3333-3333-3333-333333333333',300,'300 km');

insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status)
values ('95555555-5555-5555-5555-555555555555','93333333-3333-3333-3333-333333333333','Normal','Normal','NORMAL','2026-11-01 03:00+00','2026-11-30 02:59:59+00',44.90,1,'DRAFT');

insert into public.challenge_offer_goals(offer_id,goal_id)
values ('95555555-5555-5555-5555-555555555555','94444444-4444-4444-4444-444444444444');

insert into public.inventory_items(id,challenge_id,goal_id,code,public_name)
values ('96666666-6666-6666-6666-666666666666','93333333-3333-3333-3333-333333333333','94444444-4444-4444-4444-444444444444','medal-300','Medalha 300 km');
insert into public.inventory_movements(inventory_item_id,movement_type,quantity,reason_code)
values ('96666666-6666-6666-6666-666666666666','IN',2,'TEST');

insert into public.registrations(id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot)
values
('97777777-7777-7777-7777-777777777777','91111111-1111-1111-1111-111111111111','93333333-3333-3333-3333-333333333333','94444444-4444-4444-4444-444444444444','95555555-5555-5555-5555-555555555555',1,0),
('98888888-8888-8888-8888-888888888888','92222222-2222-2222-2222-222222222222','93333333-3333-3333-3333-333333333333','94444444-4444-4444-4444-444444444444','95555555-5555-5555-5555-555555555555',1,0);

select is((select status from public.registrations where id='97777777-7777-7777-7777-777777777777'),'PENDING','registration starts pending');

insert into public.registration_payments(registration_id,amount,status,method_code)
values ('97777777-7777-7777-7777-777777777777',44.90,'CONFIRMED','PIX');
select is((select status from public.registrations where id='97777777-7777-7777-7777-777777777777'),'CONFIRMED','full confirmed payment confirms registration');
select is((select status from public.inventory_reservations where registration_id='97777777-7777-7777-7777-777777777777'),'RESERVED','confirmed registration reserves medal');
select is((select reserved_quantity from public.inventory_availability where inventory_item_id='96666666-6666-6666-6666-666666666666'),1::bigint,'one medal is reserved');
select is((select available_balance from public.inventory_availability where inventory_item_id='96666666-6666-6666-6666-666666666666'),1::bigint,'available balance excludes reservation');

insert into public.registration_payments(registration_id,amount,status,method_code)
values ('98888888-8888-8888-8888-888888888888',20.00,'CONFIRMED','PIX');
select is((select status from public.registrations where id='98888888-8888-8888-8888-888888888888'),'PENDING','partial confirmed payment keeps registration pending');

insert into public.registration_payments(registration_id,amount,status,method_code)
values ('98888888-8888-8888-8888-888888888888',24.90,'CONFIRMED','PIX');
select is((select status from public.registrations where id='98888888-8888-8888-8888-888888888888'),'CONFIRMED','confirmed total reaching price confirms registration');

update public.registrations set status='CANCELLED' where id='97777777-7777-7777-7777-777777777777';
select is((select status from public.inventory_reservations where registration_id='97777777-7777-7777-7777-777777777777'),'RELEASED','cancellation releases reserved medal');

select * from finish();
rollback;
