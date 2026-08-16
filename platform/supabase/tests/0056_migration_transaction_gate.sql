begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

select has_function(
  'public',
  'lock_migration_import_activation',
  array['text','text'],
  'transactional migration lock function exists'
);

select has_function(
  'public',
  'complete_migration_import_activation',
  array['text','text'],
  'transactional migration completion function exists'
);

select is(
  has_function_privilege('anon', 'public.lock_migration_import_activation(text,text)', 'EXECUTE'),
  false,
  'anon cannot lock migration activation'
);

select is(
  has_function_privilege('authenticated', 'public.lock_migration_import_activation(text,text)', 'EXECUTE'),
  false,
  'authenticated cannot lock migration activation'
);

select is(
  has_function_privilege('anon', 'public.complete_migration_import_activation(text,text)', 'EXECUTE'),
  false,
  'anon cannot complete migration activation'
);

select is(
  has_function_privilege('authenticated', 'public.complete_migration_import_activation(text,text)', 'EXECUTE'),
  false,
  'authenticated cannot complete migration activation'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'transaction-test-activation',
  'sha256:transaction-test-source'
);

select isnt(
  public.lock_migration_import_activation(
    ' transaction-test-activation ',
    ' sha256:transaction-test-source '
  ),
  null::uuid,
  'authorized activation can be locked using normalized identifiers'
);

select lives_ok(
  $$select public.complete_migration_import_activation(
    'transaction-test-activation',
    'sha256:transaction-test-source'
  )$$,
  'authorized activation can be completed'
);

select is(
  (select status from public.migration_import_activations where activation_id = 'transaction-test-activation'),
  'COMPLETED',
  'completion changes activation status'
);

select throws_ok(
  $$select public.lock_migration_import_activation(
    'transaction-test-activation',
    'sha256:transaction-test-source'
  )$$,
  'P0001',
  'Migration activation is not authorized',
  'completed activation cannot be locked again'
);

select * from finish();
rollback;
