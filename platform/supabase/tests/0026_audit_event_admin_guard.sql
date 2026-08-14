begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(3);

select ok(
  not has_function_privilege(
    'anon',
    'public.write_audit_event(text,text,text,uuid,text,text,jsonb,text)'::regprocedure,
    'EXECUTE'
  ),
  'anonymous users cannot write audit events'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.write_audit_event(text,text,text,uuid,text,text,jsonb,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated admin sessions can reach the audit RPC'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'write_audit_event'
      and position('admin.access' in p.prosrc) > 0
  ),
  'audit RPC enforces admin.access internally'
);

select * from finish();
rollback;
