begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

select ok(
  not has_table_privilege('anon', 'public.public_registration_catalog', 'SELECT'),
  'anon cannot select the public registration view directly'
);

select ok(
  not has_table_privilege('authenticated', 'public.public_registration_catalog', 'SELECT'),
  'authenticated cannot select the public registration view directly'
);

select ok(
  has_function_privilege('anon', 'public.get_public_registration_catalog()'::regprocedure, 'EXECUTE'),
  'anon can execute the public catalog RPC'
);

select ok(
  has_function_privilege(
    'anon',
    'public.submit_public_registration_request(uuid,uuid,text,text,text,text,text)'::regprocedure,
    'EXECUTE'
  ),
  'anon can execute the public registration submission RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_confirmed_payment_to_registration()'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute the payment confirmation trigger function'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.reconcile_confirmed_inventory_reservations(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'anon cannot execute inventory reconciliation'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.try_reserve_inventory_for_registration(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated users cannot invoke the internal reservation helper directly'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.reconcile_confirmed_inventory_reservations(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated administrators can reach inventory reconciliation'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'participants'
      and indexname = 'participants_active_phone_e164_unique'
  ),
  'active participant phone uniqueness index exists'
);

select * from finish();
rollback;
