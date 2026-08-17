begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(9);

select has_function('public', 'complete_registration', array['uuid'], 'safe completion RPC exists');

insert into auth.users (id, email) values
  ('67000000-0000-0000-0000-000000000001', 'completion-admin@example.test');
insert into public.user_roles(user_id, role_id)
select '67000000-0000-0000-0000-000000000001', id
from public.app_roles where code='platform_admin';

insert into public.participants(id, full_name) values
  ('67100000-0000-0000-0000-000000000001', 'Meta Exata'),
  ('67100000-0000-0000-0000-000000000002', 'Meta Acima'),
  ('67100000-0000-0000-0000-000000000003', 'Ainda Pendente');

insert into public.challenges(
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, timezone, status
) values (
  '67200000-0000-0000-0000-000000000001', 'completion-aug-2026',
  'Conclusão Agosto', 2026, 8, '2026-08-01 03:00+00',
  '2026-09-01 02:59:59+00', 'America/Fortaleza', 'ACTIVE'
);

insert into public.challenge_goals(id, challenge_id, target_km, public_label)
values ('67300000-0000-0000-0000-000000000001','67200000-0000-0000-0000-000000000001',100,'100 km');

insert into public.challenge_offers(
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price, max_per_participant, status
) values (
  '67400000-0000-0000-0000-000000000001','67200000-0000-0000-0000-000000000001',
  'Conclusão','Conclusão','NORMAL','2026-07-01 03:00+00','2026-07-31 02:59:59+00',
  10,1,'CLOSED'
);
insert into public.challenge_offer_goals(offer_id,goal_id)
values ('67400000-0000-0000-0000-000000000001','67300000-0000-0000-0000-000000000001');

insert into public.registrations(
  id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot,status
) values
  ('67500000-0000-0000-0000-000000000001','67100000-0000-0000-0000-000000000001','67200000-0000-0000-0000-000000000001','67300000-0000-0000-0000-000000000001','67400000-0000-0000-0000-000000000001',1,0,'CONFIRMED'),
  ('67500000-0000-0000-0000-000000000002','67100000-0000-0000-0000-000000000002','67200000-0000-0000-0000-000000000001','67300000-0000-0000-0000-000000000001','67400000-0000-0000-0000-000000000001',1,0,'CONFIRMED'),
  ('67500000-0000-0000-0000-000000000003','67100000-0000-0000-0000-000000000003','67200000-0000-0000-0000-000000000001','67300000-0000-0000-0000-000000000001','67400000-0000-0000-0000-000000000001',1,0,'PENDING');

insert into public.participant_activities(
  participant_id,registration_id,title,distance_km,started_at,started_local_at,timezone
) values
  ('67100000-0000-0000-0000-000000000001','67500000-0000-0000-0000-000000000001','Parcial',40,'2026-08-10 09:00+00','2026-08-10 06:00','America/Fortaleza'),
  ('67100000-0000-0000-0000-000000000002','67500000-0000-0000-0000-000000000002','Acima da meta',110,'2026-08-12 09:00+00','2026-08-12 06:00','America/Fortaleza');

set local role authenticated;
select set_config('request.jwt.claim.sub','67000000-0000-0000-0000-000000000001',true);

select throws_ok(
  $$select public.complete_registration('67500000-0000-0000-0000-000000000001')$$,
  'Goal not reached: 40.000 of 100 km',
  'completion below target is rejected'
);
select throws_ok(
  $$update public.registrations set status='COMPLETED' where id='67500000-0000-0000-0000-000000000001'$$,
  'Invalid registration status transition: CONFIRMED -> COMPLETED',
  'direct completion is rejected'
);

reset role;
insert into public.participant_activities(
  participant_id,registration_id,title,distance_km,started_at,started_local_at,timezone
) values (
  '67100000-0000-0000-0000-000000000001','67500000-0000-0000-0000-000000000001',
  'Fechamento da meta',60,'2026-08-20 09:00+00','2026-08-20 06:00','America/Fortaleza'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','67000000-0000-0000-0000-000000000001',true);
select lives_ok(
  $$select public.complete_registration('67500000-0000-0000-0000-000000000001')$$,
  'completion exactly at target succeeds'
);
select is(
  (select status from public.registrations where id='67500000-0000-0000-0000-000000000001'),
  'COMPLETED',
  'exact target registration becomes completed'
);
select is(
  (select count(*) from public.audit_events where action='registration.completed' and resource_id='67500000-0000-0000-0000-000000000001'),
  1::bigint,
  'completion is audited'
);
select lives_ok(
  $$select public.complete_registration('67500000-0000-0000-0000-000000000002')$$,
  'completion above target succeeds'
);
select throws_ok(
  $$select public.complete_registration('67500000-0000-0000-0000-000000000003')$$,
  'Only confirmed registrations can be completed',
  'pending registration cannot complete'
);
update public.registrations set status='CANCELLED'
where id='67500000-0000-0000-0000-000000000003';
select is(
  (select status from public.registrations where id='67500000-0000-0000-0000-000000000003'),
  'CANCELLED',
  'existing cancellation flow remains allowed'
);

select * from finish();
rollback;
