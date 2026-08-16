begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

select has_column(
  'public',
  'inventory_movements',
  'external_reference',
  'inventory movement exposes a migration external reference'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'inventory_movements'
      and indexname = 'inventory_movements_external_reference_uidx'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'inventory movement external reference is unique when present'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conname = 'inventory_movements_external_reference_nonblank'
  ),
  'inventory movement external reference rejects blank values'
);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at
) values (
  '71111111-1111-1111-1111-111111111111',
  'inventory-migration-idempotency',
  'Inventory migration idempotency',
  2026,
  8,
  '2026-08-01 00:00:00-03',
  '2026-09-01 00:00:00-03'
);

insert into public.inventory_items (
  id, challenge_id, code, public_name
) values (
  '72222222-2222-2222-2222-222222222222',
  '71111111-1111-1111-1111-111111111111',
  'LEGACY-STOCK-1',
  'Legacy stock 1'
);

insert into public.inventory_movements (
  inventory_item_id,
  movement_type,
  quantity,
  reason_code,
  external_reference
) values (
  '72222222-2222-2222-2222-222222222222',
  'IN',
  10,
  'MIGRATION',
  'dgmb-inventory-opening:v1:legacy-stock-1'
);

select throws_ok(
  $$
    insert into public.inventory_movements (
      inventory_item_id,
      movement_type,
      quantity,
      reason_code,
      external_reference
    ) values (
      '72222222-2222-2222-2222-222222222222',
      'IN',
      10,
      'MIGRATION',
      'dgmb-inventory-opening:v1:legacy-stock-1'
    )
  $$,
  '23505',
  null,
  'replaying the same migrated opening movement is rejected'
);

select * from finish();
rollback;
