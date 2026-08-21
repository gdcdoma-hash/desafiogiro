alter table public.challenges
  add column if not exists medal_image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'challenge-medals',
  'challenge-medals',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists challenge_medals_public_read on storage.objects;
create policy challenge_medals_public_read
on storage.objects
for select
to public
using (bucket_id = 'challenge-medals');

drop policy if exists challenge_medals_admin_insert on storage.objects;
create policy challenge_medals_admin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'challenge-medals'
  and public.has_permission('challenges.manage')
);

drop policy if exists challenge_medals_admin_update on storage.objects;
create policy challenge_medals_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'challenge-medals'
  and public.has_permission('challenges.manage')
)
with check (
  bucket_id = 'challenge-medals'
  and public.has_permission('challenges.manage')
);

drop policy if exists challenge_medals_admin_delete on storage.objects;
create policy challenge_medals_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'challenge-medals'
  and public.has_permission('challenges.manage')
);

create or replace function public.set_challenge_medal_image_path(
  target_challenge_id uuid,
  target_object_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('challenges.manage') then
    raise exception 'Permissão insuficiente para alterar a foto da medalha';
  end if;

  if nullif(trim(target_object_path), '') is null then
    raise exception 'Caminho da imagem é obrigatório';
  end if;

  if target_object_path not like target_challenge_id::text || '/%' then
    raise exception 'Caminho da imagem não pertence ao desafio';
  end if;

  update public.challenges
     set medal_image_path = trim(target_object_path),
         updated_at = now()
   where id = target_challenge_id;

  if not found then
    raise exception 'Desafio não encontrado';
  end if;
end;
$$;

revoke all on function public.set_challenge_medal_image_path(uuid,text) from public, anon;
grant execute on function public.set_challenge_medal_image_path(uuid,text) to authenticated;

drop function if exists public.get_participant_checkout_catalog();
create function public.get_participant_checkout_catalog()
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
  category_used integer,
  medal_image_path text
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
           c.medal_image_path,
           coalesce(rule.max_items, o.max_per_participant) as category_limit,
           coalesce(rule.reserve_on_add, false) as reserve_on_add
    from public.public_registration_catalog pc
    join public.challenge_offers o on o.id = pc.offer_id
    join public.challenges c on c.id = pc.challenge_id
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
      left join current_checkout cc on true
      where r.participant_id = lp2.participant_id
        and ro.category_code = cat.category_code
        and r.status not in ('CANCELLED','EXPIRED')
        and (cc.id is null or r.checkout_id is distinct from cc.id)
    ) as category_used,
    cat.medal_image_path
  from catalog cat
  cross join linked lp
  cross join prospective
  left join current_checkout cc on true
  left join public.inventory_availability av
    on av.challenge_id = cat.challenge_id and av.goal_id = cat.goal_id
  where not exists (
    select 1
    from public.registrations r
    where r.participant_id = lp.participant_id
      and r.challenge_id = cat.challenge_id
      and r.status not in ('CANCELLED','EXPIRED')
      and (cc.id is null or r.checkout_id is distinct from cc.id)
  )
  and (
    select count(*)
    from public.registrations r
    where r.participant_id = lp.participant_id
      and r.offer_id = cat.offer_id
      and r.status not in ('CANCELLED','EXPIRED')
      and (cc.id is null or r.checkout_id is distinct from cc.id)
  ) < (
    select o.max_per_participant
    from public.challenge_offers o
    where o.id = cat.offer_id
  )
  and (cat.reserve_on_add = false or coalesce(av.available_balance, 0) > 0)
  order by cat.reference_year desc, cat.reference_month desc, cat.display_order asc;
$$;

revoke all on function public.get_participant_checkout_catalog() from public, anon;
grant execute on function public.get_participant_checkout_catalog() to authenticated;
