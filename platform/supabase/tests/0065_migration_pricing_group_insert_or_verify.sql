begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_function(
  'public',
  'migration_insert_or_verify_pricing_group',
  array['text','text','text','text','text'],
  'pricing group migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_pricing_group(text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute pricing group migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_pricing_group(text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute pricing group migration primitive'
);

insert into public.migration_import_activations (activation_id, source_fingerprint)
values ('pricing-group-writer-test', 'sha256:pricing-group-source');

select is(
  (
    select outcome
    from public.migration_insert_or_verify_pricing_group(
      'pricing-group-writer-test',
      'sha256:pricing-group-source',
      '2026-08',
      'PIX-2026-08',
      'Legacy pricing PIX-2026-08'
    )
  ),
  'INSERTED',
  'missing monthly pricing group is inserted'
);

select is(
  (
    select count(*)::integer
    from public.challenge_pricing_groups
    where period_code = '2026-08'
      and external_reference = 'PIX-2026-08'
  ),
  1,
  'pricing group is inserted only once'
);

select is(
  (
    select challenge_id is null
    from public.challenge_pricing_groups
    where period_code = '2026-08'
      and external_reference = 'PIX-2026-08'
  ),
  true,
  'monthly pricing group is not attached to one challenge'
);

select is(
  (
    select status
    from public.challenge_pricing_groups
    where period_code = '2026-08'
      and external_reference = 'PIX-2026-08'
  ),
  'ACTIVE',
  'staged monthly pricing group is active'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_pricing_group(
      'pricing-group-writer-test',
      'sha256:pricing-group-source',
      '2026-08',
      'PIX-2026-08',
      'Legacy pricing PIX-2026-08'
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_pricing_group(
    'pricing-group-writer-test',
    'sha256:pricing-group-source',
    '2026-08',
    'PIX-2026-08',
    'Different historical group'
  )$$,
  'P0001',
  'Migration pricing group conflicts with existing destination row',
  'divergent pricing group is blocked'
);

select is(
  (
    select internal_name
    from public.challenge_pricing_groups
    where period_code = '2026-08'
      and external_reference = 'PIX-2026-08'
  ),
  'Legacy pricing PIX-2026-08',
  'blocked divergence does not overwrite destination data'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_pricing_group(
    'pricing-group-writer-test',
    'sha256:pricing-group-source',
    '2026-13',
    'PIX-INVALID',
    'Invalid period group'
  )$$,
  'P0001',
  'Migration pricing group period code is invalid',
  'invalid monthly period is blocked'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'pricing-group-writer-test'
  ),
  'AUTHORIZED',
  'pricing group primitive does not complete migration activation'
);

select * from finish();
rollback;
