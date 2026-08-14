begin;

insert into public.app_permissions (code, description) values
  ('medal_deliveries.read', 'Consultar entregas de medalhas'),
  ('medal_deliveries.manage', 'Gerenciar entregas de medalhas')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('medal_deliveries.read', 'medal_deliveries.manage')
on conflict do nothing;

create table public.medal_delivery_periods (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null unique references public.challenges(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'PLANNED' check (status in ('PLANNED','OPEN','CLOSED','CANCELLED')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.medal_delivery_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  method text not null check (method in ('EVENT','STORE_PICKUP','POSTAL','OTHER')),
  label text not null check (length(trim(label)) between 2 and 160),
  city text not null default '',
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  responsible_name text not null default '',
  responsible_phone text not null default '',
  status text not null default 'PREPARING' check (status in ('PREPARING','HANDED_OFF','CLOSED','CANCELLED')),
  handed_over_at timestamptz,
  handoff_evidence text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medal_delivery_batches_challenge_idx
  on public.medal_delivery_batches(challenge_id, status, created_at desc);

create table public.medal_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete restrict,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  batch_id uuid references public.medal_delivery_batches(id) on delete restrict,
  status text not null default 'PENDING' check (status in ('PENDING','ASSIGNED','IN_TRANSIT','AWAITING_CONFIRMATION','CONFIRMED','ISSUE_REPORTED','CANCELLED')),
  tracking_code text not null default '',
  handoff_recipient_name text not null default '',
  handed_off_at timestamptz,
  handoff_evidence text not null default '',
  athlete_confirmed_at timestamptz,
  athlete_confirmation_note text not null default '',
  issue_reported_at timestamptz,
  issue_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medal_deliveries_challenge_idx
  on public.medal_deliveries(challenge_id, status, created_at desc);
create index medal_deliveries_batch_idx
  on public.medal_deliveries(batch_id, status) where batch_id is not null;

create or replace function public.validate_medal_delivery()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  registration_challenge uuid;
  registration_status text;
  batch_challenge uuid;
begin
  select challenge_id, status
    into registration_challenge, registration_status
  from public.registrations
  where id = new.registration_id;

  if registration_challenge is null then
    raise exception 'Medal delivery references an unknown registration';
  end if;

  if registration_status not in ('CONFIRMED','COMPLETED') then
    raise exception 'Medal delivery requires a confirmed or completed registration';
  end if;

  if new.challenge_id <> registration_challenge then
    raise exception 'Medal delivery challenge must match registration challenge';
  end if;

  if new.batch_id is not null then
    select challenge_id into batch_challenge
    from public.medal_delivery_batches
    where id = new.batch_id;

    if batch_challenge is null or batch_challenge <> new.challenge_id then
      raise exception 'Medal delivery batch must belong to the same challenge';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.registration_id <> old.registration_id
      or new.challenge_id <> old.challenge_id then
      raise exception 'Medal delivery registration and challenge are immutable';
    end if;

    if new.status <> old.status and not (
      (old.status = 'PENDING' and new.status in ('ASSIGNED','CANCELLED')) or
      (old.status = 'ASSIGNED' and new.status in ('IN_TRANSIT','AWAITING_CONFIRMATION','CANCELLED')) or
      (old.status = 'IN_TRANSIT' and new.status in ('AWAITING_CONFIRMATION','ISSUE_REPORTED')) or
      (old.status = 'AWAITING_CONFIRMATION' and new.status in ('CONFIRMED','ISSUE_REPORTED')) or
      (old.status = 'ISSUE_REPORTED' and new.status in ('AWAITING_CONFIRMATION','CONFIRMED','CANCELLED'))
    ) then
      raise exception 'Invalid medal delivery status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status = 'CONFIRMED' and new.athlete_confirmed_at is null then
    new.athlete_confirmed_at := now();
  end if;

  if new.status = 'ISSUE_REPORTED' and new.issue_reported_at is null then
    new.issue_reported_at := now();
  end if;

  return new;
end;
$$;

create trigger medal_deliveries_validate
before insert or update on public.medal_deliveries
for each row execute function public.validate_medal_delivery();

create trigger medal_delivery_periods_set_updated_at
before update on public.medal_delivery_periods
for each row execute function public.set_updated_at();

create trigger medal_delivery_batches_set_updated_at
before update on public.medal_delivery_batches
for each row execute function public.set_updated_at();

create trigger medal_deliveries_set_updated_at
before update on public.medal_deliveries
for each row execute function public.set_updated_at();

alter table public.medal_delivery_periods enable row level security;
alter table public.medal_delivery_batches enable row level security;
alter table public.medal_deliveries enable row level security;

create policy medal_delivery_periods_admin_read
on public.medal_delivery_periods for select to authenticated
using (public.has_permission('medal_deliveries.read'));
create policy medal_delivery_periods_admin_manage
on public.medal_delivery_periods for all to authenticated
using (public.has_permission('medal_deliveries.manage'))
with check (public.has_permission('medal_deliveries.manage'));

create policy medal_delivery_batches_admin_read
on public.medal_delivery_batches for select to authenticated
using (public.has_permission('medal_deliveries.read'));
create policy medal_delivery_batches_admin_manage
on public.medal_delivery_batches for all to authenticated
using (public.has_permission('medal_deliveries.manage'))
with check (public.has_permission('medal_deliveries.manage'));

create policy medal_deliveries_admin_read
on public.medal_deliveries for select to authenticated
using (public.has_permission('medal_deliveries.read'));
create policy medal_deliveries_admin_manage
on public.medal_deliveries for all to authenticated
using (public.has_permission('medal_deliveries.manage'))
with check (public.has_permission('medal_deliveries.manage'));

revoke all on public.medal_delivery_periods, public.medal_delivery_batches, public.medal_deliveries from anon;
grant select, insert, update, delete on public.medal_delivery_periods, public.medal_delivery_batches to authenticated;
grant select, insert, update on public.medal_deliveries to authenticated;

commit;
