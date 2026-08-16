begin;

create or replace function public.migration_insert_or_verify_payment(
  p_activation_id text,
  p_source_fingerprint text,
  p_legacy_id_inscricao text,
  p_external_reference text,
  p_amount numeric,
  p_status text,
  p_notes text
)
returns table(payment_id uuid, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  registration_uuid uuid;
  existing public.registration_payments%rowtype;
  normalized_status text := upper(trim(p_status));
  normalized_notes text := coalesce(p_notes, '');
  historical_paid_at_unknown boolean;
begin
  perform public.lock_migration_import_activation(p_activation_id, p_source_fingerprint);

  if p_legacy_id_inscricao is null or length(trim(p_legacy_id_inscricao)) = 0 then
    raise exception 'Migration payment registration legacy id is required';
  end if;

  if p_external_reference is null or length(trim(p_external_reference)) = 0 then
    raise exception 'Migration payment external reference is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Migration payment amount is invalid';
  end if;

  if normalized_status not in ('PENDING','CONFIRMED','CANCELLED') then
    raise exception 'Migration payment status is invalid';
  end if;

  historical_paid_at_unknown := normalized_status = 'CONFIRMED';

  select r.id
    into registration_uuid
  from public.registrations r
  where r.legacy_id_inscricao = trim(p_legacy_id_inscricao);

  if registration_uuid is null then
    raise exception 'Migration payment destination registration not found';
  end if;

  select *
    into existing
  from public.registration_payments p
  where p.external_reference = trim(p_external_reference);

  if existing.id is null then
    insert into public.registration_payments (
      registration_id,
      amount,
      method_code,
      status,
      external_reference,
      paid_at,
      paid_at_unknown,
      notes
    ) values (
      registration_uuid,
      p_amount,
      'LEGACY_UNSPECIFIED',
      normalized_status,
      trim(p_external_reference),
      null,
      historical_paid_at_unknown,
      normalized_notes
    )
    returning id into payment_id;

    outcome := 'INSERTED';
    return next;
    return;
  end if;

  if existing.registration_id = registration_uuid
     and existing.amount = p_amount
     and existing.method_code = 'LEGACY_UNSPECIFIED'
     and existing.status = normalized_status
     and existing.external_reference = trim(p_external_reference)
     and existing.paid_at is null
     and existing.paid_at_unknown = historical_paid_at_unknown
     and existing.notes = normalized_notes then
    payment_id := existing.id;
    outcome := 'VERIFIED_EQUAL';
    return next;
    return;
  end if;

  raise exception 'Migration payment conflicts with existing destination row';
end;
$$;

revoke all on function public.migration_insert_or_verify_payment(
  text, text, text, text, numeric, text, text
) from public, anon, authenticated;

commit;
