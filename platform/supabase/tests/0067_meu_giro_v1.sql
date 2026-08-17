begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

select has_table('public', 'participant_activities', 'activity table exists');
select has_function('public', 'my_giro', array['date'], 'participant progress function exists');
select has_function('public', 'record_manual_activity', array['uuid','text','numeric','timestamp without time zone','text','text'], 'manual contingency RPC exists');
select ok((select relrowsecurity from pg_class where oid='public.participant_activities'::regclass), 'activity RLS is enabled');
select ok(exists(select 1 from public.app_permissions where code='activities.read'), 'activities.read exists');
select ok(exists(select 1 from public.app_permissions where code='activities.manage'), 'activities.manage exists');

insert into auth.users (id, email) values
  ('60000000-0000-0000-0000-000000000001', 'admin@example.test'),
  ('60000000-0000-0000-0000-000000000002', 'one@example.test'),
  ('60000000-0000-0000-0000-000000000003', 'two@example.test');
insert into public.user_roles(user_id, role_id)
select '60000000-0000-0000-0000-000000000001', id from public.app_roles where code='platform_admin';
insert into public.participants(id, full_name) values
  ('61000000-0000-0000-0000-000000000001', 'Ciclista Um'),
  ('61000000-0000-0000-0000-000000000002', 'Ciclista Dois');
insert into public.participant_user_links(user_id, participant_id) values
  ('60000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000002');

insert into public.challenges(id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,timezone,status) values
  ('62000000-0000-0000-0000-000000000001','jul-2026','Julho',2026,7,'2026-07-01 03:00+00','2026-08-01 02:59:59+00','America/Fortaleza','FINISHED'),
  ('62000000-0000-0000-0000-000000000002','ago-2026','Agosto',2026,8,'2026-08-01 03:00+00','2026-09-01 02:59:59+00','America/Fortaleza','ACTIVE');
insert into public.challenge_goals(id,challenge_id,target_km,public_label) values
  ('63000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001',100,'100 km'),
  ('63000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002',200,'200 km');
insert into public.challenge_offers(id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,status) values
  ('64000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','Julho','Julho','NORMAL','2026-06-01','2026-06-30',10,'CLOSED'),
  ('64000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002','Agosto','Agosto','NORMAL','2026-07-01','2026-07-31',10,'CLOSED');
insert into public.challenge_offer_goals values
  ('64000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001',now()),
  ('64000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002',now());
insert into public.registrations(id,participant_id,challenge_id,goal_id,offer_id,occurrence_number,price_snapshot,status) values
  ('65000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','63000000-0000-0000-0000-000000000001','64000000-0000-0000-0000-000000000001',1,0,'CONFIRMED'),
  ('65000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002',1,0,'CONFIRMED'),
  ('65000000-0000-0000-0000-000000000003','61000000-0000-0000-0000-000000000002','62000000-0000-0000-0000-000000000002','63000000-0000-0000-0000-000000000002','64000000-0000-0000-0000-000000000002',1,0,'CONFIRMED');

insert into public.participant_activities(participant_id,registration_id,title,distance_km,started_at,started_local_at,timezone) values
  ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000001','Longão na virada',60,'2026-08-01 02:30+00','2026-07-31 23:30','America/Fortaleza'),
  ('61000000-0000-0000-0000-000000000001','65000000-0000-0000-0000-000000000002','Pedal de agosto',50,'2026-08-15 09:00+00','2026-08-15 06:00','America/Fortaleza'),
  ('61000000-0000-0000-0000-000000000002','65000000-0000-0000-0000-000000000003','Pedal isolado',90,'2026-08-16 09:00+00','2026-08-16 06:00','America/Fortaleza');

select is((select competence_month from public.participant_activities where title='Longão na virada'), date '2026-07-01', 'month crossing ride belongs to its local start month');

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.participant_activities), 2::bigint, 'participant reads only own activities');
select is((select count(*) from public.my_giro('2026-08-17')), 2::bigint, 'zero-activity and historical registrations remain visible');
select is((select completed_km from public.my_giro('2026-08-17') where challenge_name='Agosto'), 50.000::numeric, 'completed distance is calculated');
select is((select remaining_km from public.my_giro('2026-08-17') where challenge_name='Agosto'), 150.000::numeric, 'remaining distance is calculated');
select is((select progress_percent from public.my_giro('2026-08-17') where challenge_name='Agosto'), 25.0::numeric, 'percentage is calculated');
select ok((select is_current_focus from public.my_giro('2026-08-17') limit 1), 'current month is first focus despite incomplete old challenge');
select is((select completed_km from public.my_giro('2026-08-17') where challenge_name='Julho'), 60.000::numeric, 'historical month uses local-start competence');

select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000003',true);
select is((select count(*) from public.participant_activities), 1::bigint, 'RLS isolates the other participant');
select is((select completed_km from public.my_giro('2026-08-17') where challenge_name='Agosto'), 90.000::numeric, 'progress RPC isolates participants');

select set_config('request.jwt.claim.sub','60000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.record_manual_activity('65000000-0000-0000-0000-000000000002','Contingência',10,'2026-08-20 06:00','America/Fortaleza','fixture')$$, 'admin records a manual activity');
select is((select count(*) from public.audit_events where action='activity.manual.created'), 1::bigint, 'manual activity is audited');

select * from finish();
rollback;
