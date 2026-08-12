begin;

insert into public.app_permissions (code, description) values
  ('payments.read', 'Consultar pagamentos'),
  ('payments.manage', 'Gerenciar pagamentos')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('payments.read', 'payments.manage')
on conflict do nothing;

create table public.registration_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method_code text not null default 'MANUAL' check (method_code ~ '^[A-Z][A-Z0-9_]*$'),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','CANCELLED')),
  external_reference text,
  paid_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'CONFIRMED' and paid_at is not null) or status <> 'CONFIRMED')
);

create index registration_payments_registration_idx
  on public.registration_payments(registration_id, created_at desc);
create index registration_payments_status_idx
  on public.registration_payments(status, created_at desc);

create or replace function public.validate_registration_payment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.registration_id <> old.registration_id
      or new.amount <> old.amount
      or new.method_code <> old.method_code
      or new.external_reference is distinct from old.external_reference then
      raise exception 'Payment structural fields are immutable after creation';
    end if;

    if new.status <> old.status then
      if not (
        (old.status = 'PENDING' and new.status in ('CONFIRMED','CANCELLED'))
      ) then
        raise exception 'Invalid payment status transition: % -> %', old.status, new.status;
      end if;
    end if;

    if old.status in ('CONFIRMED','CANCELLED') and new.status <> old.status then
      raise exception 'Final payment status cannot be changed';
    end if;
  end if;

  if new.status = 'CONFIRMED' and new.paid_at is null then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

create trigger registration_payments_validate
before insert or update on public.registration_payments
for each row execute function public.validate_registration_payment();

create trigger registration_payments_set_updated_at
before update on public.registration_payments
for each row execute function public.set_updated_at();

alter table public.registration_payments enable row level security;

create policy registration_payments_admin_read
on public.registration_payments for select to authenticated
using (public.has_permission('payments.read'));

create policy registration_payments_admin_insert
on public.registration_payments for insert to authenticated
with check (public.has_permission('payments.manage'));

create policy registration_payments_admin_update
on public.registration_payments for update to authenticated
using (public.has_permission('payments.manage'))
with check (public.has_permission('payments.manage'));

revoke all on public.registration_payments from anon;
grant select, insert, update on public.registration_payments to authenticated;

commit;
