import type { MigrationDomain } from "./migration-plan";

export type MigrationLegacyKeyBinding = {
  domain: MigrationDomain;
  sourceField: string;
  destinationTable: string;
  destinationColumn: string;
  uniqueness: "UNIQUE_WHEN_PRESENT" | "LOOKUP_ONLY";
};

export const legacyMigrationKeyManifest: readonly MigrationLegacyKeyBinding[] =
  [
    {
      domain: "CHALLENGES",
      sourceField: "ID_DESAFIO_BASE",
      destinationTable: "public.challenges",
      destinationColumn: "legacy_id_desafio_base",
      uniqueness: "LOOKUP_ONLY",
    },
    {
      domain: "CHALLENGES",
      sourceField: "ID_DESAFIO_BASE + PERIODO",
      destinationTable: "public.challenges",
      destinationColumn: "legacy_challenge_key",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
    {
      domain: "CHALLENGES",
      sourceField: "ID_DESAFIO_LISTA",
      destinationTable: "public.challenge_offers",
      destinationColumn: "legacy_id_desafio_lista",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
    {
      domain: "PARTICIPANTS",
      sourceField: "ID_DGMB",
      destinationTable: "public.participants",
      destinationColumn: "legacy_id_dgmb",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
    {
      domain: "REGISTRATIONS",
      sourceField: "ID_INSCRICAO",
      destinationTable: "public.registrations",
      destinationColumn: "legacy_id_inscricao",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
    {
      domain: "PAYMENTS",
      sourceField: "ID_INSCRICAO + ID_LOTE_PAGAMENTO",
      destinationTable: "public.registration_payments",
      destinationColumn: "external_reference",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
    {
      domain: "INVENTORY",
      sourceField: "ID_ITEM_ESTOQUE",
      destinationTable: "public.inventory_items",
      destinationColumn: "legacy_id_item_estoque",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
    {
      domain: "INVENTORY",
      sourceField: "ID_ITEM_ESTOQUE (SALDO_INICIAL)",
      destinationTable: "public.inventory_movements",
      destinationColumn: "external_reference",
      uniqueness: "UNIQUE_WHEN_PRESENT",
    },
  ] as const;

export function buildLegacyPaymentExternalReference(
  registrationId: string,
  batchId: string,
): string {
  const normalizedRegistrationId = registrationId.trim();
  const normalizedBatchId = batchId.trim();

  if (!normalizedRegistrationId || !normalizedBatchId) {
    throw new Error(
      "Legacy payment external reference requires registration and batch identifiers",
    );
  }

  return `dgmb-payment:v1:${encodeURIComponent(normalizedRegistrationId)}:${encodeURIComponent(normalizedBatchId)}`;
}

export function buildLegacyInventoryOpeningExternalReference(
  inventoryItemId: string,
): string {
  const normalizedInventoryItemId = inventoryItemId.trim();
  if (!normalizedInventoryItemId) {
    throw new Error(
      "Legacy inventory opening reference requires an inventory item identifier",
    );
  }

  return `dgmb-inventory-opening:v1:${encodeURIComponent(normalizedInventoryItemId)}`;
}

export function legacyKeyTargetsForDomain(domain: MigrationDomain): string[] {
  return legacyMigrationKeyManifest
    .filter(
      (binding) =>
        binding.domain === domain &&
        binding.uniqueness === "UNIQUE_WHEN_PRESENT",
    )
    .map(
      (binding) => `${binding.destinationTable}.${binding.destinationColumn}`,
    );
}
