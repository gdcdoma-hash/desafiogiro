begin;

create table public.challenge_pricing_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  external_reference text,
  internal_name text not null check (length(trim(internal_name)) between 1 and 120),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index challenge_pricing_groups_external_reference_uidx
  on public.challenge_pricing_groups(challenge_id, external_reference)
  where external_reference is not null;

create index challenge_pricing_groups_challenge_idx
  on public.challenge_pricing_groups(challenge_id, status, id);

create table public.challenge_pricing_group_offers (
  pricing_group_id uuid not null references public.challenge_pricing_groups(id) on delete cascade,
  offer_id uuid not null references public.challenge_offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pricing_group_id, offer_id),
  unique (offer_id)
);

create index challenge_pricing_group_offers_offer_idx
  on public.challenge_pricing_group_offers(offer_id, pricing_group_id);

alter table public.challenge_offer_price_lots
  add column pricing_group_id uuid references public.challenge_pricing_groups(id) on delete cascade;

alter table public.challenge_offer_price_lots
  alter column offer_id drop not null;

alter table public.challenge_offer_price_lots
  add constraint challenge_offer_price_lots_scope_check
  check (num_nonnulls(offer_id, pricing_group_id) = 1);

create index challenge_offer_price_lots_group_lookup_idx
  on public.challenge_offer_price_lots(
    pricing_group_id,
    status,
    selection_mode,
    registration_count,
    starts_at,
    ends_at
  )
  where pricing_group_id is not null;

create or replace function public.validate_challenge_pricing_group_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  group_challenge uuid;
  offer_challenge uuid;
  offer_mode text;
begin
  select challenge_id
    into group_challenge
  from public.challenge_pricing_groups
  where id = new.pricing_group_id;

  select challenge_id, pricing_mode
    into offer_challenge, offer_mode
  from public.challenge_offers
  where id = new.offer_id;

  if group_challenge is null or offer_challenge is null then
    raise exception 'Pricing group and offer must exist';
  end if;

  if group_challenge <> offer_challenge then
    raise exception 'Pricing group and offer must belong to the same challenge';
  end if;

  if offer_mode <> 'LOTS' then
    raise exception 'Shared pricing groups require offers with LOTS pricing mode';
  end if;

  return new;
end;
$$;

create trigger challenge_pricing_group_offers_validate
before insert or update on public.challenge_pricing_group_offers
for each row execute function public.validate_challenge_pricing_group_offer();

create or replace function public.validate_challenge_offer_price_lot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_mode text;
begin
  if num_nonnulls(new.offer_id, new.pricing_group_id) <> 1 then
    raise exception 'Price lot must belong to exactly one offer or pricing group';
  end if;

  if new.offer_id is not null then
    select pricing_mode
      into offer_mode
    from public.challenge_offers
    where id = new.offer_id;

    if offer_mode is null then
      raise exception 'Offer not found for price lot';
    end if;

    if offer_mode <> 'LOTS' then
      raise exception 'Price lots require an offer with LOTS pricing mode';
    end if;
  end if;

  if new.pricing_group_id is not null
    and not exists (
      select 1
      from public.challenge_pricing_groups group_row
      where group_row.id = new.pricing_group_id
    ) then
    raise exception 'Pricing group not found for price lot';
  end if;

  return new;
end;
$$;

create or replace function public.guard_challenge_offer_pricing_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pricing_mode = 'FIXED'
    and exists (
      select 1
      from public.challenge_offer_price_lots lot
      where lot.offer_id = new.id
    ) then
    raise exception 'Cannot switch an offer with price lots to FIXED pricing';
  end if;

  if new.pricing_mode = 'FIXED'
    and exists (
      select 1
      from public.challenge_pricing_group_offers link
      where link.offer_id = new.id
    ) then
    raise exception 'Cannot switch an offer with shared price lots to FIXED pricing';
  end if;

  return new;
end;
$$;

create trigger challenge_pricing_groups_set_updated_at
before update on public.challenge_pricing_groups
for each row execute function public.set_updated_at();

alter table public.challenge_pricing_groups enable row level security;
alter table public.challenge_pricing_group_offers enable row level security;

create policy challenge_pricing_groups_admin_read
on public.challenge_pricing_groups for select to authenticated
using ((select public.has_permission('challenges.read')));

create policy challenge_pricing_groups_admin_manage
on public.challenge_pricing_groups for all to authenticated
using ((select public.has_permission('challenges.manage')))
with check ((select public.has_permission('challenges.manage')));

create policy challenge_pricing_group_offers_admin_read
on public.challenge_pricing_group_offers for select to authenticated
using ((select public.has_permission('challenges.read')));

create policy challenge_pricing_group_offers_admin_manage
on public.challenge_pricing_group_offers for all to authenticated
using ((select public.has_permission('challenges.manage')))
with check ((select public.has_permission('challenges.manage')));

revoke all on public.challenge_pricing_groups, public.challenge_pricing_group_offers from anon;
grant select, insert, update, delete on public.challenge_pricing_groups to authenticated;
grant select, insert, update, delete on public.challenge_pricing_group_offers to authenticated;

commit;
