begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

select has_function('public', 'audit_medal_delivery_change', array[]::text[], 'delivery audit function exists');
select has_function('public', 'audit_medal_delivery_batch_change', array[]::text[], 'batch audit function exists');
select has_function('public', 'audit_medal_delivery_period_change', array[]::text[], 'period audit function exists');
select has_trigger('public', 'medal_deliveries', 'medal_deliveries_audit', 'delivery audit trigger exists');
select has_trigger('public', 'medal_delivery_batches', 'medal_delivery_batches_audit', 'batch audit trigger exists');
select has_trigger('public', 'medal_delivery_periods', 'medal_delivery_periods_audit', 'period audit trigger exists');

select * from finish();
rollback;
