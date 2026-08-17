begin;

revoke all on function public.my_giro(date) from public, anon, authenticated;
revoke all on function public.record_manual_activity(uuid, text, numeric, timestamp without time zone, text, text) from public, anon, authenticated;

grant execute on function public.my_giro(date) to authenticated;
grant execute on function public.record_manual_activity(uuid, text, numeric, timestamp without time zone, text, text) to authenticated;

commit;
