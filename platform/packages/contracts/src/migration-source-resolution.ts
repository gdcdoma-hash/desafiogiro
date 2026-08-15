export type MigrationSourceResolutionStatus =
  | "SOURCE_CONFIRMED"
  | "PARTIAL_SOURCE"
  | "DERIVATION_REQUIRED"
  | "AMBIGUOUS_SOURCE"
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

export const legacyMigrationSourceResolution: readonly MigrationSourceResolution[] = [
  {
    destinationField: "public.challenges.reference_year",
    status: "UNRESOLVED",
    sourceSheet: "ListaDesafios",
    sourceField: "Periodo",
    semanticRole: "LEGACY_PERIOD_LABEL",
    remainingBlocker:
      "Periodo is used as a legacy period label, but its format has not been proven to be a stable machine-readable source for reference_year.",
  },
  {
    destinationField: "public.challenges.sports_starts_at",
    status: "UNRESOLVED",
    sourceSheet: "ListaDesafios",
    sourceField: "Periodo",
    semanticRole: "LEGACY_PERIOD_LABEL",
    remainingBlocker:
      "Data_Inicio is used by the legacy code for registration eligibility, not proven as the sports start date.",
  },
  {
    destinationField: "public.challenges.sports_ends_at",
    status: "UNRESOLVED",
    sourceSheet: "ListaDesafios",
    sourceField: "Periodo",
    semanticRole: "LEGACY_PERIOD_LABEL",
    remainingBlocker:
      "Data_Fim is used by the legacy code for registration eligibility, not proven as the sports end date.",
  },
  {
    destinationField: "public.challenge_offers.registration_starts_at",
    status: "SOURCE_CONFIRMED",
    sourceSheet: "ListaDesafios",
    sourceField: "Data_Inicio",
    semanticRole: "REGISTRATION_ELIGIBILITY_START",
    remainingBlocker:
      "A deterministic legacy-date to timestamptz conversion with the platform timezone still needs to be implemented and tested.",
  },
  {
    destinationField: "public.challenge_offers.registration_ends_at",
    status: "SOURCE_CONFIRMED",
    sourceSheet: "ListaDesafios",
    sourceField: "Data_Fim",
    semanticRole: "REGISTRATION_ELIGIBILITY_END",
    remainingBlocker:
      "A deterministic legacy-date to timestamptz conversion with inclusive end-of-day semantics still needs to be implemented and tested.",
  },
  {
    destinationField: "public.challenge_offers.category_code",
    status: "SOURCE_CONFIRMED",
    sourceSheet: "ListaDesafios",
    sourceField: "Tipo",
    semanticRole: "OFFER_TYPE",
    remainingBlocker:
      "Legacy Tipo values need an explicit normalization vocabulary before they can satisfy the target category_code constraint.",
  },
  {
    destinationField: "public.challenge_offers.price",
    status: "AMBIGUOUS_SOURCE",
    sourceSheet: null,
    sourceField: null,
    semanticRole: "OFFER_PRICE",
    remainingBlocker:
      "Legacy pricing is selected through PixLotes and can vary by active lot and pending-registration quantity; registration rows also preserve valor_unitario_pagamento. A single offer price cannot be inferred safely yet.",
  },
  {
    destinationField: "public.registrations.goal_id",
    status: "PARTIAL_SOURCE",
    sourceSheet: "dgmbDesafios",
    sourceField: null,
    semanticRole: "REGISTRATION_TARGET_KM",
    remainingBlocker:
      "Legacy code reads and writes the registration target at the fourth column, but the trusted code does not establish a header alias for that position. Header-based migration must remain blocked until the column name is confirmed.",
  },
  {
    destinationField: "public.registrations.occurrence_number",
    status: "DERIVATION_REQUIRED",
    sourceSheet: "dgmbDesafios",
    sourceField: null,
    semanticRole: "OFFER_OCCURRENCE_ORDINAL",
    remainingBlocker:
      "No direct occurrence field was found. A deterministic ordering rule per participant and offer must be defined before assigning occurrence numbers.",
  },
  {
    destinationField: "public.registration_payments.method_code",
    status: "POLICY_REQUIRED",
    sourceSheet: "dgmbDesafios",
    sourceField: null,
    semanticRole: "PAYMENT_METHOD",
    remainingBlocker:
      "The operational legacy flow generates PIX, but the historical row does not preserve a verified method field. Assigning PIX to every historical payment would be an inference and requires an explicit migration policy.",
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
