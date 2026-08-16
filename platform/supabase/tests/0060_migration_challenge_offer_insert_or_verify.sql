begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

select has_function(
  'public',
  'migration_insert_or_verify_challenge_offer',
  array[
    'text','text','text','text','text','text','text',
    'timestamp with time zone','timestamp with time zone','text','numeric',
    'integer','integer','text','jsonb'
  ],
  'challenge offer migration insert-or-verify primitive exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.migration_insert_or_verify_challenge_offer(text,text,text,text,text,text,text,timestamptz,timestamptz,text,numeric,integer,integer,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'anon cannot execute challenge offer migration primitive'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.migration_insert_or_verify_challenge_offer(text,text,text,text,text,text,text,timestamptz,timestamptz,text,numeric,integer,integer,text,jsonb)',
    'EXECUTE'
  ),
  false,
  'authenticated cannot execute challenge offer migration primitive'
);

insert into public.migration_import_activations (
  activation_id,
  source_fingerprint
) values (
  'offer-writer-test',
  'sha256:offer-writer-source'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge(
      'offer-writer-test',
      'sha256:offer-writer-source',
      'legacy-base-offer:2026-08',
      'legacy-base-offer',
      'legacy-offer-challenge-2026-08',
      'Desafio Oferta Teste',
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
    from public.migration_insert_or_verify_challenge_offer(
      'offer-writer-test',
      'sha256:offer-writer-source',
      'legacy-offer-test',
      'legacy-base-offer:2026-08',
      'Oferta Legada Teste',
      'Oferta Legada Teste',
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
  'missing challenge offer is inserted'
);

select is(
  (
    select count(*)::integer
    from public.challenge_offers
    where legacy_id_desafio_lista = 'legacy-offer-test'
  ),
  1,
  'challenge offer is inserted only once'
);

select is(
  (
    select outcome
    from public.migration_insert_or_verify_challenge_offer(
      'offer-writer-test',
      'sha256:offer-writer-source',
      'legacy-offer-test',
      'legacy-base-offer:2026-08',
      'Oferta Legada Teste',
      'Oferta Legada Teste',
      'normal',
      '2026-07-20 00:00:00-03'::timestamptz,
      '2026-08-20 23:59:59-03'::timestamptz,
      'fixed',
      44.90,
      1,
      0,
      'closed',
      '{}'::jsonb
    )
  ),
  'VERIFIED_EQUAL',
  'equivalent replay verifies instead of duplicating'
);

select is(
  (
    select count(*)::integer
    from public.challenge_offers
    where legacy_id_desafio_lista = 'legacy-offer-test'
  ),
  1,
  'equivalent replay leaves one challenge offer row'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_challenge_offer(
    'offer-writer-test',
    'sha256:offer-writer-source',
    'legacy-offer-test',
    'legacy-base-offer:2026-08',
    'Oferta Legada Teste',
    'Nome Divergente',
    'NORMAL',
    '2026-07-20 00:00:00-03'::timestamptz,
    '2026-08-20 23:59:59-03'::timestamptz,
    'FIXED',
    44.90,
    1,
    0,
    'CLOSED',
    '{}'::jsonb
  )$$,
  'P0001',
  'Migration challenge offer conflicts with existing destination row',
  'divergent replay is blocked'
);

select is(
  (
    select public_name
    from public.challenge_offers
    where legacy_id_desafio_lista = 'legacy-offer-test'
  ),
  'Oferta Legada Teste',
  'blocked conflict does not overwrite destination data'
);

select is(
  (
    select status
    from public.migration_import_activations
    where activation_id = 'offer-writer-test'
  ),
  'AUTHORIZED',
  'primitive does not complete the overall migration activation'
);

select throws_ok(
  $$select * from public.migration_insert_or_verify_challenge_offer(
    'offer-writer-test',
    'sha256:offer-writer-source',
    'legacy-offer-invalid-price',
    'legacy-base-offer:2026-08',
    'Oferta Invalida',
    'Oferta Invalida',
    'NORMAL',
    '2026-07-20 00:00:00-03'::timestamptz,
    '2026-08-20 23:59:59-03'::timestamptz,
    'LOTS',
    44.90,
    1,
    0,
    'CLOSED',
    '{}'::jsonb
  )$$,
  'P0001',
  'Migration challenge offer price is invalid for pricing mode',
  'LOTS pricing cannot receive a fixed price'
);

select * from finish();
rollback;
