begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

insert into public.participants(id,full_name)
values ('81111111-1111-1111-1111-111111111111','Participante Operação');
insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('82222222-2222-2222-2222-222222222222','ops-view','Operação Teste',2026,11,'2026-11-01 03:00+00','2026-12-01 02:59:59+00','DRAFT');
insert into public.challenge_goals(id,challenge_id,target_km,public_label)
values ('83333333-3333-3333-3333-333333333333','82222222-2222-2222-2222-222222222222',300,'300 km');
insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status)
values ('84444444-4444-4444-4444-444444444444','82222222-2222-2222-2222-222222222222','Normal','Normal','NORMAL','2026-10-01 03:00+00','2026-10-31 02:59:59+00',44.90,1,'DRAFT');
insert into public.challenge_offer_goals(offer_id,goal_id)
values ('84444444-4444-4444-4444-444444444444','83333333-3333-3333-3333-333333333333');
insert into public.registrations(id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot)
values ('85555555-5555-5555-5555-555555555555','81111111-1111-1111-1111-111111111111','82222222-2222-2222-2222-222222222222','83333333-3333-3333-3333-333333333333','84444444-4444-4444-4444-444444444444',1,0);
insert into public.inventory_items(id,challenge_id,goal_id,code,public_name)
values ('87777777-7777-7777-7777-777777777777','82222222-2222-2222-2222-222222222222','83333333-3333-3333-3333-333333333333','MEDAL-300','Medalha 300 km');
insert into public.inventory_movements(inventory_item_id,movement_type,quantity,reason_code)
values ('87777777-7777-7777-7777-777777777777','IN',1,'TEST_SETUP');

select is((select participant_name from public.registration_operations_overview where registration_id='85555555-5555-5555-5555-555555555555'),'Participante Operação','overview resolves participant');
select is((select payment_summary from public.registration_operations_overview where registration_id='85555555-5555-5555-5555-555555555555'),'UNPAID','registration starts unpaid');

insert into public.registration_payments(registration_id,amount,status)
values ('85555555-5555-5555-5555-555555555555',44.90,'PENDING');
select is((select payment_summary from public.registration_operations_overview where registration_id='85555555-5555-5555-5555-555555555555'),'PENDING','pending payment is visible');

update public.registration_payments set status='CONFIRMED' where registration_id='85555555-5555-5555-5555-555555555555';
select is((select payment_summary from public.registration_operations_overview where registration_id='85555555-5555-5555-5555-555555555555'),'PAID','confirmed amount marks paid');

select * from finish();
rollback;
