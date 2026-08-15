begin;

alter table public.challenge_offers
  add column pricing_mode text not null default 'FIXED'
    check (pricing_mode in ('FIXED','LOTS'));

alter table public.challenge_offers
  alter column price drop not null;

alter table public.challenge_offers
  add constraint challenge_offers_pricing_value_check
  check (
    (pricing_mode = 'FIXED' and price is not null and price >= 0)
    or
    (pricing_mode = 'LOTS' and price is null)
  );

create table public.challenge_offer_price_lots (
  id uuid primary key default extensions.gen_random_uuid(),
  offer_id uuid not null references public.challenge_offers(id) on delete cascade,
  external_reference text,
  internal_name text not null check (length(trim(internal_name)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  selection_mode text not null default 'ANY'
    check (selection_mode in ('ANY','REGISTRATION_COUNT')),
  registration_count integer,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_price numeric(12,2) check (total_price is null or total_price >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (selection_mode = 'ANY' and registration_count is null)
    or
    (selection_mode = 'REGISTRATION_COUNT' and registration_count > 0)
  )
);

create unique index challenge_offer_price_lots_external_reference_uidx
  on public.challenge_offer_price_lots(offer_id, external_reference)
  where external_reference is not null;

create index challenge_offer_price_lots_lookup_idx
  on public.challenge_offer_price_lots(
    offer_id,
    status,
    selection_mode,
    registration_count,
    starts_at,
    ends_at
  );

create or replace function public.validate_challenge_offer_price_lot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_mode text;
begin
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

  return new;
end;
$$;

create trigger challenge_offer_price_lots_validate
before insert or update on public.challenge_offer_price_lots
for each row execute function public.validate_challenge_offer_price_lot();

create or replace function public.guard_challenge_offer_pricing_mode()
returns trigger
language plpgsql
set search_path = ''
as $$;
begin
  if new.pricing_mode = 'FIXED'
    and exists (
      select 1
      from public.challenge_offer_price_lots lot
      where lot.offer_id = new.id
    ) then
    raise exception 'Cannot switch an offer with price lots to FIXED pricing';
  end if;

  return new;
end;
$$;

create trigger challenge_offers_pricing_mode_guard
before update of pricing_mode, price on public.challenge_offers
for each row execute function public.guard_challenge_offer_pricing_mode();

create trigger challenge_offer_price_lots_set_updated_at
before update on public.challenge_offer_price_lots
for each row execute function public.set_updated_at();

alter table public.challenge_offer_price_lots enable row level security;

create policy challenge_offer_price_lots_admin_read
on public.challenge_offer_price_lots for select to authenticated
using ((select public.has_permission('challenges.read')));

create policy challenge_offer_price_lots_admin_manage
on public.challenge_offer_price_lots for all to authenticated
using ((select public.has_permission('challenges.manage')))
with check ((select public.has_permission('challenges.manage')));

revoke all on public.challenge_offer_price_lots from anon;
grant select, insert, update, delete on public.challenge_offer_price_lots to authenticated;

create or replace view public.public_registration_catalog
with (security_invoker = true)
as
select
  c.id as challenge_id,
  c.code as challenge_code,
  c.public_name as challenge_name,
  c.short_description,
  c.reference_year,
  c.reference_month,
  c.sports_starts_at,
  c.sports_ends_at,
  c.timezone,
  o.id as offer_id,
  o.public_name as offer_name,
  o.category_code,
  o.registration_starts_at,
  o.registration_ends_at,
  o.price,
  o.max_per_participant,
  g.id as goal_id,
  g.target_km,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_label,
  g.display_order,
  o.pricing_mode
from public.challenges c
join public.challenge_offers o on o.challenge_id = c.id
join public.challenge_offer_goals og on og.offer_id = o.id
join public.challenge_goals g on g.id = og.goal_id
where c.is_public = true
  and c.status in ('SCHEDULED','ACTIVE')
  and o.status = 'OPEN'
  and g.is_active = true
  and now() >= o.registration_starts_at
  and now() < o.registration_ends_at;

grant select on public.public_registration_catalog to anon, authenticated;

commit;
