begin;

create or replace function public.process_public_registration_request(
  target_request_id uuid
)
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
  new_registration_id uuid;
  new_payment_id uuid;
  next_occurrence integer;
begin
  if not public.has_permission('public_registrations.manage')
    or not public.has_permission('registrations.manage')
    or not public.has_permission('payments.manage') then
    raise exception 'Permissão insuficiente para processar a solicitação';
  end if;

  select * into req
  from public.public_registration_requests
  where id = target_request_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;

  if req.status <> 'RECEIVED' then
    raise exception 'Solicitação já processada ou rejeitada';
  end if;

  select o.challenge_id, o.price
    into target_challenge_id, target_price
  from public.challenge_offers o
  join public.challenges c on c.id = o.challenge_id
  where o.id = req.offer_id
    and c.is_public = true
    and c.status in ('SCHEDULED','ACTIVE')
    and o.status = 'OPEN'
    and now() >= o.registration_starts_at
    and now() < o.registration_ends_at;

  if target_challenge_id is null then
    raise exception 'Oferta não está mais disponível para inscrição';
  end if;

  if target_price <= 0 then
    raise exception 'Oferta sem cobrança deve ser tratada pelo fluxo de isenção';
  end if;

  if not exists (
    select 1
    from public.challenge_offer_goals cog
    join public.challenge_goals g on g.id = cog.goal_id
    where cog.offer_id = req.offer_id
      and cog.goal_id = req.goal_id
      and g.challenge_id = target_challenge_id
      and g.is_active = true
  ) then
    raise exception 'Meta não está mais disponível para esta oferta';
  end if;

  -- Solicitações diferentes podem compartilhar o mesmo telefone. Serializar a
  -- resolução/criação do participante impede dois processamentos concorrentes
  -- de criarem participantes ativos duplicados para o mesmo celular.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(req.phone_e164, 0)
  );

  select count(*)::integer
    into participant_matches
  from public.participants p
  where p.phone_e164 = req.phone_e164
    and p.status = 'ACTIVE';

  if participant_matches > 1 then
    raise exception 'Há mais de um participante ativo com este telefone; revisão manual necessária';
  end if;

  if participant_matches = 1 then
    select p.id
      into found_participant_id
    from public.participants p
    where p.phone_e164 = req.phone_e164
      and p.status = 'ACTIVE'
    order by p.created_at, p.id
    limit 1;
  else
    insert into public.participants (
      full_name, phone_e164, city, state_code, notes
    ) values (
      req.full_name,
      req.phone_e164,
      req.city,
      req.state_code,
      'Criado a partir da pré-inscrição pública ' || req.id::text
    ) returning id into found_participant_id;
  end if;

  select coalesce(max(r.occurrence_number), 0) + 1
    into next_occurrence
  from public.registrations r
  where r.participant_id = found_participant_id
    and r.offer_id = req.offer_id;

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
    found_participant_id,
    target_challenge_id,
    req.goal_id,
    req.offer_id,
    next_occurrence,
    target_price,
    'PENDING',
    'PUBLIC',
    case when req.referral_code is null then '' else 'REF=' || req.referral_code end
  ) returning id, price_snapshot into new_registration_id, target_price;

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
    'PUBLIC_REQUEST:' || req.id::text,
    'Pagamento pendente originado da pré-inscrição pública'
  ) returning id into new_payment_id;

  update public.public_registration_requests
  set status = 'PROCESSED',
      processed_at = now(),
      participant_id = found_participant_id,
      registration_id = new_registration_id
  where id = req.id;

  return jsonb_build_object(
    'request_id', req.id,
    'participant_id', found_participant_id,
    'registration_id', new_registration_id,
    'payment_id', new_payment_id,
    'registration_status', 'PENDING',
    'payment_status', 'PENDING',
    'medal_reserved', false
  );
end;
$$;

revoke all on function public.process_public_registration_request(uuid) from public;
grant execute on function public.process_public_registration_request(uuid) to authenticated;

commit;
