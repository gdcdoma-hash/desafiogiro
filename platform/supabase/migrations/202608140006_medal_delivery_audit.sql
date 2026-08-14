begin;

create or replace function public.audit_medal_delivery_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_action text;
  event_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    event_action := 'medal_delivery.created';
    event_metadata := jsonb_build_object(
      'status', new.status,
      'challenge_id', new.challenge_id,
      'batch_id', new.batch_id
    );
  else
    if new.status is distinct from old.status then
      event_action := 'medal_delivery.status_changed';
    elsif new.batch_id is distinct from old.batch_id then
      event_action := 'medal_delivery.batch_changed';
    else
      event_action := 'medal_delivery.updated';
    end if;

    event_metadata := jsonb_build_object(
      'old_status', old.status,
      'new_status', new.status,
      'old_batch_id', old.batch_id,
      'new_batch_id', new.batch_id,
      'challenge_id', new.challenge_id
    );
  end if;

  insert into public.audit_events (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    outcome,
    metadata
  ) values (
    auth.uid(),
    event_action,
    'medal_delivery',
    new.id::text,
    'success',
    event_metadata
  );

  return new;
end;
$$;

create trigger medal_deliveries_audit
  after insert or update on public.medal_deliveries
  for each row execute function public.audit_medal_delivery_change();

create or replace function public.audit_medal_delivery_batch_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    outcome,
    metadata
  ) values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'medal_delivery_batch.created' else 'medal_delivery_batch.updated' end,
    'medal_delivery_batch',
    new.id::text,
    'success',
    jsonb_build_object(
      'challenge_id', new.challenge_id,
      'method', new.method,
      'status', new.status,
      'label', new.label
    )
  );

  return new;
end;
$$;

create trigger medal_delivery_batches_audit
  after insert or update on public.medal_delivery_batches
  for each row execute function public.audit_medal_delivery_batch_change();

create or replace function public.audit_medal_delivery_period_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    actor_user_id,
    action,
    resource_type,
    resource_id,
    outcome,
    metadata
  ) values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'medal_delivery_period.created' else 'medal_delivery_period.updated' end,
    'medal_delivery_period',
    new.id::text,
    'success',
    jsonb_build_object(
      'challenge_id', new.challenge_id,
      'status', new.status,
      'starts_at', new.starts_at,
      'ends_at', new.ends_at
    )
  );

  return new;
end;
$$;

create trigger medal_delivery_periods_audit
  after insert or update on public.medal_delivery_periods
  for each row execute function public.audit_medal_delivery_period_change();

commit;
