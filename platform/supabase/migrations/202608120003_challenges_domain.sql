begin;

insert into public.app_permissions (code, description) values
  ('challenges.read', 'Consultar desafios, metas e ofertas'),
  ('challenges.manage', 'Gerenciar desafios, metas e ofertas')
on conflict (code) do update set description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select roles.id, permissions.id
from public.app_roles roles
join public.app_permissions permissions on permissions.code in ('challenges.read', 'challenges.manage')
where roles.code = 'platform_admin'
on conflict do nothing;

create table public.challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  name text not null check (length(btrim(name)) between 2 and 160),
  short_description text check (short_description is null or length(short_description) <= 500),
  reference_year smallint not null check (reference_year between 2000 and 2100),
  reference_month smallint not null check (reference_month between 1 and 12),
  sport_starts_at timestamptz not null,
  sport_ends_at timestamptz not null,
  timezone text not null default 'America/Fortaleza' check (length(btrim(timezone)) between 1 and 100),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED', 'ARCHIVED')),
  is_public boolean not null default false,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sport_ends_at > sport_starts_at)
);

create table public.challenge_goals (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  distance_km integer not null check (distance_km > 0),
  public_label text check (public_label is null or length(public_label) <= 120),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index challenge_goals_active_distance_uq
  on public.challenge_goals (challenge_id, distance_km)
  where is_active;

create table public.challenge_offers (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  internal_name text not null check (length(btrim(internal_name)) between 2 and 160),
  public_name text not null check (length(btrim(public_name)) between 2 and 160),
  category text not null check (length(btrim(category)) between 2 and 80),
  registration_starts_at timestamptz not null,
  registration_ends_at timestamptz not null,
  price_cents integer not null check (price_cents >= 0),
  priority integer not null default 0,
  max_per_participant integer not null default 1 check (max_per_participant > 0),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'DISABLED')),
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, code),
  check (registration_ends_at > registration_starts_at)
);

create table public.challenge_offer_goals (
  offer_id uuid not null references public.challenge_offers(id) on delete restrict,
  goal_id uuid not null references public.challenge_goals(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (offer_id, goal_id)
);

create index challenges_reference_idx on public.challenges (reference_year, reference_month);
create index challenges_status_start_idx on public.challenges (status, sport_starts_at);
create index challenge_goals_challenge_order_idx on public.challenge_goals (challenge_id, display_order, distance_km);
create index challenge_offers_window_idx on public.challenge_offers (challenge_id, registration_starts_at, registration_ends_at);
create index challenge_offers_status_idx on public.challenge_offers (status);
create index challenge_offer_goals_goal_idx on public.challenge_offer_goals (goal_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger challenges_touch_updated_at
before update on public.challenges
for each row execute function public.touch_updated_at();

create trigger challenge_goals_touch_updated_at
before update on public.challenge_goals
for each row execute function public.touch_updated_at();

create trigger challenge_offers_touch_updated_at
before update on public.challenge_offers
for each row execute function public.touch_updated_at();

create or replace function public.validate_challenge_offer_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_challenge uuid;
  goal_challenge uuid;
begin
  select challenge_id into offer_challenge
  from public.challenge_offers
  where id = new.offer_id;

  select challenge_id into goal_challenge
  from public.challenge_goals
  where id = new.goal_id;

  if offer_challenge is null or goal_challenge is null then
    raise exception 'Offer and goal must exist';
  end if;

  if offer_challenge <> goal_challenge then
    raise exception 'Offer and goal must belong to the same challenge';
  end if;

  return new;
end;
$$;

create trigger challenge_offer_goals_same_challenge
before insert or update on public.challenge_offer_goals
for each row execute function public.validate_challenge_offer_goal();

create or replace function public.validate_open_challenge_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'OPEN' and not exists (
    select 1
    from public.challenge_offer_goals cog
    where cog.offer_id = new.id
  ) then
    raise exception 'An OPEN offer must have at least one goal';
  end if;

  return new;
end;
$$;

create constraint trigger challenge_offers_require_goal_when_open
  after insert or update of status on public.challenge_offers
  deferrable initially deferred
  for each row execute function public.validate_open_challenge_offer();

create or replace function public.protect_last_open_offer_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.challenge_offers o
    where o.id = old.offer_id and o.status = 'OPEN'
  ) and not exists (
    select 1 from public.challenge_offer_goals cog
    where cog.offer_id = old.offer_id and cog.goal_id <> old.goal_id
  ) then
    raise exception 'An OPEN offer must keep at least one goal';
  end if;

  return old;
end;
$$;

create trigger challenge_offer_goals_keep_one_for_open_offer
before delete on public.challenge_offer_goals
for each row execute function public.protect_last_open_offer_goal();

alter table public.challenges enable row level security;
alter table public.challenge_goals enable row level security;
alter table public.challenge_offers enable row level security;
alter table public.challenge_offer_goals enable row level security;

create policy challenges_read on public.challenges
  for select to authenticated
  using (public.has_permission('challenges.read'));
create policy challenges_manage_insert on public.challenges
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenges_manage_update on public.challenges
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));

create policy challenge_goals_read on public.challenge_goals
  for select to authenticated
  using (public.has_permission('challenges.read'));
create policy challenge_goals_manage_insert on public.challenge_goals
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenge_goals_manage_update on public.challenge_goals
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));

create policy challenge_offers_read on public.challenge_offers
  for select to authenticated
  using (public.has_permission('challenges.read'));
create policy challenge_offers_manage_insert on public.challenge_offers
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenge_offers_manage_update on public.challenge_offers
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));

create policy challenge_offer_goals_read on public.challenge_offer_goals
  for select to authenticated
  using (public.has_permission('challenges.read'));
create policy challenge_offer_goals_manage_insert on public.challenge_offer_goals
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenge_offer_goals_manage_delete on public.challenge_offer_goals
  for delete to authenticated
  using (public.has_permission('challenges.manage'));

revoke all on public.challenges, public.challenge_goals, public.challenge_offers, public.challenge_offer_goals from anon;
revoke delete, truncate on public.challenges, public.challenge_goals, public.challenge_offers from authenticated;
grant select, insert, update on public.challenges, public.challenge_goals, public.challenge_offers to authenticated;
grant select, insert, delete on public.challenge_offer_goals to authenticated;

comment on table public.challenges is 'Edições do Desafio Giro, com competência administrativa e período esportivo separados.';
comment on table public.challenge_goals is 'Metas de quilometragem configuráveis por edição.';
comment on table public.challenge_offers is 'Janelas e condições comerciais configuráveis de inscrição.';
comment on table public.challenge_offer_goals is 'Metas disponibilizadas explicitamente por cada oferta.';

commit;
