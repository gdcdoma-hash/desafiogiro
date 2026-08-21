create table if not exists public.participant_payment_config (
  id boolean primary key default true check (id),
  pix_key text not null,
  pix_holder text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.participant_payment_config (id, pix_key, pix_holder, is_active)
values (true, 'PIX-DEV-NAO-REALIZAR-PAGAMENTO', 'Portal Giro - ambiente de desenvolvimento', true)
on conflict (id) do nothing;

alter table public.participant_payment_config enable row level security;

create table if not exists public.registration_media (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  kind text not null check (kind in ('AVATAR', 'PAYMENT_PROOF')),
  object_path text not null,
  mime_type text not null,
  original_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registration_id, kind)
);

alter table public.registration_media enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'participant-registration-media',
  'participant-registration-media',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists participant_registration_media_insert on storage.objects;
create policy participant_registration_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'participant-registration-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists participant_registration_media_select on storage.objects;
create policy participant_registration_media_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'participant-registration-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists participant_registration_media_update on storage.objects;
create policy participant_registration_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'participant-registration-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'participant-registration-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.get_participant_payment_config()
returns table (pix_key text, pix_holder text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.pix_key, c.pix_holder
  from public.participant_payment_config c
  where c.id = true and c.is_active = true;
$$;

revoke all on function public.get_participant_payment_config() from public;
revoke all on function public.get_participant_payment_config() from anon;
grant execute on function public.get_participant_payment_config() to authenticated;

create or replace function public.attach_participant_registration_media(
  target_registration_id uuid,
  target_kind text,
  target_object_path text,
  target_mime_type text,
  target_original_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if target_kind not in ('AVATAR', 'PAYMENT_PROOF') then
    raise exception 'Invalid media kind';
  end if;

  select l.participant_id into linked_participant_id
  from public.participant_user_links l
  where l.user_id = auth.uid();

  if not exists (
    select 1
    from public.registrations r
    where r.id = target_registration_id
      and r.participant_id = linked_participant_id
      and r.status = 'PENDING'
  ) then
    raise exception 'Registration is not available for media upload';
  end if;

  if split_part(target_object_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid object path';
  end if;

  insert into public.registration_media (
    registration_id, kind, object_path, mime_type, original_name
  ) values (
    target_registration_id, target_kind, target_object_path, target_mime_type, target_original_name
  )
  on conflict (registration_id, kind) do update set
    object_path = excluded.object_path,
    mime_type = excluded.mime_type,
    original_name = excluded.original_name,
    updated_at = now();
end;
$$;

revoke all on function public.attach_participant_registration_media(uuid,text,text,text,text) from public;
revoke all on function public.attach_participant_registration_media(uuid,text,text,text,text) from anon;
grant execute on function public.attach_participant_registration_media(uuid,text,text,text,text) to authenticated;

create or replace function public.submit_participant_registration(target_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_participant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select l.participant_id into linked_participant_id
  from public.participant_user_links l
  where l.user_id = auth.uid();

  if not exists (
    select 1
    from public.registrations r
    where r.id = target_registration_id
      and r.participant_id = linked_participant_id
      and r.status = 'PENDING'
  ) then
    raise exception 'Registration is not available for submission';
  end if;

  if not exists (
    select 1 from public.registration_media m
    where m.registration_id = target_registration_id and m.kind = 'AVATAR'
  ) then
    raise exception 'Avatar photo is required';
  end if;

  if not exists (
    select 1 from public.registration_media m
    where m.registration_id = target_registration_id and m.kind = 'PAYMENT_PROOF'
  ) then
    raise exception 'Payment proof is required';
  end if;

  update public.registration_payments p
  set notes = 'Comprovante enviado pelo participante e aguardando conferência administrativa',
      updated_at = now()
  where p.registration_id = target_registration_id
    and p.status = 'PENDING';

  update public.registrations r
  set notes = trim(concat_ws(E'\n', nullif(r.notes,''), 'Inscrição enviada pelo participante com foto e comprovante.')),
      updated_at = now()
  where r.id = target_registration_id;
end;
$$;

revoke all on function public.submit_participant_registration(uuid) from public;
revoke all on function public.submit_participant_registration(uuid) from anon;
grant execute on function public.submit_participant_registration(uuid) to authenticated;
