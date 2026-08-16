begin;

alter table public.inventory_movements
  add column external_reference text,
  add constraint inventory_movements_external_reference_nonblank
    check (
      external_reference is null
      or length(trim(external_reference)) > 0
    );

create unique index inventory_movements_external_reference_uidx
  on public.inventory_movements(external_reference)
  where external_reference is not null;

commit;
