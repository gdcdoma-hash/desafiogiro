begin;

-- Índices de apoio às chaves estrangeiras apontadas pelo linter do Supabase.
create index if not exists participant_user_links_created_by_idx
  on public.participant_user_links (created_by)
  where created_by is not null;

create index if not exists public_registration_requests_goal_idx
  on public.public_registration_requests (goal_id);

create index if not exists public_registration_requests_offer_idx
  on public.public_registration_requests (offer_id);

create index if not exists public_registration_requests_participant_idx
  on public.public_registration_requests (participant_id)
  where participant_id is not null;

create index if not exists registrations_goal_idx
  on public.registrations (goal_id);

-- Avaliar auth.uid() uma vez por consulta evita um init plan por linha.
drop policy if exists participant_user_links_self_read
  on public.participant_user_links;
create policy participant_user_links_self_read
on public.participant_user_links for select to authenticated
using (user_id = (select auth.uid()));

-- `profiles` é um objeto legado presente no ambiente remoto, mas não é criado
-- no banco limpo do projeto. Otimizar suas políticas apenas quando existir.
do $$
begin
  if to_regclass('public.profiles') is not null then
    execute 'drop policy if exists profiles_select_own on public.profiles';
    execute 'create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id)';

    execute 'drop policy if exists profiles_insert_own on public.profiles';
    execute 'create policy profiles_insert_own on public.profiles for insert to authenticated with check ((select auth.uid()) = id)';

    execute 'drop policy if exists profiles_update_own on public.profiles';
    execute 'create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id)';
  end if;
end;
$$;

commit;
