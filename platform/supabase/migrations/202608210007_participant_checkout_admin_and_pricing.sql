create or replace function public.get_participant_checkout_catalog()
returns table (
  challenge_id uuid,
  challenge_name text,
  short_description text,
  reference_year smallint,
  reference_month smallint,
  offer_id uuid,
  offer_name text,
  category_code text,
  price numeric,
  goal_id uuid,
  goal_label text,
  target_km integer,
  display_order integer,
  reserve_on_add boolean,
  available_balance bigint,
  category_limit integer,
  category_used integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with linked as (
    select l.participant_id
    from public.participant_user_links l
    join public.participants p on p.id = l.participant_id and p.status = 'ACTIVE'
    where l.user_id = auth.uid()
    limit 1
  ), current_checkout as (
    select c.id
    from public.participant_checkouts c
    cross join linked lp
    where c.participant_id = lp.participant_id
      and c.status = 'DRAFT'
    order by c.created_at desc
    limit 1
  ), prospective as (
    select coalesce((
      select count(*)::integer
      from public.registrations r
      join current_checkout cc on cc.id = r.checkout_id
      where r.status = 'PENDING'
    ), 0) + 1 as registration_count
  ), catalog as (
    select pc.*,
           coalesce(rule.max_items, o.max_per_participant) as category_limit,
           coalesce(rule.reserve_on_add, false) as reserve_on_add
    from public.public_registration_catalog pc
    join public.challenge_offers o on o.id = pc.offer_id
    left join public.participant_registration_category_rules rule
      on rule.category_code = pc.category_code and rule.is_active = true
  )
  select
    cat.challenge_id,
    cat.challenge_name,
    cat.short_description,
    cat.reference_year,
    cat.reference_month,
    cat.offer_id,
    cat.offer_name,
    cat.category_code,
    public.resolve_challenge_offer_unit_price(cat.offer_id, prospective.registration_count, now()) as price,
    cat.goal_id,
    cat.goal_label,
    cat.target_km,
    cat.display_order,
    cat.reserve_on_add,
    coalesce(av.available_balance, 0) as available_balance,
    cat.category_limit,
    (
      select count(*)::integer
      from public.registrations r
      join public.challenge_offers ro on ro.id = r.offer_id
      cross join linked lp2
      where r.participant_id = lp2.participant_id
        and ro.category_code = cat.category_code
        and r.status not in ('CANCELLED','EXPIRED')
    ) as category_used
  from catalog cat
  cross join linked lp
  cross join prospective
  left join public.inventory_availability av
    on av.challenge_id = cat.challenge_id and av.goal_id = cat.goal_id
  where (
    select count(*)
    from public.registrations r
    where r.participant_id = lp.participant_id
      and r.offer_id = cat.offer_id
      and r.status not in ('CANCELLED','EXPIRED')
  ) < (
    select o.max_per_participant from public.challenge_offers o where o.id = cat.offer_id
  )
  and (
    select count(*)
    from public.registrations r
    join public.challenge_offers ro on ro.id = r.offer_id
    where r.participant_id = lp.participant_id
      and ro.category_code = cat.category_code
      and r.status not in ('CANCELLED','EXPIRED')
  ) < cat.category_limit
  and (cat.reserve_on_add = false or coalesce(av.available_balance, 0) > 0)
  order by cat.reference_year desc, cat.reference_month desc, cat.display_order asc;
$$;

revoke all on function public.get_participant_checkout_catalog() from public, anon;
grant execute on function public.get_participant_checkout_catalog() to authenticated;

create or replace function public.get_participant_registration_admin_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  category_rows jsonb;
  pix_rows jsonb;
begin
  if not (public.has_permission('registrations.manage') or public.has_permission('payments.manage')) then
    raise exception 'Permissão insuficiente para consultar configuração de inscrições';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'category_code', r.category_code,
    'max_items', r.max_items,
    'reserve_on_add', r.reserve_on_add,
    'reservation_minutes', r.reservation_minutes,
    'is_active', r.is_active
  ) order by case r.category_code when 'NORMAL' then 1 when 'REPESCAGEM' then 2 else 3 end, r.category_code), '[]'::jsonb)
  into category_rows
  from public.participant_registration_category_rules r;

  select coalesce(jsonb_agg(jsonb_build_object(
    'registration_count', k.registration_count,
    'pix_key', k.pix_key,
    'pix_holder', k.pix_holder,
    'is_active', k.is_active
  ) order by k.registration_count), '[]'::jsonb)
  into pix_rows
  from public.participant_pix_keys k;

  return jsonb_build_object('categories', category_rows, 'pix_keys', pix_rows);
end;
$$;

revoke all on function public.get_participant_registration_admin_config() from public, anon;
grant execute on function public.get_participant_registration_admin_config() to authenticated;

create or replace function public.upsert_participant_registration_category_rule(
  target_category_code text,
  target_max_items integer,
  target_reserve_on_add boolean,
  target_reservation_minutes integer,
  target_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('registrations.manage') then
    raise exception 'Permissão insuficiente para alterar limites de inscrição';
  end if;
  if target_category_code !~ '^[A-Z][A-Z0-9_]*$' then raise exception 'Categoria inválida'; end if;
  if target_max_items < 1 or target_max_items > 20 then raise exception 'Limite deve ficar entre 1 e 20'; end if;
  if target_reservation_minutes < 10 or target_reservation_minutes > 1440 then raise exception 'Prazo de reserva inválido'; end if;

  insert into public.participant_registration_category_rules
    (category_code,max_items,reserve_on_add,reservation_minutes,is_active,updated_at)
  values
    (target_category_code,target_max_items,target_reserve_on_add,target_reservation_minutes,target_is_active,now())
  on conflict (category_code) do update set
    max_items=excluded.max_items,
    reserve_on_add=excluded.reserve_on_add,
    reservation_minutes=excluded.reservation_minutes,
    is_active=excluded.is_active,
    updated_at=now();
end;
$$;

revoke all on function public.upsert_participant_registration_category_rule(text,integer,boolean,integer,boolean) from public, anon;
grant execute on function public.upsert_participant_registration_category_rule(text,integer,boolean,integer,boolean) to authenticated;

create or replace function public.upsert_participant_pix_key(
  target_registration_count integer,
  target_pix_key text,
  target_pix_holder text,
  target_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('payments.manage') then
    raise exception 'Permissão insuficiente para alterar chave PIX';
  end if;
  if target_registration_count < 1 or target_registration_count > 20 then raise exception 'Quantidade inválida'; end if;
  if nullif(trim(target_pix_key),'') is null then raise exception 'Chave PIX obrigatória'; end if;
  if nullif(trim(target_pix_holder),'') is null then raise exception 'Identificação do recebedor obrigatória'; end if;

  insert into public.participant_pix_keys
    (registration_count,pix_key,pix_holder,is_active,updated_at)
  values
    (target_registration_count,trim(target_pix_key),trim(target_pix_holder),target_is_active,now())
  on conflict (registration_count) do update set
    pix_key=excluded.pix_key,
    pix_holder=excluded.pix_holder,
    is_active=excluded.is_active,
    updated_at=now();
end;
$$;

revoke all on function public.upsert_participant_pix_key(integer,text,text,boolean) from public, anon;
grant execute on function public.upsert_participant_pix_key(integer,text,text,boolean) to authenticated;

create or replace function public.get_participant_checkout_admin_queue()
returns table (
  checkout_id uuid,
  participant_id uuid,
  participant_name text,
  status text,
  item_count integer,
  total_amount numeric,
  pix_key_snapshot text,
  submitted_at timestamptz,
  created_at timestamptz,
  proof_object_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('payments.read') then
    raise exception 'Permissão insuficiente para consultar checkouts';
  end if;

  return query
  select c.id,p.id,p.full_name,c.status,c.item_count,c.total_amount,c.pix_key_snapshot,c.submitted_at,c.created_at,m.object_path
  from public.participant_checkouts c
  join public.participants p on p.id=c.participant_id
  left join public.participant_checkout_media m on m.checkout_id=c.id and m.kind='PAYMENT_PROOF'
  where c.status in ('SUBMITTED','CONFIRMED','CANCELLED')
  order by coalesce(c.submitted_at,c.created_at) desc
  limit 150;
end;
$$;

revoke all on function public.get_participant_checkout_admin_queue() from public, anon;
grant execute on function public.get_participant_checkout_admin_queue() to authenticated;

create or replace function public.cancel_participant_checkout_payment(target_checkout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('payments.manage') then
    raise exception 'Permissão insuficiente para cancelar checkout';
  end if;

  if not exists (
    select 1 from public.participant_checkouts c
    where c.id=target_checkout_id and c.status='SUBMITTED'
    for update
  ) then raise exception 'Checkout is not awaiting confirmation'; end if;

  update public.inventory_reservations ir
     set status='RELEASED',released_at=now(),updated_at=now(),
         notes=trim(concat_ws(E'\n',nullif(ir.notes,''),'Reserva liberada após cancelamento administrativo do checkout.'))
   where ir.registration_id in (
     select r.id from public.registrations r where r.checkout_id=target_checkout_id
   ) and ir.status='RESERVED';

  update public.registration_payments p
     set status='CANCELLED',updated_at=now(),
         notes=trim(concat_ws(E'\n',nullif(p.notes,''),'Pagamento do checkout cancelado administrativamente.'))
   where p.registration_id in (
     select r.id from public.registrations r where r.checkout_id=target_checkout_id
   ) and p.status='PENDING';

  update public.registrations r
     set status='CANCELLED',updated_at=now(),
         notes=trim(concat_ws(E'\n',nullif(r.notes,''),'Checkout cancelado administrativamente.'))
   where r.checkout_id=target_checkout_id and r.status='PENDING';

  update public.participant_checkouts
     set status='CANCELLED',updated_at=now()
   where id=target_checkout_id;
end;
$$;

revoke all on function public.cancel_participant_checkout_payment(uuid) from public, anon;
grant execute on function public.cancel_participant_checkout_payment(uuid) to authenticated;

drop policy if exists participant_registration_media_admin_select on storage.objects;
create policy participant_registration_media_admin_select
on storage.objects
for select
to authenticated
using (
  bucket_id='participant-registration-media'
  and public.has_permission('payments.read')
);
