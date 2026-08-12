begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

insert into public.challenges (id,code,public_name,reference_year,reference_month,sports_starts_at,sports_ends_at,status)
values ('41111111-1111-1111-1111-111111111111','lifecycle-test','Lifecycle Test',2026,9,'2026-09-01 03:00+00','2026-10-01 02:59:59+00','DRAFT');

select throws_ok(
  $$update public.challenges set status='SCHEDULED' where id='41111111-1111-1111-1111-111111111111'$$,
  'Challenge needs at least one active goal before scheduling or activation',
  'challenge cannot schedule without active goal'
);

insert into public.challenge_goals (id,challenge_id,target_km,public_label)
values ('42222222-2222-2222-2222-222222222222','41111111-1111-1111-1111-111111111111',300,'300 km');
update public.challenges set status='SCHEDULED' where id='41111111-1111-1111-1111-111111111111';

select is((select status from public.challenges where id='41111111-1111-1111-1111-111111111111'),'SCHEDULED','draft can schedule with goal');
select throws_ok(
  $$update public.challenges set sports_ends_at='2026-10-02 02:59:59+00' where id='41111111-1111-1111-1111-111111111111'$$,
  'Structural challenge fields are locked after draft',
  'structural fields lock after draft'
);
select throws_ok(
  $$delete from public.challenge_goals where id='42222222-2222-2222-2222-222222222222'$$,
  'Challenge configuration cannot be deleted after draft',
  'goal cannot be deleted after challenge leaves draft'
);

insert into public.challenge_offers (id,challenge_id,internal_name,public_name,category_code,registration_starts_at,registration_ends_at,price,max_per_participant,status)
values ('43333333-3333-3333-3333-333333333333','41111111-1111-1111-1111-111111111111','Oferta teste','Oferta teste','NORMAL','2026-08-01 03:00+00','2026-08-31 02:59:59+00',44.90,1,'DRAFT');

select throws_ok(
  $$update public.challenge_offers set status='OPEN' where id='43333333-3333-3333-3333-333333333333'$$,
  'Offer needs at least one goal before scheduling or opening',
  'offer cannot open without goal'
);
insert into public.challenge_offer_goals(offer_id,goal_id) values ('43333333-3333-3333-3333-333333333333','42222222-2222-2222-2222-222222222222');
update public.challenge_offers set status='OPEN' where id='43333333-3333-3333-3333-333333333333';
select is((select status from public.challenge_offers where id='43333333-3333-3333-3333-333333333333'),'OPEN','offer opens with goal and scheduled challenge');
select throws_ok(
  $$update public.challenge_offers set price=49.90 where id='43333333-3333-3333-3333-333333333333'$$,
  'Structural offer fields are locked after draft',
  'offer structural fields lock after draft'
);

select * from finish();
rollback;
