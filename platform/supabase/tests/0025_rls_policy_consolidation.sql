begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='medal_deliveries' and cmd='SELECT'),
  1,
  'medal deliveries has one SELECT policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='medal_deliveries'),
  4,
  'medal deliveries separates select, insert, update and delete'
);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='medal_delivery_batches' and cmd='SELECT'),
  1,
  'medal delivery batches has one SELECT policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='medal_delivery_batches'),
  4,
  'medal delivery batches separates select, insert, update and delete'
);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='medal_delivery_periods' and cmd='SELECT'),
  1,
  'medal delivery periods has one SELECT policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='medal_delivery_periods'),
  4,
  'medal delivery periods separates select, insert, update and delete'
);

select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='participant_user_links' and cmd='SELECT'),
  1,
  'participant user links has one SELECT policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname='public' and tablename='participant_user_links'),
  4,
  'participant user links separates self/admin select from write management'
);

select * from finish();
rollback;
