begin;

alter table public.challenges
  add column legacy_id_desafio_base text,
  add constraint challenges_legacy_id_desafio_base_nonblank
    check (legacy_id_desafio_base is null or length(trim(legacy_id_desafio_base)) > 0);

create unique index challenges_legacy_id_desafio_base_uidx
  on public.challenges(legacy_id_desafio_base)
  where legacy_id_desafio_base is not null;

alter table public.challenge_offers
  add column legacy_id_desafio_lista text,
  add constraint challenge_offers_legacy_id_desafio_lista_nonblank
    check (legacy_id_desafio_lista is null or length(trim(legacy_id_desafio_lista)) > 0);

create unique index challenge_offers_legacy_id_desafio_lista_uidx
  on public.challenge_offers(legacy_id_desafio_lista)
  where legacy_id_desafio_lista is not null;

alter table public.registrations
  add column legacy_id_inscricao text,
  add constraint registrations_legacy_id_inscricao_nonblank
    check (legacy_id_inscricao is null or length(trim(legacy_id_inscricao)) > 0);

create unique index registrations_legacy_id_inscricao_uidx
  on public.registrations(legacy_id_inscricao)
  where legacy_id_inscricao is not null;

alter table public.inventory_items
  add column legacy_id_item_estoque text,
  add constraint inventory_items_legacy_id_item_estoque_nonblank
    check (legacy_id_item_estoque is null or length(trim(legacy_id_item_estoque)) > 0);

create unique index inventory_items_legacy_id_item_estoque_uidx
  on public.inventory_items(legacy_id_item_estoque)
  where legacy_id_item_estoque is not null;

alter table public.participants
  add constraint participants_legacy_id_dgmb_nonblank
    check (legacy_id_dgmb is null or length(trim(legacy_id_dgmb)) > 0);

alter table public.registration_payments
  add constraint registration_payments_external_reference_nonblank
    check (external_reference is null or length(trim(external_reference)) > 0);

create unique index registration_payments_external_reference_uidx
  on public.registration_payments(external_reference)
  where external_reference is not null;

commit;
