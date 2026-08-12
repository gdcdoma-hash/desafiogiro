begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_table('public', 'registrations', 'registrations table exists');
select ok(exists(select 1 from public.app_permissions where code='registrations.read'),'registrations.read exists');
select ok(exists(select 1 from public.app_permissions where code='registrations.manage'),'registrations.manage exists');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='registrations'),'RLS enabled');

insert into public.participants(id,full_name) values ('51111111-1111-1111-1111-111111111111','Pessoa Teste');
insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status) values ('52222222-2222-2222-2222-222222222222','reg-test','Reg Test',2026,10,'2026-10-01 03:00+00','2026-11-01 02:59:59+00','DRAFT');
insert into public.challenge_goals(id,challenge_id,target_km,public_label) values ('53333333-3333-3333-3333-333333333333','52222222-2222-2222-2222-222222222222',300,'300 km');
insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status) values ('54444444-4444-4444-4444-444444444444','52222222-2222-2222-2222-222222222222','Oferta teste','Oferta teste','NORMAL','2026-09-01 03:00+00','2026-09-30 02:59:59+00',44.90,1,'DRAFT');
insert into public.challenge_offer_goals(offer_id,goal_id) values ('54444444-4444-4444-4444-444444444444','53333333-3333-3333-3333-333333333333');

insert into public.registrations(participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot) values ('51111111-1111-1111-1111-111111111111','52222222-2222-2222-2222-222222222222','53333333-3333-3333-3333-333333333333','54444444-4444-4444-4444-444444444444',1,0);

select is((select price_snapshot from public.registrations limit 1),44.90::numeric,'price snapshot comes from offer');
select is((select status from public.registrations limit 1),'PENDING','default registration status');
select throws_ok($$insert into public.registrations(participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot) values ('51111111-1111-1111-1111-111111111111','52222222-2222-2222-2222-222222222222','53333333-3333-3333-3333-333333333333','54444444-4444-4444-4444-444444444444',2,0)$$,'Participant reached the registration limit for this offer','offer limit is enforced');
select throws_ok($$update public.registrations set goal_id='53333333-3333-3333-3333-333333333333', occurrence_number=2 where participant_id='51111111-1111-1111-1111-111111111111'$$,'Registration structural fields are immutable after creation','structural fields lock after creation');

select * from finish();
rollback;
