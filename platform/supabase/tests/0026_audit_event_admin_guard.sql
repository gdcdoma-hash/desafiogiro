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
  position(
    'has_permission(''admin.access''::text)' in
    pg_get_functiondef(
      'public.write_audit_event(text,text,text,uuid,text,text,jsonb,text)'::regprocedure
    )
  ) > 0,
  'audit RPC enforces admin.access internally'
);

select * from finish();
rollback;
