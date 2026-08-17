begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

select ok(
  has_table_privilege('authenticated','public.public_registration_requests','select'),
  'authenticated can select the admin queue base table'
);
select ok(
  has_table_privilege('authenticated','public.public_registration_admin_queue','select'),
  'authenticated can select the admin queue view'
);
select ok(
  not has_table_privilege('anon','public.public_registration_requests','select'),
  'anon cannot select public registration requests directly'
);

select * from finish();
rollback;
