begin;

create unique index challenge_offer_price_lots_group_external_reference_uidx
  on public.challenge_offer_price_lots(pricing_group_id, external_reference)
  where pricing_group_id is not null and external_reference is not null;

commit;
