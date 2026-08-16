begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

select has_function(
  'public',
  'migration_insert_or_verify_challenge_goal',
  array['text','text','text','integer','text','integer','boolean'],
  'challenge goal migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_challenge_goal(text,text,text,integer,text,integer,boolean)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute challenge goal migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_challenge_goal(text,text,text,integer,text,integer,boolean)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute challenge goal migration primitive'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'challenge-goal-writer-test',
  'sha256:challenge-goal-writer-source'
);

insert into public.challenges (
  legacy_challenge_key,
  legacy_id_desafio_base,
  code,
  public_name,
  reference_year,
  reference_month,
  sports_starts_at,
  sports_ends_at,
  timezone,
  status,
  is_public
) values (
  'legacy-goal-base-test:2026-08',
  'legacy-goal-base-test',
  'legacy-goal-test-2026-08',
  'Desafio Meta Teste',
  2026,
  8,
  '2026-08-01 00:00:00-03'::timestamptz,
  '2026-09-01 00:00:00-03'::timestamptz,
  'America/Fortaleza',
  'ARCHIVED',
  false
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_challenge_goal(
    'challenge-goal-writer-test',
    'sha256:challenge-goal-writer-source',
    'missing-challenge:2026-08',
    300,
    '300 km',
    1,
    true
  )$$,
  'P0001',
  'Migration challenge destination row does not exist',
  'goal insertion requires its challenge destination row'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge_goal(
      'challenge-goal-writer-test',
      'sha256:challenge-goal-writer-source',
      'legacy-goal-base-test:2026-08',
      300,
      '300 km',
      1,
      true
    )
  ),
  'INSERTED',
  'missing challenge goal is inserted'
);

select is(
  (
    select count(*)::integer
    from public.challenge_goals g
    join public.challenges c on c.id = g.challenge_id
    where c.legacy_challenge_key = 'legacy-goal-base-test:2026-08'
      and g.target_km = 300
  ),
  1,
  'challenge goal is inserted only once'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge_goal(
      'challenge-goal-writer-test',
      'sha256:challenge-goal-writer-source',
      'legacy-goal-base-test:2026-08',
      300,
      '300 km',
      1,
      true
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent challenge goal replay verifies instead of duplicating'
);

select is(
  (
    select count(*)::integer
    from public.challenge_goals g
    join public.challenges c on c.id = g.challenge_id
    where c.legacy_challenge_key = 'legacy-goal-base-test:2026-08'
      and g.target_km = 300
  ),
  1,
  'equivalent replay leaves one challenge goal row'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_challenge_goal(
    'challenge-goal-writer-test',
    'sha256:challenge-goal-writer-source',
    'legacy-goal-base-test:2026-08',
    300,
    'Meta divergente',
    1,
    true
  )$$,
  'P0001',
  'Migration challenge goal conflicts with existing destination row',
  'divergent challenge goal replay is blocked'
);

select is(
  (
    select public_label
    from public.challenge_goals g
    join public.challenges c on c.id = g.challenge_id
    where c.legacy_challenge_key = 'legacy-goal-base-test:2026-08'
      and g.target_km = 300
  ),
  '300 km',
  'blocked challenge goal conflict does not overwrite destination data'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'challenge-goal-writer-test'
  ),
  'AUTHORIZED',
  'goal primitive does not complete the overall migration activation'
);

select * from finish();
rollback;
