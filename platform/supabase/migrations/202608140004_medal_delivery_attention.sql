begin;

create or replace view public.medal_delivery_attention
with (security_invoker = true)
as
select
  o.*,
  case
    when o.status = 'ISSUE_REPORTED' then 'ISSUE'
    when o.delivery_period_ends_at is not null
      and now() > o.delivery_period_ends_at
      and o.status not in ('CONFIRMED','CANCELLED') then 'OVERDUE_PERIOD'
    when o.status = 'AWAITING_CONFIRMATION'
      and o.handed_off_at is not null
      and now() > o.handed_off_at + interval '7 days' then 'AWAITING_7_DAYS'
    when o.status = 'PENDING' then 'PENDING'
    else 'NORMAL'
  end as attention_reason,
  case
    when o.status = 'ISSUE_REPORTED' then 1
    when o.delivery_period_ends_at is not null
      and now() > o.delivery_period_ends_at
      and o.status not in ('CONFIRMED','CANCELLED') then 2
    when o.status = 'AWAITING_CONFIRMATION'
      and o.handed_off_at is not null
      and now() > o.handed_off_at + interval '7 days' then 3
    when o.status = 'PENDING' then 4
    else 5
  end as attention_priority,
  case
    when o.handed_off_at is null then null
    else greatest(0, floor(extract(epoch from (now() - o.handed_off_at)) / 86400))::integer
  end as days_since_handoff
from public.medal_delivery_overview o;

grant select on public.medal_delivery_attention to authenticated;
revoke all on public.medal_delivery_attention from anon;

commit;
