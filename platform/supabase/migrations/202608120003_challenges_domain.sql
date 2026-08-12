begin;

insert into public.app_permissions (code, description) values
  ('challenges.read', 'Consultar desafios, metas e ofertas'),
  ('challenges.manage', 'Gerenciar desafios, metas e ofertas')
on conflict (code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.app_roles r
cross join public.app_permissions p
where r.code = 'platform_admin'
  and p.code in ('challenges.read', 'challenges.manage')
on conflict do nothing;

create table public.challenges (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]*$'),
  public_name text not null check (length(trim(public_name)) between 2 and 160),
  short_description text not null default '',
  reference_year smallint not null check (reference_year between 2020 and 2200),
  reference_month smallint check (reference_month between 1 and 12),
  sports_starts_at timestamptz not null,
  sports_ends_at timestamptz not null,
  timezone text not null default 'America/Fortaleza',
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED', 'ARCHIVED')),
  is_public boolean not null default false,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sports_ends_at > sports_starts_at)
);

create index challenges_reference_idx on public.challenges(reference_year, reference_month, status);
create index challenges_period_idx on public.challenges(sports_starts_at, sports_ends_at);

create table public.challenge_goals (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  target_km integer not null check (target_km > 0),
  public_label text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, target_km)
);

create index challenge_goals_challenge_idx on public.challenge_goals(challenge_id, display_order, id);

create table public.challenge_offers (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete restrict,
  internal_name text not null check (length(trim(internal_name)) between 2 and 120),
  public_name text not null check (length(trim(public_name)) between 2 and 120),
  category_code text not null check (category_code ~ '^[A-Z][A-Z0-9_]*$'),
  registration_starts_at timestamptz not null,
  registration_ends_at timestamptz not null,
  price numeric(12,2) not null check (price >= 0),
  max_per_participant integer not null default 1 check (max_per_participant > 0),
  priority integer not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'DISABLED')),
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (registration_ends_at > registration_starts_at)
);

create index challenge_offers_challenge_idx on public.challenge_offers(challenge_id, priority, registration_starts_at);
create index challenge_offers_window_idx on public.challenge_offers(status, registration_starts_at, registration_ends_at);

create table public.challenge_offer_goals (
  offer_id uuid not null references public.challenge_offers(id) on delete cascade,
  goal_id uuid not null references public.challenge_goals(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (offer_id, goal_id)
);

create or replace function public.validate_challenge_offer_goal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_challenge uuid;
  goal_challenge uuid;
begin
  select challenge_id into offer_challenge from public.challenge_offers where id = new.offer_id;
  select challenge_id into goal_challenge from public.challenge_goals where id = new.goal_id;
  if offer_challenge is null or goal_challenge is null or offer_challenge <> goal_challenge then
    raise exception 'Offer and goal must belong to the same challenge';
  end if;
  return new;
end;
$$;

create trigger challenge_offer_goals_same_challenge
before insert or update on public.challenge_offer_goals
for each row execute function public.validate_challenge_offer_goal();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger challenges_set_updated_at before update on public.challenges for each row execute function public.set_updated_at();
create trigger challenge_goals_set_updated_at before update on public.challenge_goals for each row execute function public.set_updated_at();
create trigger challenge_offers_set_updated_at before update on public.challenge_offers for each row execute function public.set_updated_at();

alter table public.challenges enable row level security;
alter table public.challenge_goals enable row level security;
alter table public.challenge_offers enable row level security;
alter table public.challenge_offer_goals enable row level security;

create policy challenges_admin_read on public.challenges for select to authenticated using (public.has_permission('challenges.read'));
create policy challenges_admin_manage on public.challenges for all to authenticated using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));
create policy challenge_goals_admin_read on public.challenge_goals for select to authenticated using (public.has_permission('challenges.read'));
create policy challenge_goals_admin_manage on public.challenge_goals for all to authenticated using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));
create policy challenge_offers_admin_read on public.challenge_offers for select to authenticated using (public.has_permission('challenges.read'));
create policy challenge_offers_admin_manage on public.challenge_offers for all to authenticated using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));
create policy challenge_offer_goals_admin_read on public.challenge_offer_goals for select to authenticated using (public.has_permission('challenges.read'));
create policy challenge_offer_goals_admin_manage on public.challenge_offer_goals for all to authenticated using (public.has_permission('challenges.manage')) with check (public.has_permission('challenges.manage'));

revoke all on public.challenges, public.challenge_goals, public.challenge_offers, public.challenge_offer_goals from anon;
grant select, insert, update, delete on public.challenges, public.challenge_goals, public.challenge_offers, public.challenge_offer_goals to authenticated;

commit;
