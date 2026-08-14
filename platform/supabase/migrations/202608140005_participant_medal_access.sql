begin;

create table public.participant_user_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_id uuid not null unique references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.participant_user_links enable row level security;

create policy participant_user_links_admin_read
on public.participant_user_links for select to authenticated
using (public.has_permission('participants.read'));

create policy participant_user_links_admin_manage
on public.participant_user_links for all to authenticated
using (public.has_permission('participants.manage'))
with check (public.has_permission('participants.manage'));

create policy participant_user_links_self_read
on public.participant_user_links for select to authenticated
using (user_id = auth.uid());

revoke all on public.participant_user_links from anon;
grant select, insert, update, delete on public.participant_user_links to authenticated;

create or replace function public.current_participant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.participant_id
  from public.participant_user_links l
  where l.user_id = auth.uid();
$$;

create or replace function public.my_medal_deliveries()
returns table (
  delivery_id uuid,
  challenge_name text,
  target_km integer,
  status text,
  batch_label text,
  delivery_method text,
  responsible_name text,
  tracking_code text,
  handed_off_at timestamptz,
  athlete_confirmed_at timestamptz,
  issue_note text,
  needs_attention boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.id,
    o.challenge_name,
    o.target_km,
    o.status,
    o.batch_label,
    o.delivery_method,
    o.batch_responsible_name,
    o.tracking_code,
    o.handed_off_at,
    o.athlete_confirmed_at,
    o.issue_note,
    o.needs_attention
  from public.medal_delivery_overview o
  where o.participant_id = public.current_participant_id()
  order by o.created_at desc;
$$;

create or replace function public.confirm_my_medal_delivery_receipt(
  target_delivery_id uuid,
  confirmation_note text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_id_value uuid;
  current_status text;
begin
  participant_id_value := public.current_participant_id();
  if participant_id_value is null then
    raise exception 'Participant account is not linked';
  end if;

  select d.status into current_status
  from public.medal_deliveries d
  join public.registrations r on r.id = d.registration_id
  where d.id = target_delivery_id
    and r.participant_id = participant_id_value;

  if current_status is null then
    raise exception 'Medal delivery not found for current participant';
  end if;

  if current_status not in ('AWAITING_CONFIRMATION','ISSUE_REPORTED') then
    raise exception 'Medal delivery is not awaiting receipt confirmation';
  end if;

  update public.medal_deliveries
  set status = 'CONFIRMED',
      athlete_confirmation_note = trim(coalesce(confirmation_note, ''))
  where id = target_delivery_id;
end;
$$;

create or replace function public.report_my_medal_delivery_issue(
  target_delivery_id uuid,
  issue_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_id_value uuid;
  current_status text;
begin
  if length(trim(coalesce(issue_description, ''))) < 5 then
    raise exception 'Issue description is required';
  end if;

  participant_id_value := public.current_participant_id();
  if participant_id_value is null then
    raise exception 'Participant account is not linked';
  end if;

  select d.status into current_status
  from public.medal_deliveries d
  join public.registrations r on r.id = d.registration_id
  where d.id = target_delivery_id
    and r.participant_id = participant_id_value;

  if current_status is null then
    raise exception 'Medal delivery not found for current participant';
  end if;

  if current_status not in ('IN_TRANSIT','AWAITING_CONFIRMATION') then
    raise exception 'Medal delivery cannot report an issue in its current status';
  end if;

  update public.medal_deliveries
  set status = 'ISSUE_REPORTED',
      issue_note = trim(issue_description)
  where id = target_delivery_id;
end;
$$;

revoke all on function public.current_participant_id() from public;
revoke all on function public.my_medal_deliveries() from public;
revoke all on function public.confirm_my_medal_delivery_receipt(uuid, text) from public;
revoke all on function public.report_my_medal_delivery_issue(uuid, text) from public;

grant execute on function public.current_participant_id() to authenticated;
grant execute on function public.my_medal_deliveries() to authenticated;
grant execute on function public.confirm_my_medal_delivery_receipt(uuid, text) to authenticated;
grant execute on function public.report_my_medal_delivery_issue(uuid, text) to authenticated;

commit;
