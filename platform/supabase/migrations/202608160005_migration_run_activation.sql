begin;

create table public.migration_import_activations (
  id uuid primary key default extensions.gen_random_uuid(),
  activation_id text not null,
  source_fingerprint text not null,
  status text not null default 'AUTHORIZED'
    check (status in ('AUTHORIZED','COMPLETED','CANCELLED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  check (length(trim(activation_id)) > 0),
  check (length(trim(source_fingerprint)) > 0),
  check (
    (status = 'AUTHORIZED' and completed_at is null and cancelled_at is null)
    or (status = 'COMPLETED' and completed_at is not null and cancelled_at is null)
    or (status = 'CANCELLED' and completed_at is null and cancelled_at is not null)
  ),
  unique (activation_id)
);

create unique index migration_import_activations_source_fingerprint_active_uidx
  on public.migration_import_activations(source_fingerprint)
  where status in ('AUTHORIZED','COMPLETED');

alter table public.migration_import_activations enable row level security;

revoke all on public.migration_import_activations from public, anon, authenticated;

create or replace function public.is_migration_import_authorized(
  p_activation_id text,
  p_source_fingerprint text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.migration_import_activations a
    where a.activation_id = trim(p_activation_id)
      and a.source_fingerprint = trim(p_source_fingerprint)
      and a.status = 'AUTHORIZED'
  );
$$;

revoke all on function public.is_migration_import_authorized(text, text)
  from public, anon, authenticated;

commit;
