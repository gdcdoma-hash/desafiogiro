begin;

alter table public.challenge_pricing_groups
  alter column challenge_id drop not null;

alter table public.challenge_pricing_groups
  add column period_code text
    check (period_code is null or period_code ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

alter table public.challenge_pricing_groups
  add constraint challenge_pricing_groups_scope_check
  check (num_nonnulls(challenge_id, period_code) = 1);

create unique index challenge_pricing_groups_period_external_reference_uidx
  on public.challenge_pricing_groups(period_code, external_reference)
  where period_code is not null and external_reference is not null;

create index challenge_pricing_groups_period_idx
  on public.challenge_pricing_groups(period_code, status, id)
  where period_code is not null;

create or replace function public.validate_challenge_pricing_group_offer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  group_challenge uuid;
  group_period text;
  offer_challenge uuid;
  offer_mode text;
  offer_year smallint;
  offer_month smallint;
  offer_period text;
begin
  select challenge_id, period_code
    into group_challenge, group_period
  from public.challenge_pricing_groups
  where id = new.pricing_group_id;

  select o.challenge_id, o.pricing_mode, c.reference_year, c.reference_month
    into offer_challenge, offer_mode, offer_year, offer_month
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = new.offer_id;

  if (group_challenge is null and group_period is null) or offer_challenge is null then
    raise exception 'Pricing group and offer must exist';
  end if;

  if group_challenge is not null and group_challenge <> offer_challenge then
    raise exception 'Pricing group and offer must belong to the same challenge';
  end if;

  if group_period is not null then
    if offer_month is null then
      raise exception 'Monthly pricing groups require offers with a reference month';
    end if;

    offer_period := offer_year::text || '-' || pg_catalog.lpad(offer_month::text, 2, '0');
    if group_period <> offer_period then
      raise exception 'Monthly pricing group and offer must belong to the same period';
    end if;
  end if;

  if offer_mode <> 'LOTS' then
    raise exception 'Shared pricing groups require offers with LOTS pricing mode';
  end if;

  return new;
end;
$$;

commit;
