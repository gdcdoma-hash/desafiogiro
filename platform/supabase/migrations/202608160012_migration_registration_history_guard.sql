begin;

create or replace function public.validate_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  offer_challenge uuid;
  goal_challenge uuid;
  offer_price numeric(12,2);
  offer_pricing_mode text;
  offer_limit integer;
  existing_count integer;
  is_migration boolean := new.source_code = 'MIGRATION';
begin
  select challenge_id, price, pricing_mode, max_per_participant
    into offer_challenge, offer_price, offer_pricing_mode, offer_limit
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
    if is_migration then
      if new.price_snapshot is null or new.price_snapshot < 0 then
        raise exception 'Migration registration requires a valid historical price snapshot';
      end if;
    else
      if offer_pricing_mode = 'FIXED' then
        new.price_snapshot := offer_price;
      elsif offer_pricing_mode = 'LOTS' and new.price_snapshot is null then
        new.price_snapshot := public.resolve_challenge_offer_unit_price(
          new.offer_id,
          1,
          now()
        );
      end if;

      if new.price_snapshot is null or new.price_snapshot < 0 then
        raise exception 'Registration requires a valid price snapshot';
      end if;

      select count(*) into existing_count
      from public.registrations r
      where r.participant_id = new.participant_id
        and r.offer_id = new.offer_id
        and r.status not in ('CANCELLED','EXPIRED');

      if existing_count >= offer_limit then
        raise exception 'Participant reached the registration limit for this offer';
      end if;
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

commit;
