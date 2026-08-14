begin;

-- Separar SELECT das operações de gestão evita que uma política FOR ALL seja
-- avaliada em paralelo com a política de leitura em toda consulta.

drop policy if exists medal_deliveries_admin_read on public.medal_deliveries;
drop policy if exists medal_deliveries_admin_manage on public.medal_deliveries;

create policy medal_deliveries_admin_select
on public.medal_deliveries for select to authenticated
using (
  public.has_permission('medal_deliveries.read')
  or public.has_permission('medal_deliveries.manage')
);
create policy medal_deliveries_admin_insert
on public.medal_deliveries for insert to authenticated
with check (public.has_permission('medal_deliveries.manage'));
create policy medal_deliveries_admin_update
on public.medal_deliveries for update to authenticated
using (public.has_permission('medal_deliveries.manage'))
with check (public.has_permission('medal_deliveries.manage'));
create policy medal_deliveries_admin_delete
on public.medal_deliveries for delete to authenticated
using (public.has_permission('medal_deliveries.manage'));

drop policy if exists medal_delivery_batches_admin_read on public.medal_delivery_batches;
drop policy if exists medal_delivery_batches_admin_manage on public.medal_delivery_batches;

create policy medal_delivery_batches_admin_select
on public.medal_delivery_batches for select to authenticated
using (
  public.has_permission('medal_deliveries.read')
  or public.has_permission('medal_deliveries.manage')
);
create policy medal_delivery_batches_admin_insert
on public.medal_delivery_batches for insert to authenticated
with check (public.has_permission('medal_deliveries.manage'));
create policy medal_delivery_batches_admin_update
on public.medal_delivery_batches for update to authenticated
using (public.has_permission('medal_deliveries.manage'))
with check (public.has_permission('medal_deliveries.manage'));
create policy medal_delivery_batches_admin_delete
on public.medal_delivery_batches for delete to authenticated
using (public.has_permission('medal_deliveries.manage'));

drop policy if exists medal_delivery_periods_admin_read on public.medal_delivery_periods;
drop policy if exists medal_delivery_periods_admin_manage on public.medal_delivery_periods;

create policy medal_delivery_periods_admin_select
on public.medal_delivery_periods for select to authenticated
using (
  public.has_permission('medal_deliveries.read')
  or public.has_permission('medal_deliveries.manage')
);
create policy medal_delivery_periods_admin_insert
on public.medal_delivery_periods for insert to authenticated
with check (public.has_permission('medal_deliveries.manage'));
create policy medal_delivery_periods_admin_update
on public.medal_delivery_periods for update to authenticated
using (public.has_permission('medal_deliveries.manage'))
with check (public.has_permission('medal_deliveries.manage'));
create policy medal_delivery_periods_admin_delete
on public.medal_delivery_periods for delete to authenticated
using (public.has_permission('medal_deliveries.manage'));

drop policy if exists participant_user_links_admin_read on public.participant_user_links;
drop policy if exists participant_user_links_admin_manage on public.participant_user_links;
drop policy if exists participant_user_links_self_read on public.participant_user_links;

create policy participant_user_links_select
on public.participant_user_links for select to authenticated
using (
  user_id = (select auth.uid())
  or public.has_permission('participants.read')
  or public.has_permission('participants.manage')
);
create policy participant_user_links_admin_insert
on public.participant_user_links for insert to authenticated
with check (public.has_permission('participants.manage'));
create policy participant_user_links_admin_update
on public.participant_user_links for update to authenticated
using (public.has_permission('participants.manage'))
with check (public.has_permission('participants.manage'));
create policy participant_user_links_admin_delete
on public.participant_user_links for delete to authenticated
using (public.has_permission('participants.manage'));

commit;
