begin;

-- Estrutura principal
select 1 / case when to_regclass('public.challenges') is not null then 1 else 0 end;
select 1 / case when to_regclass('public.challenge_goals') is not null then 1 else 0 end;
select 1 / case when to_regclass('public.challenge_offers') is not null then 1 else 0 end;
select 1 / case when to_regclass('public.challenge_offer_goals') is not null then 1 else 0 end;

-- Permissões RBAC cadastradas
select 1 / case when exists (
  select 1 from public.app_permissions where code = 'challenges.read'
) then 1 else 0 end;
select 1 / case when exists (
  select 1 from public.app_permissions where code = 'challenges.manage'
) then 1 else 0 end;

-- RLS habilitada
select 1 / case when exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'challenges' and c.relrowsecurity
) then 1 else 0 end;
select 1 / case when exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'challenge_goals' and c.relrowsecurity
) then 1 else 0 end;
select 1 / case when exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'challenge_offers' and c.relrowsecurity
) then 1 else 0 end;
select 1 / case when exists (
  select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'challenge_offer_goals' and c.relrowsecurity
) then 1 else 0 end;

-- Cenário válido básico
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

-- Garante que a oferta aberta conservou meta vinculada
select 1 / case when exists (
  select 1
  from public.challenge_offers o
  join public.challenge_offer_goals cog on cog.offer_id = o.id
  where o.id = '33333333-3333-3333-3333-333333333333'
    and o.status = 'OPEN'
) then 1 else 0 end;

rollback;
