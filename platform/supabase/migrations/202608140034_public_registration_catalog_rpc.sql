begin;

create or replace function public.get_public_registration_catalog()
returns setof public.public_registration_catalog
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.public_registration_catalog
  order by reference_year desc, reference_month desc, display_order asc;
$$;

revoke all on function public.get_public_registration_catalog() from public;
grant execute on function public.get_public_registration_catalog() to anon, authenticated;

commit;
