begin;

create or replace function public.confirm_medal_delivery_receipt(
  target_delivery_id uuid,
  confirmation_note text default ''
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
begin
  select status into current_status
  from public.medal_deliveries
  where id = target_delivery_id;

  if current_status is null then
    raise exception 'Medal delivery not found';
  end if;

  if current_status not in ('AWAITING_CONFIRMATION','ISSUE_REPORTED') then
    raise exception 'Medal delivery is not awaiting receipt confirmation';
  end if;

  update public.medal_deliveries
  set status = 'CONFIRMED',
      athlete_confirmation_note = trim(coalesce(confirmation_note, '')),
      issue_note = case when current_status = 'ISSUE_REPORTED' then issue_note else '' end
  where id = target_delivery_id;
end;
$$;

create or replace function public.report_medal_delivery_issue(
  target_delivery_id uuid,
  issue_description text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_status text;
begin
  if length(trim(coalesce(issue_description, ''))) < 5 then
    raise exception 'Issue description is required';
  end if;

  select status into current_status
  from public.medal_deliveries
  where id = target_delivery_id;

  if current_status is null then
    raise exception 'Medal delivery not found';
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

create or replace function public.resume_medal_delivery_confirmation(
  target_delivery_id uuid,
  resolution_note text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if length(trim(coalesce(resolution_note, ''))) < 5 then
    raise exception 'Resolution note is required';
  end if;

  if not exists (
    select 1 from public.medal_deliveries
    where id = target_delivery_id
      and status = 'ISSUE_REPORTED'
  ) then
    raise exception 'Medal delivery has no open issue';
  end if;

  update public.medal_deliveries
  set status = 'AWAITING_CONFIRMATION',
      issue_note = issue_note || E'\nResolucao: ' || trim(resolution_note)
  where id = target_delivery_id;
end;
$$;

grant execute on function public.confirm_medal_delivery_receipt(uuid, text) to authenticated;
grant execute on function public.report_medal_delivery_issue(uuid, text) to authenticated;
grant execute on function public.resume_medal_delivery_confirmation(uuid, text) to authenticated;

commit;
