begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

select has_table('public', 'participants', 'participants table exists');
select ok(exists (select 1 from public.app_permissions where code='participants.read'), 'participants.read permission exists');
select ok(exists (select 1 from public.app_permissions where code='participants.manage'), 'participants.manage permission exists');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='participants'), 'RLS enabled on participants');

insert into public.participants (id,legacy_id_dgmb,full_name,phone_e164,city,state_code)
values ('51111111-1111-1111-1111-111111111111','legacy-001','Participante Teste','+5598999999999','Santa Luzia do Paruá','MA');

select is((select legacy_id_dgmb from public.participants where id='51111111-1111-1111-1111-111111111111'),'legacy-001','legacy id is preserved separately from UUID');
select isnt((select id::text from public.participants where legacy_id_dgmb='legacy-001'),'legacy-001','legacy id is not primary id');
select throws_ok(
  $$insert into public.participants (legacy_id_dgmb,full_name) values ('legacy-001','Duplicado')$$,
  'duplicate key value violates unique constraint "participants_legacy_id_dgmb_key"',
  'legacy id must be unique'
);
select throws_ok(
  $$insert into public.participants (full_name,phone_e164) values ('Telefone Inválido','98999999999')$$,
  23514,
  null,
  'phone must use E.164 when present'
);

select * from finish();
rollback;
