begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(5);

insert into public.participants(id,full_name) values ('71111111-1111-1111-1111-111111111111','Participante Lifecycle');
insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('72222222-2222-2222-2222-222222222222','reg-lifecycle','Reg Lifecycle',2026,10,'2026-10-01 03:00+00','2026-11-01 02:59:59+00','DRAFT');
insert into public.challenge_goals(id,challenge_id,target_km) values ('73333333-3333-3333-3333-333333333333','72222222-2222-2222-2222-222222222222',300);
insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status)
values ('74444444-4444-4444-4444-444444444444','72222222-2222-2222-2222-222222222222','Normal','Normal','NORMAL','2026-09-01 03:00+00','2026-09-30 02:59:59+00',44.90,1,'DRAFT');
insert into public.challenge_offer_goals(offer_id,goal_id) values ('74444444-4444-4444-4444-444444444444','73333333-3333-3333-3333-333333333333');
insert into public.registrations(id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot)
values ('75555555-5555-5555-5555-555555555555','71111111-1111-1111-1111-111111111111','72222222-2222-2222-2222-222222222222','73333333-3333-3333-3333-333333333333','74444444-4444-4444-4444-444444444444',1,0);

update public.registrations set status='CONFIRMED' where id='75555555-5555-5555-5555-555555555555';
select is((select status from public.registrations where id='75555555-5555-5555-5555-555555555555'),'CONFIRMED','pending can confirm');
update public.registrations set status='COMPLETED' where id='75555555-5555-5555-5555-555555555555';
select is((select status from public.registrations where id='75555555-5555-5555-5555-555555555555'),'COMPLETED','confirmed can complete');
select throws_ok($$update public.registrations set status='CANCELLED' where id='75555555-5555-5555-5555-555555555555'$$,'Invalid registration status transition: COMPLETED -> CANCELLED','completed cannot cancel');

insert into public.registrations(id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot)
values ('76666666-6666-6666-6666-666666666666','71111111-1111-1111-1111-111111111111','72222222-2222-2222-2222-222222222222','73333333-3333-3333-3333-333333333333','74444444-4444-4444-4444-444444444444',2,0);
update public.registrations set status='CANCELLED' where id='76666666-6666-6666-6666-666666666666';
select is((select status from public.registrations where id='76666666-6666-6666-6666-666666666666'),'CANCELLED','pending can cancel');
select throws_ok($$update public.registrations set status='CONFIRMED' where id='76666666-6666-6666-6666-666666666666'$$,'Invalid registration status transition: CANCELLED -> CONFIRMED','cancelled cannot reopen');

select * from finish();
rollback;
