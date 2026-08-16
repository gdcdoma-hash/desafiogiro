begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_table(
  'public',
  'migration_import_activations',
  'migration activation ledger exists'
);

select has_column(
  'public',
  'migration_import_activations',
  'activation_id',
  'activation id is stored'
);

select has_column(
  'public',
  'migration_import_activations',
  'source_fingerprint',
  'source fingerprint is stored'
);

select has_function(
  'public',
  'is_migration_import_authorized',
  array['text','text'],
  'migration authorization check exists'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'migration_import_activations'
      and indexname = 'migration_import_activations_source_fingerprint_active_uidx'
      and indexdef like 'CREATE UNIQUE INDEX%'
  ),
  'one active or completed execution is allowed per source fingerprint'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.migration_import_activations'::regclass),
  'migration activation ledger has RLS enabled'
);

select is(
  has_table_privilege('anon', 'public.migration_import_activations', 'SELECT'),
  false,
  'anon cannot read migration activation ledger'
);

select is(
  has_table_privilege('authenticated', 'public.migration_import_activations', 'SELECT'),
  false,
  'authenticated cannot read migration activation ledger'
);

select is(
  has_function_privilege('anon', 'public.is_migration_import_authorized(text,text)', 'EXECUTE'),
  false,
  'anon cannot execute migration authorization check'
);

select is(
  has_function_privilege('authenticated', 'public.is_migration_import_authorized(text,text)', 'EXECUTE'),
  false,
  'authenticated cannot execute migration authorization check'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'controlled-test-activation',
  'sha256:test-source-v1'
);

select is(
  public.is_migration_import_authorized(
    ' controlled-test-activation ',
    ' sha256:test-source-v1 '
  ),
  true,
  'exact authorized activation and source fingerprint pass the gate'
);

update public.migration_import_activations
set status = 'COMPLETED', completed_at = now()
where activation_id = 'controlled-test-activation';

select is(
  public.is_migration_import_authorized(
    'controlled-test-activation',
    'sha256:test-source-v1'
  ),
  false,
  'completed activation cannot be reused'
);

select * from finish();
rollback;
