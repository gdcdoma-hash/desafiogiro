begin;

insert into public.app_permissions (code, description) values
  ('registrations.read', 'Consultar inscrições'),
  ('registrations.manage', 'Gerenciar inscrições')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('registrations.read', 'registrations.manage')
on conflict do nothing;

create table public.registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete restrict,
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  goal_id uuid not null references public.challenge_goals(id) on delete restrict,
  offer_id uuid not null references public.challenge_offers(id) on delete restrict,
  occurrence_number integer not null check (occurrence_number > 0),
  price_snapshot numeric(12,2) not null check (price_snapshot >= 0),
  status text not null default 'PENDING' check (status in ('PENDING','CONFIRMED','COMPLETED','CANCELLED','EXPIRED')),
  source_code text not null default 'ADMIN' check (source_code ~ '^[A-Z][A-Z0-9_]*$'),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, offer_id, occurrence_number)
);

create index registrations_participant_idx on public.registrations(participant_id, created_at desc);
create index registrations_challenge_idx on public.registrations(challenge_id, status, created_at desc);
create index registrations_offer_idx on public.registrations(offer_id, status);

create or replace function public.validate_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_challenge uuid;
  goal_challenge uuid;
  offer_price numeric(12,2);
  offer_limit integer;
  existing_count integer;
begin
  select challenge_id, price, max_per_participant
    into offer_challenge, offer_price, offer_limit
  from public.challenge_offers
  where id = new.offer_id;

  select challenge_id into goal_challenge
  from public.challenge_goals
  where id = new.goal_id;

  if offer_challenge is null or goal_challenge is null then
    raise exception 'Registration references an unknown offer or goal';
  end if;

  if new.challenge_id <> offer_challenge or new.challenge_id <> goal_challenge then
    raise exception 'Registration offer and goal must belong to its challenge';
  end if;

  if not exists (
    select 1 from public.challenge_offer_goals cog
    where cog.offer_id = new.offer_id and cog.goal_id = new.goal_id
  ) then
    raise exception 'Registration goal is not enabled for this offer';
  end if;

  if tg_op = 'INSERT' then
    new.price_snapshot := offer_price;

    select count(*) into existing_count
    from public.registrations r
    where r.participant_id = new.participant_id
      and r.offer_id = new.offer_id
      and r.status not in ('CANCELLED','EXPIRED');

    if existing_count >= offer_limit then
      raise exception 'Participant reached the registration limit for this offer';
    end if;
  else
    if new.participant_id <> old.participant_id
      or new.challenge_id <> old.challenge_id
      or new.goal_id <> old.goal_id
      or new.offer_id <> old.offer_id
      or new.occurrence_number <> old.occurrence_number
      or new.price_snapshot <> old.price_snapshot then
      raise exception 'Registration structural fields are immutable after creation';
    end if;
  end if;

  return new;
end;
$$;

create trigger registrations_validate
before insert or update on public.registrations
for each row execute function public.validate_registration();

create trigger registrations_set_updated_at
before update on public.registrations
for each row execute function public.set_updated_at();

alter table public.registrations enable row level security;

create policy registrations_admin_read
on public.registrations for select to authenticated
using (public.has_permission('registrations.read'));

create policy registrations_admin_insert
on public.registrations for insert to authenticated
with check (public.has_permission('registrations.manage'));

create policy registrations_admin_update
on public.registrations for update to authenticated
using (public.has_permission('registrations.manage'))
with check (public.has_permission('registrations.manage'));

revoke all on public.registrations from anon;
grant select, insert, update on public.registrations to authenticated;

commit;
