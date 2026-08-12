begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_table('public','inventory_items','inventory items table exists');
select has_table('public','inventory_movements','inventory movements table exists');
select has_view('public','inventory_balances','inventory balances view exists');
select ok(exists(select 1 from public.app_permissions where code='inventory.read'),'inventory.read permission exists');
select ok(exists(select 1 from public.app_permissions where code='inventory.manage'),'inventory.manage permission exists');

insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('81111111-1111-1111-1111-111111111111','inventory-test','Inventory Test',2026,11,'2026-11-01 03:00+00','2026-12-01 02:59:59+00','DRAFT');
insert into public.challenge_goals(id,challenge_id,target_km,public_label)
values ('82222222-2222-2222-2222-222222222222','81111111-1111-1111-1111-111111111111',300,'300 km');
insert into public.inventory_items(id,challenge_id,goal_id,code,public_name)
values ('83333333-3333-3333-3333-333333333333','81111111-1111-1111-1111-111111111111','82222222-2222-2222-2222-222222222222','medal-300','Medalha 300 km');
insert into public.inventory_movements(inventory_item_id,movement_type,quantity,reason_code)
values ('83333333-3333-3333-3333-333333333333','IN',25,'INITIAL_STOCK'),
       ('83333333-3333-3333-3333-333333333333','OUT',-3,'MANUAL');

select is((select balance from public.inventory_balances where inventory_item_id='83333333-3333-3333-3333-333333333333'),22::bigint,'balance sums ledger movements');
select throws_ok(
  $$insert into public.inventory_movements(inventory_item_id,movement_type,quantity) values ('83333333-3333-3333-3333-333333333333','OUT',2)$$,
  'new row for relation "inventory_movements" violates check constraint "inventory_movements_check"',
  'out movement must be negative'
);
select throws_ok(
  $$update public.inventory_movements set quantity=99 where inventory_item_id='83333333-3333-3333-3333-333333333333' limit 1$$,
  42601,
  'syntax error at or near "limit"',
  'movement history is not updated through normal flow'
);

select * from finish();
rollback;
