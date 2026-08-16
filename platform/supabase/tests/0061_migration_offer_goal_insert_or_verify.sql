begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_function(
  'public',
  'migration_insert_or_verify_offer_goal',
  array['text','text','text','text','integer'],
  'offer-goal migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_offer_goal(text,text,text,text,integer)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute offer-goal migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_offer_goal(text,text,text,text,integer)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute offer-goal migration primitive'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'offer-goal-writer-test',
  'sha256:offer-goal-writer-source'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge(
      'offer-goal-writer-test',
      'sha256:offer-goal-writer-source',
      'legacy-base-offer-goal:2026-08',
      'legacy-base-offer-goal',
      'legacy-offer-goal-challenge-2026-08',
      'Desafio Oferta Meta Teste',
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
  'challenge dependency is prepared'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge_goal(
      'offer-goal-writer-test',
      'sha256:offer-goal-writer-source',
      'legacy-base-offer-goal:2026-08',
      500,
      '500 km',
      0,
      true
    )
  ),
  'INSERTED',
  'goal dependency is prepared'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge_offer(
      'offer-goal-writer-test',
      'sha256:offer-goal-writer-source',
      'legacy-offer-goal-test',
      'legacy-base-offer-goal:2026-08',
      'Oferta Meta Teste',
      'Oferta Meta Teste',
      'NORMAL',
      '2026-07-20 00:00:00-03'::timestamptz,
      '2026-08-20 23:59:59-03'::timestamptz,
      'FIXED',
      44.90,
      1,
      0,
      'CLOSED',
      '{}'::jsonb
    )
  ),
  'INSERTED',
  'offer dependency is prepared'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_offer_goal(
      'offer-goal-writer-test',
      'sha256:offer-goal-writer-source',
      'legacy-offer-goal-test',
      'legacy-base-offer-goal:2026-08',
      500
    )
  ),
  'INSERTED',
  'missing offer-goal link is inserted'
);

select is(
  (
    select count(*)::integer
    from public.challenge_offer_goals og
    join public.challenge_offers o on o.id = og.offer_id
    join public.challenge_goals g on g.id = og.goal_id
    where o.legacy_id_desafio_lista = 'legacy-offer-goal-test'
      and g.target_km = 500
  ),
  1,
  'offer-goal link is inserted only once'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_offer_goal(
      'offer-goal-writer-test',
      'sha256:offer-goal-writer-source',
      'legacy-offer-goal-test',
      'legacy-base-offer-goal:2026-08',
      500
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select is(
  (
    select count(*)::integer
    from public.challenge_offer_goals og
    join public.challenge_offers o on o.id = og.offer_id
    join public.challenge_goals g on g.id = og.goal_id
    where o.legacy_id_desafio_lista = 'legacy-offer-goal-test'
      and g.target_km = 500
  ),
  1,
  'equivalent replay leaves one offer-goal link'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'offer-goal-writer-test'
  ),
  'AUTHORIZED',
  'primitive does not complete the overall migration activation'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_offer_goal(
    'offer-goal-writer-test',
    'sha256:offer-goal-writer-source',
    'legacy-offer-goal-test',
    'legacy-base-offer-goal:2026-08',
    999
  )$$,
  'P0001',
  'Migration offer goal destination goal not found',
  'missing destination goal is blocked instead of created implicitly'
);

select * from finish();
rollback;
