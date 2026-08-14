begin;

create or replace function public.write_audit_event(
  event_action text,
  event_resource_type text,
  event_outcome text,
  event_request_id uuid,
  event_resource_id text default null,
  event_reason text default null,
  event_metadata jsonb default '{}'::jsonb,
  event_application_version text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_permission('admin.access') then
    raise exception 'Administrative access required';
  end if;

  if event_metadata ?| array['password', 'token', 'secret', 'cpf', 'authorization'] then
    raise exception 'Forbidden audit metadata key';
  end if;

  insert into public.audit_events (
    actor_user_id, action, resource_type, resource_id, outcome, request_id,
    reason, metadata, application_version
  ) values (
    auth.uid(), event_action, event_resource_type, event_resource_id,
    event_outcome, event_request_id, event_reason,
    coalesce(event_metadata, '{}'::jsonb), event_application_version
  ) returning id into new_event_id;

  return new_event_id;
end;
$$;

revoke all on function public.write_audit_event(text, text, text, uuid, text, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.write_audit_event(text, text, text, uuid, text, text, jsonb, text)
  to authenticated;

commit;
