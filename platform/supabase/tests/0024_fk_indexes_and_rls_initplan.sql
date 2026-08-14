begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

select ok(
  to_regclass('public.participant_user_links_created_by_idx') is not null,
  'participant user links created_by index exists'
);

select ok(
  to_regclass('public.public_registration_requests_goal_idx') is not null,
  'public registration goal index exists'
);

select ok(
  to_regclass('public.public_registration_requests_offer_idx') is not null,
  'public registration offer index exists'
);

select ok(
  to_regclass('public.public_registration_requests_participant_idx') is not null,
  'public registration participant index exists'
);

select ok(
  to_regclass('public.registrations_goal_idx') is not null,
  'registrations goal index exists'
);

select ok(
  position(
    'SELECT auth.uid()' in coalesce((
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'participant_user_links'
        and cmd = 'SELECT'
      limit 1
    ), '')
  ) > 0,
  'participant self-read RLS evaluates auth.uid through a scalar subquery'
);

select * from finish();
rollback;
