begin;

create extension if not exists pgcrypto with schema extensions;

create table public.app_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.app_permissions (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.]*$'),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission_id uuid not null references public.app_permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.app_roles(id) on delete restrict,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role_id),
  check (revoked_at is null or revoked_at >= granted_at)
);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 3 and 100),
  resource_type text not null check (length(resource_type) between 2 and 100),
  resource_id text,
  outcome text not null check (outcome in ('success', 'failure', 'denied')),
  request_id uuid not null default extensions.gen_random_uuid(),
  source text not null default 'platform',
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  application_version text,
  check (jsonb_typeof(metadata) = 'object'),
  check (not (metadata ?| array['password', 'token', 'secret', 'cpf', 'authorization']))
);

create index audit_events_actor_occurred_idx on public.audit_events (actor_user_id, occurred_at desc);
create index audit_events_resource_idx on public.audit_events (resource_type, resource_id, occurred_at desc);
create index user_roles_active_user_idx on public.user_roles (user_id) where revoked_at is null;

insert into public.app_permissions (code, description) values
  ('admin.access', 'Acessar a área administrativa'),
  ('admin.users.read', 'Consultar usuários administrativos'),
  ('admin.users.manage', 'Gerenciar usuários administrativos'),
  ('rbac.read', 'Consultar papéis e permissões'),
  ('rbac.manage', 'Gerenciar papéis e permissões'),
  ('audit.read', 'Consultar eventos de auditoria');

insert into public.app_roles (code, name, description, is_system) values
  ('platform_admin', 'Administrador da plataforma', 'Administra a fundação técnica.', true),
  ('audit_reader', 'Leitor de auditoria', 'Consulta auditoria sem administrar acessos.', true);

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.app_roles roles
cross join public.app_permissions permissions
where roles.code = 'platform_admin';

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.app_roles roles
join public.app_permissions permissions on permissions.code in ('admin.access', 'audit.read')
where roles.code = 'audit_reader';

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.app_permissions p on p.id = rp.permission_id
    where ur.user_id = auth.uid()
      and ur.revoked_at is null
      and p.code = required_permission
  );
$$;

create or replace function public.current_admin_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null or not public.has_permission('admin.access') then null
    else jsonb_build_object(
      'user_id', auth.uid(),
      'roles', coalesce((
        select jsonb_agg(distinct r.code order by r.code)
        from public.user_roles ur
        join public.app_roles r on r.id = ur.role_id
        where ur.user_id = auth.uid() and ur.revoked_at is null
      ), '[]'::jsonb),
      'permissions', coalesce((
        select jsonb_agg(distinct p.code order by p.code)
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        join public.app_permissions p on p.id = rp.permission_id
        where ur.user_id = auth.uid() and ur.revoked_at is null
      ), '[]'::jsonb)
    )
  end;
$$;

create or replace function public.write_audit_event(
  event_action text,
  event_resource_type text,
  event_outcome text,
  event_request_id uuid,
  event_resource_id text default null,
  event_reason text default null,
  event_metadata jsonb default '{}'::jsonb,
  event_application_version text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if event_metadata ?| array['password', 'token', 'secret', 'cpf', 'authorization'] then
    raise exception 'Forbidden audit metadata key';
  end if;

  insert into public.audit_events (
    actor_user_id, action, resource_type, resource_id, outcome, request_id,
    reason, metadata, application_version
  ) values (
    auth.uid(), event_action, event_resource_type, event_resource_id,
    event_outcome, event_request_id, event_reason,
    coalesce(event_metadata, '{}'::jsonb), event_application_version
  ) returning id into new_event_id;

  return new_event_id;
end;
$$;

revoke all on function public.has_permission(text) from public;
revoke all on function public.current_admin_context() from public;
revoke all on function public.write_audit_event(text, text, text, uuid, text, text, jsonb, text) from public;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.current_admin_context() to authenticated;
grant execute on function public.write_audit_event(text, text, text, uuid, text, text, jsonb, text) to authenticated;

alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_events enable row level security;

create policy app_roles_read on public.app_roles for select to authenticated using (public.has_permission('rbac.read'));
create policy app_permissions_read on public.app_permissions for select to authenticated using (public.has_permission('rbac.read'));
create policy role_permissions_read on public.role_permissions for select to authenticated using (public.has_permission('rbac.read'));
create policy user_roles_read on public.user_roles for select to authenticated using (public.has_permission('admin.users.read'));
create policy audit_events_read on public.audit_events for select to authenticated using (public.has_permission('audit.read'));

revoke update, delete, truncate on public.audit_events from anon, authenticated;
revoke all on public.app_roles, public.app_permissions, public.role_permissions, public.user_roles from anon;
grant select on public.app_roles, public.app_permissions, public.role_permissions, public.user_roles to authenticated;
grant select on public.audit_events to authenticated;

comment on table public.audit_events is 'Registro acrescentado de ações administrativas e técnicas; não armazena segredos ou dados pessoais desnecessários.';

commit;
