begin;

create or replace function public.validate_challenge_offer_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  challenge_end timestamptz;
begin
  select sports_ends_at
    into challenge_end
  from public.challenges
  where id = new.challenge_id;

  if challenge_end is null then
    raise exception 'Challenge not found for offer';
  end if;

  if new.registration_ends_at > challenge_end then
    raise exception 'Offer registration period cannot end after challenge sports period';
  end if;

  return new;
end;
$$;

create trigger challenge_offers_validate_period
before insert or update of challenge_id, registration_ends_at
on public.challenge_offers
for each row execute function public.validate_challenge_offer_period();

create or replace function public.validate_challenge_period_against_offers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sports_ends_at is distinct from old.sports_ends_at
    and exists (
      select 1
      from public.challenge_offers o
      where o.challenge_id = old.id
        and o.registration_ends_at > new.sports_ends_at
    ) then
    raise exception 'Challenge sports period cannot end before an existing offer registration period';
  end if;

  return new;
end;
$$;

create trigger challenges_validate_period_against_offers
before update of sports_ends_at
on public.challenges
for each row execute function public.validate_challenge_period_against_offers();

commit;
