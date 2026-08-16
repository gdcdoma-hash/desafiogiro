begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

select has_function(
  'public',
  'migration_insert_or_verify_challenge',
  array[
    'text','text','text','text','text','text',
    'smallint','smallint','timestamp with time zone','timestamp with time zone',
    'text','text','boolean'
  ],
  'challenge migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_challenge(text,text,text,text,text,text,smallint,smallint,timestamptz,timestamptz,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute challenge migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_challenge(text,text,text,text,text,text,smallint,smallint,timestamptz,timestamptz,text,text,boolean)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute challenge migration primitive'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'challenge-writer-test',
  'sha256:challenge-writer-source'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge(
      'challenge-writer-test',
      'sha256:challenge-writer-source',
      'legacy-base-test:2026-08',
      'legacy-base-test',
      'legacy-test-2026-08',
      'Desafio Legado Teste',
      2026::smallint,
      8::smallint,
      '2026-08-01 00:00:00-03'::timestamptz,
      '2026-09-01 00:00:00-03'::timestamptz,
      'America/Fortaleza',
      'ARCHIVED',
      false
    )
  ),
  'INSERTED',
  'missing challenge is inserted'
);

select is(
  (
    select count(*)::integer
    from public.challenges
    where legacy_challenge_key = 'legacy-base-test:2026-08'
  ),
  1,
  'challenge is inserted only once'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge(
      'challenge-writer-test',
      'sha256:challenge-writer-source',
      'legacy-base-test:2026-08',
      'legacy-base-test',
      'legacy-test-2026-08',
      'Desafio Legado Teste',
      2026::smallint,
      8::smallint,
      '2026-08-01 00:00:00-03'::timestamptz,
      '2026-09-01 00:00:00-03'::timestamptz,
      'America/Fortaleza',
      'ARCHIVED',
      false
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select is(
  (
    select count(*)::integer
    from public.challenges
    where legacy_challenge_key = 'legacy-base-test:2026-08'
  ),
  1,
  'equivalent replay leaves one challenge row'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_challenge(
    'challenge-writer-test',
    'sha256:challenge-writer-source',
    'legacy-base-test:2026-08',
    'legacy-base-test',
    'legacy-test-2026-08',
    'Nome Divergente',
    2026::smallint,
    8::smallint,
    '2026-08-01 00:00:00-03'::timestamptz,
    '2026-09-01 00:00:00-03'::timestamptz,
    'America/Fortaleza',
    'ARCHIVED',
    false
  )$$,
  'P0001',
  'Migration challenge conflicts with existing destination row',
  'divergent replay is blocked'
);

select is(
  (
    select public_name
    from public.challenges
    where legacy_challenge_key = 'legacy-base-test:2026-08'
  ),
  'Desafio Legado Teste',
  'blocked conflict does not overwrite destination data'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'challenge-writer-test'
  ),
  'AUTHORIZED',
  'primitive does not complete the overall migration activation'
);

select * from finish();
rollback;
