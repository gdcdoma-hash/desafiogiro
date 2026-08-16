export type MigrationSourceResolutionStatus =
  | "SOURCE_CONFIRMED"
  | "PARTIAL_SOURCE"
  | "DERIVATION_CONFIRMED"
  | "DERIVATION_REQUIRED"
  | "AMBIGUOUS_SOURCE"
  | "POLICY_CONFIRMED"
  | "POLICY_REQUIRED"
  | "UNRESOLVED";

export type MigrationSourceResolution = {
  destinationField: string;
  status: MigrationSourceResolutionStatus;
  sourceSheet: string | null;
  sourceField: string | null;
  semanticRole: string;
  remainingBlocker: string;
};

export const legacyMigrationSourceResolution: readonly MigrationSourceResolution[] =
  [
    {
      destinationField: "public.challenges.reference_year",
      status: "DERIVATION_CONFIRMED",
      sourceSheet: "ListaDesafios",
      sourceField: "Periodo",
      semanticRole: "MONTHLY_CHALLENGE_EDITION",
      remainingBlocker:
        "Resolved by the strict monthly period normalizer. The migration challenge edition is keyed by legacy base id + normalized YYYY-MM period, and reference_year/reference_month are derived from that key.",
    },
    {
      destinationField: "public.challenges.sports_starts_at",
      status: "UNRESOLVED",
      sourceSheet: "ListaDesafios",
      sourceField: "Periodo",
      semanticRole: "MONTHLY_CHALLENGE_EDITION",
      remainingBlocker:
        "Periodo proves the monthly edition identity, but not the exact sports start instant. Data_Inicio is registration eligibility and must not be reused as the sports start date.",
    },
    {
      destinationField: "public.challenges.sports_ends_at",
      status: "UNRESOLVED",
      sourceSheet: "ListaDesafios",
      sourceField: "Periodo",
      semanticRole: "MONTHLY_CHALLENGE_EDITION",
      remainingBlocker:
        "Periodo proves the monthly edition identity, but not the exact sports end instant. Data_Fim is registration eligibility and must not be reused as the sports end date.",
    },
    {
      destinationField: "public.challenge_offers.registration_starts_at",
      status: "SOURCE_CONFIRMED",
      sourceSheet: "ListaDesafios",
      sourceField: "Data_Inicio",
      semanticRole: "REGISTRATION_ELIGIBILITY_START",
      remainingBlocker:
        "Resolved by the deterministic America/Fortaleza registration-window normalizer.",
    },
    {
      destinationField: "public.challenge_offers.registration_ends_at",
      status: "SOURCE_CONFIRMED",
      sourceSheet: "ListaDesafios",
      sourceField: "Data_Fim",
      semanticRole: "REGISTRATION_ELIGIBILITY_END",
      remainingBlocker:
        "Resolved by the deterministic inclusive end-of-day America/Fortaleza registration-window normalizer.",
    },
    {
      destinationField: "public.challenge_offers.category_code",
      status: "SOURCE_CONFIRMED",
      sourceSheet: "ListaDesafios",
      sourceField: "Tipo",
      semanticRole: "OFFER_TYPE",
      remainingBlocker:
        "Resolved by the explicit NORMAL/REPESCAGEM normalization vocabulary.",
    },
    {
      destinationField: "public.challenge_offers.price",
      status: "DERIVATION_CONFIRMED",
      sourceSheet: "PixLotes",
      sourceField: "valor_unitario",
      semanticRole: "MONTHLY_SHARED_LOT_PRICING",
      remainingBlocker:
        "Resolved as LOTS pricing rather than a manufactured fixed offer price. The legacy id_lote monthly prefix deterministically yields YYYY-MM; all offers in that period link to the same monthly pricing group, while status, pricing window, POR_QTD/POR_LOTE selection, quantity and raw unit/total values are staged from PixLotes. Prefixless rows are blocked by pricing preflight instead of being guessed.",
    },
    {
      destinationField: "public.registrations.goal_id",
      status: "SOURCE_CONFIRMED",
      sourceSheet: "dgmbDesafios",
      sourceField: "Meta_KM",
      semanticRole: "REGISTRATION_TARGET_KM",
      remainingBlocker:
        "The physical audit confirms Meta_KM at historical column 4. Staging resolves the destination goal by the natural key challenge edition + target_km and emits the observed offer-goal link; UUID resolution belongs to the later persistence phase.",
    },
    {
      destinationField: "public.registrations.occurrence_number",
      status: "DERIVATION_CONFIRMED",
      sourceSheet: "dgmbDesafios",
      sourceField: null,
      semanticRole: "OFFER_OCCURRENCE_ORDINAL",
      remainingBlocker:
        "Resolved deterministically from physical source-row order inside participant + offer. New registrations append rows, cancelled registrations are reactivated in place, and the legacy flow blocks a new active or cancelled registration for the same offer.",
    },
    {
      destinationField: "public.registration_payments.method_code",
      status: "POLICY_CONFIRMED",
      sourceSheet: "dgmbDesafios",
      sourceField: null,
      semanticRole: "UNKNOWN_PAYMENT_METHOD_PRESERVATION",
      remainingBlocker:
        "Resolved by the conservative migration policy LEGACY_UNSPECIFIED. The historical row has no verified payment-method field, so staging explicitly preserves that uncertainty instead of inferring PIX or MANUAL from the operational flow.",
    },
  ] as const;

export function migrationSourceResolutionFor(
  destinationField: string,
): MigrationSourceResolution | undefined {
  return legacyMigrationSourceResolution.find(
    (item) => item.destinationField === destinationField,
  );
}

export function confirmedLegacySourceFields(): string[] {
  return legacyMigrationSourceResolution
    .filter((item) => item.status === "SOURCE_CONFIRMED")
    .map((item) => `${item.sourceSheet}.${item.sourceField}`);
}
