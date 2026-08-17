begin;

-- public_registration_admin_queue usa security_invoker=true. O papel autenticado
-- precisa de SELECT na tabela-base para que a view funcione; a RLS da própria
-- tabela continua restringindo a leitura a quem possui admin.access.
grant select on public.public_registration_requests to authenticated;

commit;
