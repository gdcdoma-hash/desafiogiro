begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

select has_table('public', 'app_roles', 'roles table exists');
select has_table('public', 'app_permissions', 'permissions table exists');
select has_table('public', 'user_roles', 'user roles table exists');
select has_table('public', 'audit_events', 'audit table exists');
select results_eq('select count(*)::bigint from public.app_roles', array[2::bigint], 'two technical roles');
select results_eq('select count(*)::bigint from public.app_permissions', array[17::bigint], 'seventeen permissions including operations');
select is_empty($$select 1 from public.audit_events where metadata ?| array['password','token','secret','cpf','authorization']$$, 'audit has no forbidden keys');

select * from finish();
rollback;
