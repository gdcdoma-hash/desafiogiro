begin;

create or replace view public.public_registration_admin_queue
with (security_invoker = true)
as
select
  r.id,
  r.created_at,
  r.status,
  r.full_name,
  r.phone_e164,
  r.city,
  r.state_code,
  r.referral_code,
  c.id as challenge_id,
  c.public_name as challenge_name,
  o.id as offer_id,
  o.public_name as offer_name,
  o.price,
  g.id as goal_id,
  g.target_km,
  coalesce(g.public_label, g.target_km::text || ' km') as goal_label
from public.public_registration_requests r
join public.challenge_offers o on o.id = r.offer_id
join public.challenges c on c.id = o.challenge_id
join public.challenge_goals g on g.id = r.goal_id;

revoke all on public.public_registration_admin_queue from anon, authenticated;
grant select on public.public_registration_admin_queue to authenticated;

create policy public_registration_requests_admin_read
on public.public_registration_requests
for select
to authenticated
using (public.has_permission('admin.access'));

create or replace function public.reject_public_registration_request(
  target_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_permission('admin.access') then
    raise exception 'Acesso administrativo necessário';
  end if;

  update public.public_registration_requests
  set status = 'REJECTED', processed_at = now()
  where id = target_request_id and status = 'RECEIVED';

  if not found then
    raise exception 'Solicitação não encontrada ou já processada';
  end if;
end;
$$;

revoke all on function public.reject_public_registration_request(uuid) from public;
grant execute on function public.reject_public_registration_request(uuid) to authenticated;

commit;
