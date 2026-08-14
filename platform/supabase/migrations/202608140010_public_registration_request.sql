begin;

create table public.public_registration_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  offer_id uuid not null references public.challenge_offers(id) on delete restrict,
  goal_id uuid not null references public.challenge_goals(id) on delete restrict,
  full_name text not null check (length(trim(full_name)) between 2 and 180),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  city text not null check (length(trim(city)) between 2 and 120),
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  referral_code text,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','PROCESSED','REJECTED')),
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  check ((status = 'RECEIVED' and processed_at is null) or status <> 'RECEIVED')
);

create index public_registration_requests_status_idx
  on public.public_registration_requests(status, created_at);
create index public_registration_requests_phone_idx
  on public.public_registration_requests(phone_e164, created_at desc);

alter table public.public_registration_requests enable row level security;
revoke all on public.public_registration_requests from anon, authenticated;

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
begin
  if length(trim(participant_full_name)) < 2 then
    raise exception 'Nome inválido';
  end if;
  if participant_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
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
    and now() between o.registration_starts_at and o.registration_ends_at;

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

  insert into public.public_registration_requests (
    offer_id, goal_id, full_name, phone_e164, city, state_code, referral_code
  ) values (
    target_offer_id,
    target_goal_id,
    trim(participant_full_name),
    participant_phone_e164,
    trim(participant_city),
    upper(trim(participant_state_code)),
    nullif(trim(target_referral_code), '')
  ) returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.submit_public_registration_request(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.submit_public_registration_request(uuid, uuid, text, text, text, text, text) to anon, authenticated;

commit;
