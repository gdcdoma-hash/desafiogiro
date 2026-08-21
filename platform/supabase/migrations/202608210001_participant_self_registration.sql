create or replace function public.create_participant_registration(
  target_offer_id uuid,
  target_goal_id uuid,
  target_referral_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
  target_challenge_id uuid;
  target_price numeric(12,2);
  next_occurrence integer;
  new_registration_id uuid;
  new_payment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select p.id
    into linked_participant_id
  from public.participant_user_links link
  join public.participants p on p.id = link.participant_id
  where link.user_id = auth.uid()
    and p.status = 'ACTIVE';

  if linked_participant_id is null then
    raise exception 'Participant account is not linked';
  end if;

  select o.challenge_id
    into target_challenge_id
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = target_offer_id
    and c.is_public = true
    and c.status in ('SCHEDULED', 'ACTIVE')
    and o.status = 'OPEN'
    and now() >= o.registration_starts_at
    and now() < o.registration_ends_at;

  if target_challenge_id is null then
    raise exception 'Offer is not available for registration';
  end if;

  if not exists (
    select 1
    from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = target_offer_id
      and cog.goal_id = target_goal_id
      and g.challenge_id = target_challenge_id
      and g.is_active = true
  ) then
    raise exception 'Goal is not available for this offer';
  end if;

  target_price := public.resolve_challenge_offer_unit_price(
    target_offer_id,
    1,
    now()
  );

  select coalesce(max(r.occurrence_number), 0) + 1
    into next_occurrence
  from public.registrations r
  where r.participant_id = linked_participant_id
    and r.offer_id = target_offer_id;

  insert into public.registrations (
    participant_id,
    challenge_id,
    goal_id,
    offer_id,
    occurrence_number,
    price_snapshot,
    status,
    source_code,
    notes
  ) values (
    linked_participant_id,
    target_challenge_id,
    target_goal_id,
    target_offer_id,
    next_occurrence,
    target_price,
    'PENDING',
    'PARTICIPANT',
    case
      when nullif(trim(target_referral_code), '') is null then ''
      else 'REF=' || trim(target_referral_code)
    end
  )
  returning id, price_snapshot into new_registration_id, target_price;

  insert into public.registration_payments (
    registration_id,
    amount,
    method_code,
    status,
    external_reference,
    notes
  ) values (
    new_registration_id,
    target_price,
    'PIX',
    'PENDING',
    'PARTICIPANT_PORTAL:' || new_registration_id::text,
    'Pagamento pendente criado pelo participante no Portal Giro'
  )
  returning id into new_payment_id;

  return jsonb_build_object(
    'registration_id', new_registration_id,
    'payment_id', new_payment_id,
    'registration_status', 'PENDING',
    'payment_status', 'PENDING',
    'amount', target_price
  );
end;
$$;

revoke all on function public.create_participant_registration(uuid, uuid, text) from public;
revoke all on function public.create_participant_registration(uuid, uuid, text) from anon;
grant execute on function public.create_participant_registration(uuid, uuid, text) to authenticated;
