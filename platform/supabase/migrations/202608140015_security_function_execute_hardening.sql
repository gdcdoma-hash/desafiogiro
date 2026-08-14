begin;

-- Funções internas de auditoria existem apenas para triggers.
revoke all on function public.audit_medal_delivery_change() from public, anon, authenticated;
revoke all on function public.audit_medal_delivery_batch_change() from public, anon, authenticated;
revoke all on function public.audit_medal_delivery_period_change() from public, anon, authenticated;

-- Funções do participante exigem sessão autenticada.
revoke all on function public.current_participant_id() from public, anon, authenticated;
revoke all on function public.my_medal_deliveries() from public, anon, authenticated;
revoke all on function public.confirm_my_medal_delivery_receipt(uuid, text) from public, anon, authenticated;
revoke all on function public.report_my_medal_delivery_issue(uuid, text) from public, anon, authenticated;

grant execute on function public.current_participant_id() to authenticated;
grant execute on function public.my_medal_deliveries() to authenticated;
grant execute on function public.confirm_my_medal_delivery_receipt(uuid, text) to authenticated;
grant execute on function public.report_my_medal_delivery_issue(uuid, text) to authenticated;

-- Processar ou rejeitar pré-inscrição é operação administrativa autenticada.
revoke all on function public.process_public_registration_request(uuid) from public, anon, authenticated;
revoke all on function public.reject_public_registration_request(uuid) from public, anon, authenticated;

grant execute on function public.process_public_registration_request(uuid) to authenticated;
grant execute on function public.reject_public_registration_request(uuid) to authenticated;

-- Enviar pré-inscrição é intencionalmente público, mas sem herdar permissão genérica de PUBLIC.
revoke all on function public.submit_public_registration_request(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_public_registration_request(uuid, uuid, text, text, text, text, text) to anon, authenticated;

commit;
