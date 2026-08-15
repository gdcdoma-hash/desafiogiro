begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(13);

select has_column('public','challenges','legacy_id_desafio_base','challenge preserves legacy base id');
select has_column('public','challenge_offers','legacy_id_desafio_lista','offer preserves legacy list id');
select has_column('public','participants','legacy_id_dgmb','participant preserves legacy DGMB id');
select has_column('public','registrations','legacy_id_inscricao','registration preserves legacy registration id');
select has_column('public','inventory_items','legacy_id_item_estoque','inventory item preserves legacy stock id');

select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='challenges' and indexname='challenges_legacy_id_desafio_base_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'challenge legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='challenge_offers' and indexname='challenge_offers_legacy_id_desafio_lista_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'offer legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='registrations' and indexname='registrations_legacy_id_inscricao_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'registration legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='inventory_items' and indexname='inventory_items_legacy_id_item_estoque_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'inventory legacy id is unique when present'
);
select ok(
  exists(select 1 from pg_indexes where schemaname='public' and tablename='registration_payments' and indexname='registration_payments_external_reference_uidx' and indexdef like 'CREATE UNIQUE INDEX%'),
  'payment external reference is unique when present'
);

select ok(
  exists(select 1 from pg_constraint where conname='participants_legacy_id_dgmb_nonblank'),
  'participant legacy id rejects blank values'
);
select ok(
  exists(select 1 from pg_constraint where conname='registrations_legacy_id_inscricao_nonblank'),
  'registration legacy id rejects blank values'
);
select ok(
  exists(select 1 from pg_constraint where conname='registration_payments_external_reference_nonblank'),
  'payment external reference rejects blank values'
);

select * from finish();
rollback;
