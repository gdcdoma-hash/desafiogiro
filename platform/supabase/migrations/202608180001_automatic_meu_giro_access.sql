begin;

alter table public.participants
  add column if not exists email text;

alter table public.participants
  add constraint participants_email_format_check
  check (email is null or (length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

create unique index if not exists participants_email_unique_idx
  on public.participants (lower(email))
  where email is not null;

alter table public.public_registration_requests
  add column if not exists email text;

alter table public.public_registration_requests
  add constraint public_registration_requests_email_format_check
  check (email is null or (length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));

create or replace view public.public_registration_admin_queue
with (security_invoker = true)
as
select
  r.id, r.created_at, r.status, r.full_name, r.phone_e164, r.email,
  r.city, r.state_code, r.referral_code,
  c.id as challenge_id, c.public_name as challenge_name,
  o.id as offer_id, o.public_name as offer_name, o.price,
  g.id as goal_id, g.target_km,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_label
from public.public_registration_requests r
join public.challenge_offers o on o.id = r.offer_id
join public.challenges c on c.id = o.challenge_id
join public.challenge_goals g on g.id = r.goal_id;

revoke all on public.public_registration_admin_queue from anon, authenticated;
grant select on public.public_registration_admin_queue to authenticated;

create or replace function public.submit_public_registration_request_with_email(
  target_offer_id uuid,
  target_goal_id uuid,
  participant_full_name text,
  participant_phone_e164 text,
  participant_email text,
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
  normalized_email text := lower(trim(participant_email));
begin
  if length(trim(participant_full_name)) < 2 then raise exception 'Nome inválido'; end if;
  if participant_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Telefone inválido'; end if;
  if normalized_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized_email) > 254 then
    raise exception 'E-mail inválido';
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
  if offer_challenge is null then raise exception 'Oferta indisponível para inscrição'; end if;

  if not exists (
    select 1 from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = target_offer_id and cog.goal_id = target_goal_id
      and g.challenge_id = offer_challenge and g.is_active = true
  ) then raise exception 'Meta indisponível para esta oferta'; end if;

  insert into public.public_registration_requests (
    offer_id, goal_id, full_name, phone_e164, email, city, state_code, referral_code
  ) values (
    target_offer_id, target_goal_id, trim(participant_full_name), participant_phone_e164,
    normalized_email, trim(participant_city), upper(trim(participant_state_code)),
    nullif(trim(target_referral_code), '')
  ) returning id into request_id;
  return request_id;
end;
$$;

revoke all on function public.submit_public_registration_request_with_email(uuid, uuid, text, text, text, text, text, text) from public;
grant execute on function public.submit_public_registration_request_with_email(uuid, uuid, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.process_public_registration_request(target_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.public_registration_requests%rowtype;
  target_challenge_id uuid;
  target_price numeric(12,2);
  found_participant_id uuid;
  participant_matches integer;
  existing_email text;
  new_registration_id uuid;
  new_payment_id uuid;
  next_occurrence integer;
begin
  if not public.has_permission('public_registrations.manage')
    or not public.has_permission('registrations.manage')
    or not public.has_permission('payments.manage') then
    raise exception 'Permissão insuficiente para processar a solicitação';
  end if;

  select * into req from public.public_registration_requests where id = target_request_id for update;
  if not found then raise exception 'Solicitação não encontrada'; end if;
  if req.status <> 'RECEIVED' then raise exception 'Solicitação já processada ou rejeitada'; end if;

  select o.challenge_id, o.price into target_challenge_id, target_price
  from public.challenge_offers o join public.challenges c on c.id = o.challenge_id
  where o.id = req.offer_id and c.is_public = true and c.status in ('SCHEDULED','ACTIVE')
    and o.status = 'OPEN' and now() >= o.registration_starts_at and now() < o.registration_ends_at;
  if target_challenge_id is null then raise exception 'Oferta não está mais disponível para inscrição'; end if;
  if target_price <= 0 then raise exception 'Oferta sem cobrança deve ser tratada pelo fluxo de isenção'; end if;
  if not exists (
    select 1 from public.challenge_offer_goals cog join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = req.offer_id and cog.goal_id = req.goal_id
      and g.challenge_id = target_challenge_id and g.is_active = true
  ) then raise exception 'Meta não está mais disponível para esta oferta'; end if;

  select count(*)::integer into participant_matches
  from public.participants p where p.phone_e164 = req.phone_e164 and p.status = 'ACTIVE';
  if participant_matches > 1 then raise exception 'Há mais de um participante ativo com este telefone; revisão manual necessária'; end if;

  if participant_matches = 1 then
    select p.id, p.email into found_participant_id, existing_email
    from public.participants p where p.phone_e164 = req.phone_e164 and p.status = 'ACTIVE'
    order by p.created_at, p.id limit 1;
    if req.email is not null and existing_email is not null and lower(existing_email) <> lower(req.email) then
      raise exception 'E-mail diverge do cadastro existente; revisão manual necessária';
    end if;
    if req.email is not null and existing_email is null then
      update public.participants set email = lower(req.email) where id = found_participant_id;
    end if;
  else
    insert into public.participants (full_name, phone_e164, email, city, state_code, notes)
    values (req.full_name, req.phone_e164, lower(req.email), req.city, req.state_code,
      'Criado a partir da pré-inscrição pública ' || req.id::text)
    returning id into found_participant_id;
  end if;

  select coalesce(max(r.occurrence_number), 0) + 1 into next_occurrence
  from public.registrations r where r.participant_id = found_participant_id and r.offer_id = req.offer_id;

  insert into public.registrations (
    participant_id, challenge_id, goal_id, offer_id, occurrence_number,
    price_snapshot, status, source_code, notes
  ) values (
    found_participant_id, target_challenge_id, req.goal_id, req.offer_id, next_occurrence,
    target_price, 'PENDING', 'PUBLIC', case when req.referral_code is null then '' else 'REF=' || req.referral_code end
  ) returning id, price_snapshot into new_registration_id, target_price;

  insert into public.registration_payments (
    registration_id, amount, method_code, status, external_reference, notes
  ) values (
    new_registration_id, target_price, 'PIX', 'PENDING', 'PUBLIC_REQUEST:' || req.id::text,
    'Pagamento pendente originado da pré-inscrição pública'
  ) returning id into new_payment_id;

  update public.public_registration_requests
  set status='PROCESSED', processed_at=now(), participant_id=found_participant_id, registration_id=new_registration_id
  where id=req.id;

  return jsonb_build_object('request_id',req.id,'participant_id',found_participant_id,
    'registration_id',new_registration_id,'payment_id',new_payment_id,
    'registration_status','PENDING','payment_status','PENDING','medal_reserved',false);
end;
$$;

revoke all on function public.process_public_registration_request(uuid) from public;
grant execute on function public.process_public_registration_request(uuid) to authenticated;

comment on column public.participants.email is 'E-mail normalizado usado para primeiro acesso automático ao Meu Giro.';
comment on function public.submit_public_registration_request_with_email(uuid, uuid, text, text, text, text, text, text) is 'Entrada pública com e-mail para habilitar primeiro acesso automático ao Meu Giro sem quebrar o RPC legado.';

commit;
