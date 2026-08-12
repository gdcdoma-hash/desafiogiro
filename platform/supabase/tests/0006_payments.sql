begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_table('public','registration_payments','payments table exists');
select ok(exists(select 1 from public.app_permissions where code='payments.read'),'payments.read permission exists');
select ok(exists(select 1 from public.app_permissions where code='payments.manage'),'payments.manage permission exists');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='registration_payments'),'RLS enabled on payments');

insert into public.participants(id,full_name) values ('81111111-1111-1111-1111-111111111111','Participante Pagamento');
insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('82222222-2222-2222-2222-222222222222','payment-test','Payment Test',2026,11,'2026-11-01 03:00+00','2026-12-01 02:59:59+00','DRAFT');
insert into public.challenge_goals(id,challenge_id,target_km) values ('83333333-3333-3333-3333-333333333333','82222222-2222-2222-2222-222222222222',300);
insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status)
values ('84444444-4444-4444-4444-444444444444','82222222-2222-2222-2222-222222222222','Normal','Normal','NORMAL','2026-10-01 03:00+00','2026-10-31 02:59:59+00',44.90,1,'DRAFT');
insert into public.challenge_offer_goals(offer_id,goal_id) values ('84444444-4444-4444-4444-444444444444','83333333-3333-3333-3333-333333333333');
insert into public.registrations(id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot)
values ('85555555-5555-5555-5555-555555555555','81111111-1111-1111-1111-111111111111','82222222-2222-2222-2222-222222222222','83333333-3333-3333-3333-333333333333','84444444-4444-4444-4444-444444444444',1,0);

insert into public.registration_payments(id,registration_id,amount,method_code)
values ('86666666-6666-6666-6666-666666666666','85555555-5555-5555-5555-555555555555',44.90,'PIX');
select is((select status from public.registration_payments where id='86666666-6666-6666-6666-666666666666'),'PENDING','payment starts pending');
update public.registration_payments set status='CONFIRMED' where id='86666666-6666-6666-6666-666666666666';
select is((select status from public.registration_payments where id='86666666-6666-6666-6666-666666666666'),'CONFIRMED','pending payment can confirm');
select ok((select paid_at is not null from public.registration_payments where id='86666666-6666-6666-6666-666666666666'),'confirmation stamps paid_at');
select throws_ok($$update public.registration_payments set amount=45.00 where id='86666666-6666-6666-6666-666666666666'$$,'Payment structural fields are immutable after creation','payment amount is immutable');

select * from finish();
rollback;
