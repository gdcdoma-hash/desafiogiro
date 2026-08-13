begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status,is_public)
values ('91111111-1111-1111-1111-111111111111','challenge-overview','Challenge Overview',2026,12,'2026-12-01 03:00+00','2027-01-01 02:59:59+00','ACTIVE',true);

insert into public.challenge_goals(id,challenge_id,target_km,public_label,is_active)
values
('92222222-2222-2222-2222-222222222221','91111111-1111-1111-1111-111111111111',300,'300 km',true),
('92222222-2222-2222-2222-222222222222','91111111-1111-1111-1111-111111111111',500,'500 km',false);

insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status)
values
('93333333-3333-3333-3333-333333333331','91111111-1111-1111-1111-111111111111','Normal dezembro','Inscrição Dezembro','NORMAL','2026-11-01 03:00+00','2026-12-10 02:59:59+00',44.90,1,'OPEN'),
('93333333-3333-3333-3333-333333333332','91111111-1111-1111-1111-111111111111','Repescagem dezembro','Repescagem Dezembro','REPESCAGEM','2026-12-11 03:00+00','2026-12-20 02:59:59+00',54.90,1,'DRAFT');

select is((select goal_count from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),2::bigint,'goal count is exposed');
select is((select active_goal_count from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),1::bigint,'active goal count is exposed');
select is((select offer_count from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),2::bigint,'offer count is exposed');
select is((select open_offer_count from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),1::bigint,'open offer count is exposed');
select is((select registration_count from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),0::bigint,'registration count starts at zero');
select is((select status from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),'ACTIVE','challenge status is exposed');
select is((select is_public from public.challenge_operations_overview where challenge_id='91111111-1111-1111-1111-111111111111'),true,'visibility is exposed');

select * from finish();
rollback;
