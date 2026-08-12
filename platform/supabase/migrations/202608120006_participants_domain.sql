begin;

insert into public.app_permissions (code, description) values
  ('participants.read', 'Consultar participantes'),
  ('participants.manage', 'Gerenciar participantes')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('participants.read', 'participants.manage')
on conflict do nothing;

create table public.participants (
  id uuid primary key default extensions.gen_random_uuid(),
  legacy_id_dgmb text unique,
  full_name text not null check (length(trim(full_name)) between 2 and 180),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  city text not null default '',
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE', 'MERGED')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participants_name_idx on public.participants(lower(full_name));
create index participants_location_idx on public.participants(state_code, city);
create index participants_status_idx on public.participants(status);
create index participants_phone_idx on public.participants(phone_e164) where phone_e164 is not null;

create trigger participants_set_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

alter table public.participants enable row level security;

create policy participants_admin_read
on public.participants for select to authenticated
using (public.has_permission('participants.read'));

create policy participants_admin_insert
on public.participants for insert to authenticated
with check (public.has_permission('participants.manage'));

create policy participants_admin_update
on public.participants for update to authenticated
using (public.has_permission('participants.manage'))
with check (public.has_permission('participants.manage'));

revoke all on public.participants from anon;
grant select, insert, update on public.participants to authenticated;

commit;
