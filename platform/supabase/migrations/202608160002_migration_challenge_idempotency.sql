begin;

alter table public.challenges
  add column legacy_challenge_key text,
  add constraint challenges_legacy_challenge_key_nonblank
    check (
      legacy_challenge_key is null
      or length(trim(legacy_challenge_key)) > 0
    );

update public.challenges
set legacy_challenge_key =
  legacy_id_desafio_base
  || ':'
  || reference_year::text
  || '-'
  || lpad(reference_month::text, 2, '0')
where legacy_id_desafio_base is not null
  and reference_month is not null
  and legacy_challenge_key is null;

drop index if exists public.challenges_legacy_id_desafio_base_uidx;

create index challenges_legacy_id_desafio_base_idx
  on public.challenges(legacy_id_desafio_base)
  where legacy_id_desafio_base is not null;

create unique index challenges_legacy_challenge_key_uidx
  on public.challenges(legacy_challenge_key)
  where legacy_challenge_key is not null;

commit;
