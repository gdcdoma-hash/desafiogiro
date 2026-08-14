begin;

create or replace view public.medal_delivery_overview
with (security_invoker = true)
as
select
  d.id,
  d.registration_id,
  d.challenge_id,
  d.batch_id,
  d.status,
  d.tracking_code,
  d.handoff_recipient_name,
  d.handed_off_at,
  d.athlete_confirmed_at,
  d.issue_reported_at,
  d.issue_note,
  d.created_at,
  d.updated_at,
  r.status as registration_status,
  p.id as participant_id,
  p.full_name as participant_name,
  p.phone_e164 as participant_phone,
  p.city as participant_city,
  p.state_code as participant_state_code,
  c.public_name as challenge_name,
  g.target_km,
  b.label as batch_label,
  b.method as delivery_method,
  b.responsible_name as batch_responsible_name,
  b.status as batch_status,
  period.status as delivery_period_status,
  period.starts_at as delivery_period_starts_at,
  period.ends_at as delivery_period_ends_at,
  (d.status in ('PENDING','AWAITING_CONFIRMATION','ISSUE_REPORTED')) as needs_attention
from public.medal_deliveries d
join public.registrations r on r.id = d.registration_id
join public.participants p on p.id = r.participant_id
join public.challenges c on c.id = d.challenge_id
join public.challenge_goals g on g.id = r.goal_id
left join public.medal_delivery_batches b on b.id = d.batch_id
left join public.medal_delivery_periods period on period.challenge_id = d.challenge_id;

grant select on public.medal_delivery_overview to authenticated;
revoke all on public.medal_delivery_overview from anon;

commit;
