begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(11);

select has_table('public', 'challenges', 'challenges table exists');
select has_table('public', 'challenge_goals', 'challenge goals table exists');
select has_table('public', 'challenge_offers', 'challenge offers table exists');
select has_table('public', 'challenge_offer_goals', 'challenge offer goals table exists');

select ok(exists (
  select 1 from public.app_permissions where code = 'challenges.read'
), 'challenges.read permission exists');
select ok(exists (
  select 1 from public.app_permissions where code = 'challenges.manage'
), 'challenges.manage permission exists');

select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'challenges'), 'RLS enabled on challenges');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'challenge_goals'), 'RLS enabled on challenge_goals');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'challenge_offers'), 'RLS enabled on challenge_offers');
select ok((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = 'challenge_offer_goals'), 'RLS enabled on challenge_offer_goals');

insert into public.challenges (
  id, code, name, reference_year, reference_month,
  sport_starts_at, sport_ends_at, status
) values (
  '11111111-1111-1111-1111-111111111111',
  'teste-agosto-2026',
  'Teste Agosto 2026',
  2026, 8,
  '2026-08-01 00:00:00-03',
  '2026-08-31 23:59:59-03',
  'DRAFT'
);

insert into public.challenge_goals (
  id, challenge_id, distance_km, public_label, display_order
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  300,
  '300 km',
  1
);

insert into public.challenge_offers (
  id, challenge_id, code, internal_name, public_name, category,
  registration_starts_at, registration_ends_at, price_cents,
  max_per_participant, status
) values (
  '33333333-3333-3333-3333-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'normal-1',
  'Normal 1',
  'Inscrição',
  'NORMAL',
  '2026-07-15 00:00:00-03',
  '2026-08-10 23:59:59-03',
  3990,
  1,
  'DRAFT'
);

insert into public.challenge_offer_goals (offer_id, goal_id) values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222'
);

update public.challenge_offers
set status = 'OPEN'
where id = '33333333-3333-3333-3333-333333333333';

select ok(exists (
  select 1
  from public.challenge_offers o
  join public.challenge_offer_goals cog on cog.offer_id = o.id
  where o.id = '33333333-3333-3333-3333-333333333333'
    and o.status = 'OPEN'
), 'open offer keeps at least one linked goal');

select * from finish();
rollback;
