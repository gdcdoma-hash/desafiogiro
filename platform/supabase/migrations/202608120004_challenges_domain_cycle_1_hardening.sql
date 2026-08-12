begin;

create index if not exists challenge_offer_goals_goal_idx
  on public.challenge_offer_goals(goal_id);

drop policy if exists challenges_admin_manage on public.challenges;
drop policy if exists challenge_goals_admin_manage on public.challenge_goals;
drop policy if exists challenge_offers_admin_manage on public.challenge_offers;
drop policy if exists challenge_offer_goals_admin_manage on public.challenge_offer_goals;

create policy challenges_admin_insert on public.challenges
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenges_admin_update on public.challenges
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));
create policy challenges_admin_delete on public.challenges
  for delete to authenticated
  using (public.has_permission('challenges.manage'));

create policy challenge_goals_admin_insert on public.challenge_goals
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenge_goals_admin_update on public.challenge_goals
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));
create policy challenge_goals_admin_delete on public.challenge_goals
  for delete to authenticated
  using (public.has_permission('challenges.manage'));

create policy challenge_offers_admin_insert on public.challenge_offers
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenge_offers_admin_update on public.challenge_offers
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));
create policy challenge_offers_admin_delete on public.challenge_offers
  for delete to authenticated
  using (public.has_permission('challenges.manage'));

create policy challenge_offer_goals_admin_insert on public.challenge_offer_goals
  for insert to authenticated
  with check (public.has_permission('challenges.manage'));
create policy challenge_offer_goals_admin_update on public.challenge_offer_goals
  for update to authenticated
  using (public.has_permission('challenges.manage'))
  with check (public.has_permission('challenges.manage'));
create policy challenge_offer_goals_admin_delete on public.challenge_offer_goals
  for delete to authenticated
  using (public.has_permission('challenges.manage'));

commit;
