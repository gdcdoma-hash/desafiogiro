begin;

create unique index public_registration_requests_open_phone_offer_uidx
  on public.public_registration_requests(phone_e164, offer_id)
  where status = 'RECEIVED';

create or replace function public.submit_public_registration_request(
  target_offer_id uuid,
  target_goal_id uuid,
  participant_full_name text,
  participant_phone_e164 text,
  participant_city text,
  participant_state_code text,
  target_referral_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  offer_challenge uuid;
  normalized_phone text := trim(participant_phone_e164);
begin
  if length(trim(participant_full_name)) < 2 then
    raise exception 'Nome inválido';
  end if;
  if normalized_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Telefone inválido';
  end if;
  if length(trim(participant_city)) < 2 or upper(trim(participant_state_code)) !~ '^[A-Z]{2}$' then
    raise exception 'Cidade ou UF inválida';
  end if;

  select o.challenge_id into offer_challenge
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = target_offer_id
    and c.is_public = true
    and c.status in ('SCHEDULED','ACTIVE')
    and o.status = 'OPEN'
    and now() >= o.registration_starts_at
    and now() < o.registration_ends_at;

  if offer_challenge is null then
    raise exception 'Oferta indisponível para inscrição';
  end if;

  if not exists (
    select 1
    from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = target_offer_id
      and cog.goal_id = target_goal_id
      and g.challenge_id = offer_challenge
      and g.is_active = true
  ) then
    raise exception 'Meta indisponível para esta oferta';
  end if;

  if exists (
    select 1
    from public.public_registration_requests r
    where r.phone_e164 = normalized_phone
      and r.offer_id = target_offer_id
      and r.status = 'RECEIVED'
  ) then
    raise exception 'Já existe uma pré-inscrição pendente para este telefone e oferta';
  end if;

  insert into public.public_registration_requests (
    offer_id, goal_id, full_name, phone_e164, city, state_code, referral_code
  ) values (
    target_offer_id,
    target_goal_id,
    trim(participant_full_name),
    normalized_phone,
    trim(participant_city),
    upper(trim(participant_state_code)),
    nullif(trim(target_referral_code), '')
  ) returning id into request_id;

  return request_id;
exception
  when unique_violation then
    raise exception 'Já existe uma pré-inscrição pendente para este telefone e oferta';
end;
$$;

commit;
