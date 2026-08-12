begin;

create or replace function public.validate_registration_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> old.status then
    if not (
      (old.status = 'PENDING' and new.status in ('CONFIRMED','CANCELLED','EXPIRED')) or
      (old.status = 'CONFIRMED' and new.status in ('COMPLETED','CANCELLED'))
    ) then
      raise exception 'Invalid registration status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if old.status in ('COMPLETED','CANCELLED','EXPIRED') and new.status <> old.status then
    raise exception 'Final registration status cannot be changed';
  end if;

  return new;
end;
$$;

create trigger registrations_validate_lifecycle
before update on public.registrations
for each row execute function public.validate_registration_lifecycle();

revoke delete on public.registrations from authenticated;

commit;
