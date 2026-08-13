begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('81111111-1111-1111-1111-111111111111','inventory-overview','Inventory Overview',2026,11,'2026-11-01 03:00+00','2026-12-01 02:59:59+00','DRAFT');
insert into public.challenge_goals(id,challenge_id,target_km,public_label)
values ('82222222-2222-2222-2222-222222222222','81111111-1111-1111-1111-111111111111',300,'300 km');
insert into public.inventory_items(id,challenge_id,goal_id,code,public_name)
values ('83333333-3333-3333-3333-333333333333','81111111-1111-1111-1111-111111111111','82222222-2222-2222-2222-222222222222','medal-300','Medalha 300 km');
insert into public.inventory_movements(inventory_item_id,movement_type,quantity,reason_code)
values
('83333333-3333-3333-3333-333333333333','IN',10,'TEST'),
('83333333-3333-3333-3333-333333333333','OUT',-3,'TEST');

select is((select balance from public.inventory_operations_overview where inventory_item_id='83333333-3333-3333-3333-333333333333'),7::bigint,'balance is consolidated');
select is((select movement_count from public.inventory_operations_overview where inventory_item_id='83333333-3333-3333-3333-333333333333'),2::bigint,'movement count is exposed');
select is((select challenge_name from public.inventory_operations_overview where inventory_item_id='83333333-3333-3333-3333-333333333333'),'Inventory Overview','challenge name is exposed');

select * from finish();
rollback;
