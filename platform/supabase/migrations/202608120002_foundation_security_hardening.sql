begin;

-- Supabase grants some privileges directly to anon/authenticated.
-- Revoking from PUBLIC alone is therefore insufficient.
revoke select on public.audit_events from anon;

revoke execute on function public.has_permission(text) from anon;
revoke execute on function public.current_admin_context() from anon;
revoke execute on function public.write_audit_event(
  text,
  text,
  text,
  uuid,
  text,
  text,
  jsonb,
  text
) from anon;

-- Harden optional legacy objects when they exist in the target environment.
-- A clean local database intentionally does not contain these objects.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'revoke select on table public.profiles from anon';
  end if;

  if to_regprocedure('public.handle_new_user()') is not null then
    execute 'revoke execute on function public.handle_new_user() from anon, authenticated, public';
  end if;
end;
$$;

-- Cover foreign keys used by joins and referential actions.
create index if not exists role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

create index if not exists user_roles_role_id_idx
  on public.user_roles (role_id);

create index if not exists user_roles_granted_by_idx
  on public.user_roles (granted_by)
  where granted_by is not null;

commit;
