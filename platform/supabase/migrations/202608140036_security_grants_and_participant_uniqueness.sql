begin;

-- O telefone é a chave de reconciliação usada pelo fluxo público. Manter no
-- máximo um participante ATIVO por telefone complementa o advisory lock do
-- processamento e protege também inserções feitas por outros fluxos.
create unique index if not exists participants_active_phone_e164_unique
  on public.participants (phone_e164)
  where phone_e164 is not null and status = 'ACTIVE';

-- O catálogo público é consumido somente pela RPC SECURITY DEFINER. O acesso
-- direto à view não é necessário e expõe o objeto pela API/GraphQL.
revoke all on public.public_registration_catalog from public, anon, authenticated;

-- Funções internas do fluxo de pagamento/estoque não devem ser invocadas pelo
-- cliente. apply_confirmed_payment_to_registration é função de trigger e
-- try_reserve_inventory_for_registration é auxiliar interna.
revoke all on function public.apply_confirmed_payment_to_registration()
  from public, anon, authenticated;
revoke all on function public.try_reserve_inventory_for_registration(uuid)
  from public, anon, authenticated;

-- A reconciliação é uma ação administrativa autenticada e valida
-- inventory.manage dentro da própria função.
revoke all on function public.reconcile_confirmed_inventory_reservations(uuid)
  from public, anon, authenticated;
grant execute on function public.reconcile_confirmed_inventory_reservations(uuid)
  to authenticated;

-- Reafirma explicitamente as duas RPCs que são públicas por desenho.
revoke all on function public.get_public_registration_catalog()
  from public, anon, authenticated;
grant execute on function public.get_public_registration_catalog()
  to anon, authenticated;

revoke all on function public.submit_public_registration_request(uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_registration_request(uuid, uuid, text, text, text, text, text)
  to anon, authenticated;

commit;
