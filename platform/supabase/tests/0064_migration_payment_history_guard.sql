begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

select has_column(
  'public',
  'registration_payments',
  'paid_at_unknown',
  'payments can explicitly mark a historical paid_at as unknown'
);

insert into public.challenges (
  code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status, is_public
) values (
  'payment-history-test', 'Payment History Test', 2026, 8,
  '2026-08-01 00:00:00-03', '2026-09-01 00:00:00-03', 'ARCHIVED', false
);

insert into public.challenge_goals (challenge_id, target_km)
select id, 500 from public.challenges where code = 'payment-history-test';

insert into public.challenge_offers (
  challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at,
  price, pricing_mode, max_per_participant, status
)
select id, 'Payment History Offer', 'Payment History Offer', 'NORMAL',
  '2026-07-01 00:00:00-03', '2026-08-20 23:59:59-03',
  44.90, 'FIXED', 3, 'CLOSED'
from public.challenges where code = 'payment-history-test';

insert into public.challenge_offer_goals (offer_id, goal_id)
select o.id, g.id
from public.challenge_offers o
join public.challenge_goals g on g.challenge_id = o.challenge_id
where o.internal_name = 'Payment History Offer';

insert into public.participants (full_name, city)
values ('Payment History Participant', 'Santa Ines');

insert into public.registrations (
  participant_id, challenge_id, goal_id, offer_id,
  occurrence_number, price_snapshot, status, source_code
)
select p.id, c.id, g.id, o.id, 1, 44.90, 'COMPLETED', 'MIGRATION'
from public.participants p
cross join public.challenges c
join public.challenge_goals g on g.challenge_id = c.id and g.target_km = 500
join public.challenge_offers o on o.challenge_id = c.id and o.internal_name = 'Payment History Offer'
where p.full_name = 'Payment History Participant'
  and c.code = 'payment-history-test';

insert into public.registration_payments (
  registration_id, amount, method_code, status, external_reference
)
select id, 44.90, 'MANUAL', 'CONFIRMED', 'payment-history-normal'
from public.registrations
where source_code = 'MIGRATION';

select ok(
  (
    select paid_at is not null
    from public.registration_payments
    where external_reference = 'payment-history-normal'
  ),
  'normal confirmed payment still receives paid_at automatically'
);

select is(
  (
    select paid_at_unknown
    from public.registration_payments
    where external_reference = 'payment-history-normal'
  ),
  false,
  'normal confirmed payment does not claim an unknown timestamp'
);

insert into public.registration_payments (
  registration_id, amount, method_code, status,
  external_reference, paid_at, paid_at_unknown, notes
)
select id, 39.90, 'LEGACY_UNSPECIFIED', 'CONFIRMED',
  'payment-history-legacy', null, true, 'historical payment with unknown paid_at'
from public.registrations
where source_code = 'MIGRATION';

select ok(
  (
    select paid_at is null
    from public.registration_payments
    where external_reference = 'payment-history-legacy'
  ),
  'historical confirmed payment can preserve an unknown paid_at without inventing now()'
);

select is(
  (
    select paid_at_unknown
    from public.registration_payments
    where external_reference = 'payment-history-legacy'
  ),
  true,
  'historical unknown timestamp is explicit'
);

select throws_ok(
  $$insert into public.registration_payments (
    registration_id, amount, method_code, status,
    external_reference, paid_at_unknown
  )
  select id, 39.90, 'LEGACY_UNSPECIFIED', 'PENDING',
    'payment-history-invalid', true
  from public.registrations
  where source_code = 'MIGRATION'$$,
  '23514',
  null,
  'unknown paid_at marker is rejected for a non-confirmed payment'
);

select * from finish();
rollback;
