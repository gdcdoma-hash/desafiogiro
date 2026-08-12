begin;

create or replace function public.validate_challenge_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'DRAFT' then
    if new.code <> old.code
      or new.reference_year <> old.reference_year
      or new.reference_month is distinct from old.reference_month
      or new.sports_starts_at <> old.sports_starts_at
      or new.sports_ends_at <> old.sports_ends_at
      or new.timezone <> old.timezone then
      raise exception 'Structural challenge fields are locked after draft';
    end if;
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('SCHEDULED','CANCELLED')) or
      (old.status = 'SCHEDULED' and new.status in ('ACTIVE','CANCELLED')) or
      (old.status = 'ACTIVE' and new.status in ('FINISHED','CANCELLED')) or
      (old.status in ('FINISHED','CANCELLED') and new.status = 'ARCHIVED')
    ) then
      raise exception 'Invalid challenge status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status in ('SCHEDULED','ACTIVE') and not exists (
    select 1 from public.challenge_goals g
    where g.challenge_id = old.id and g.is_active
  ) then
    raise exception 'Challenge needs at least one active goal before scheduling or activation';
  end if;

  return new;
end;
$$;

create trigger challenges_validate_lifecycle
before update on public.challenges
for each row execute function public.validate_challenge_lifecycle();

create or replace function public.validate_challenge_offer_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'DRAFT' then
    if new.challenge_id <> old.challenge_id
      or new.category_code <> old.category_code
      or new.registration_starts_at <> old.registration_starts_at
      or new.registration_ends_at <> old.registration_ends_at
      or new.price <> old.price
      or new.max_per_participant <> old.max_per_participant then
      raise exception 'Structural offer fields are locked after draft';
    end if;
  end if;

  if new.status <> old.status then
    if not (
      (old.status = 'DRAFT' and new.status in ('SCHEDULED','OPEN','DISABLED')) or
      (old.status = 'SCHEDULED' and new.status in ('OPEN','CLOSED','DISABLED')) or
      (old.status = 'OPEN' and new.status in ('CLOSED','DISABLED')) or
      (old.status = 'CLOSED' and new.status = 'DISABLED')
    ) then
      raise exception 'Invalid offer status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status in ('SCHEDULED','OPEN') and not exists (
    select 1 from public.challenge_offer_goals cog where cog.offer_id = old.id
  ) then
    raise exception 'Offer needs at least one goal before scheduling or opening';
  end if;

  if new.status = 'OPEN' and not exists (
    select 1 from public.challenges c
    where c.id = old.challenge_id and c.status in ('SCHEDULED','ACTIVE')
  ) then
    raise exception 'Offer can only open for a scheduled or active challenge';
  end if;

  return new;
end;
$$;

create trigger challenge_offers_validate_lifecycle
before update on public.challenge_offers
for each row execute function public.validate_challenge_offer_lifecycle();

create or replace function public.prevent_non_draft_challenge_children_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_id uuid;
  parent_status text;
begin
  if tg_table_name = 'challenge_goals' then
    parent_id := old.challenge_id;
  elsif tg_table_name = 'challenge_offers' then
    parent_id := old.challenge_id;
  else
    select challenge_id into parent_id from public.challenge_offers where id = old.offer_id;
  end if;

  select status into parent_status from public.challenges where id = parent_id;
  if parent_status is distinct from 'DRAFT' then
    raise exception 'Challenge configuration cannot be deleted after draft';
  end if;
  return old;
end;
$$;

create trigger challenge_goals_protect_delete before delete on public.challenge_goals for each row execute function public.prevent_non_draft_challenge_children_delete();
create trigger challenge_offers_protect_delete before delete on public.challenge_offers for each row execute function public.prevent_non_draft_challenge_children_delete();
create trigger challenge_offer_goals_protect_delete before delete on public.challenge_offer_goals for each row execute function public.prevent_non_draft_challenge_children_delete();

commit;
