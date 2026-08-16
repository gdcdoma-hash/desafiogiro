begin;

alter table public.registration_payments
  add column paid_at_unknown boolean not null default false;

alter table public.registration_payments
  drop constraint if exists registration_payments_check;

alter table public.registration_payments
  add constraint registration_payments_confirmed_paid_at_check
    check (
      status <> 'CONFIRMED'
      or paid_at is not null
      or paid_at_unknown = true
    ),
  add constraint registration_payments_paid_at_unknown_consistency
    check (
      paid_at_unknown = false
      or (status = 'CONFIRMED' and paid_at is null)
    );

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
      or new.external_reference is distinct from old.external_reference
      or new.paid_at_unknown <> old.paid_at_unknown then
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

  if new.status = 'CONFIRMED'
     and new.paid_at is null
     and new.paid_at_unknown = false then
    new.paid_at := now();
  end if;

  return new;
end;
$$;

commit;
