begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(2);

insert into public.challenges (
  id, code, public_name, reference_year, reference_month,
  sports_starts_at, sports_ends_at, status
) values (
  '51111111-1111-1111-1111-111111111111',
  'period-guard-test',
  'Period Guard Test',
  2026,
  10,
  '2026-10-01 03:00+00',
  '2026-11-01 02:59:59+00',
  'DRAFT'
);

select throws_ok(
  $$insert into public.challenge_offers (
      challenge_id, internal_name, public_name, category_code,
      registration_starts_at, registration_ends_at, price,
      max_per_participant, status
    ) values (
      '51111111-1111-1111-1111-111111111111',
      'Oferta fora do periodo',
      'Oferta fora do periodo',
      'NORMAL',
      '2026-09-01 03:00+00',
      '2026-11-02 02:59:59+00',
      44.90,
      1,
      'DRAFT'
    )$$,
  'Offer registration period cannot end after challenge sports period',
  'offer cannot end after challenge sports period'
);

insert into public.challenge_offers (
  id, challenge_id, internal_name, public_name, category_code,
  registration_starts_at, registration_ends_at, price,
  max_per_participant, status
) values (
  '52222222-2222-2222-2222-222222222222',
  '51111111-1111-1111-1111-111111111111',
  'Oferta valida',
  'Oferta valida',
  'NORMAL',
  '2026-09-01 03:00+00',
  '2026-10-20 02:59:59+00',
  44.90,
  1,
  'DRAFT'
);

select throws_ok(
  $$update public.challenges
      set sports_ends_at = '2026-10-15 02:59:59+00'
      where id = '51111111-1111-1111-1111-111111111111'$$,
  'Challenge sports period cannot end before an existing offer registration period',
  'challenge cannot be shortened before existing offer end'
);

select * from finish();
rollback;
