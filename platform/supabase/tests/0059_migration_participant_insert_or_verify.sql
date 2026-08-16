begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(10);

select has_function(
  'public',
  'migration_insert_or_verify_participant',
  array['text','text','text','text','text','text','text','text','text'],
  'participant migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_participant(text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute participant migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_participant(text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute participant migration primitive'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'participant-writer-test',
  'sha256:participant-writer-source'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_participant(
      'participant-writer-test',
      'sha256:participant-writer-source',
      'legacy-participant-test',
      'Participante Teste',
      null,
      'Santa Ines',
      'MA',
      'ACTIVE',
      'migration fixture'
    )
  ),
  'INSERTED',
  'missing participant is inserted'
);

select is(
  (
    select count(*)::integer
    from public.participants
    where legacy_id_dgmb = 'legacy-participant-test'
  ),
  1,
  'participant is inserted only once'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_participant(
      'participant-writer-test',
      'sha256:participant-writer-source',
      'legacy-participant-test',
      'Participante Teste',
      null,
      'Santa Ines',
      'ma',
      'ACTIVE',
      'migration fixture'
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select is(
  (
    select count(*)::integer
    from public.participants
    where legacy_id_dgmb = 'legacy-participant-test'
  ),
  1,
  'equivalent replay leaves one participant row'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_participant(
    'participant-writer-test',
    'sha256:participant-writer-source',
    'legacy-participant-test',
    'Nome Divergente',
    null,
    'Santa Ines',
    'MA',
    'ACTIVE',
    'migration fixture'
  )$$,
  'P0001',
  'Migration participant conflicts with existing destination row',
  'divergent replay is blocked'
);

select is(
  (
    select full_name
    from public.participants
    where legacy_id_dgmb = 'legacy-participant-test'
  ),
  'Participante Teste',
  'blocked conflict does not overwrite destination data'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'participant-writer-test'
  ),
  'AUTHORIZED',
  'primitive does not complete the overall migration activation'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_participant(
    'participant-writer-test',
    'sha256:participant-writer-source',
    'legacy-participant-invalid',
    '',
    null,
    '',
    null,
    'ACTIVE',
    ''
  )$$,
  'P0001',
  'Migration participant full name is required',
  'missing destination full name is blocked instead of invented'
);

select * from finish();
rollback;
