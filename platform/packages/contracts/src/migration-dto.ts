import {
  normalizeLegacyHeader,
  validateLegacyMigrationSnapshot,
  type LegacyMigrationSnapshot,
  type LegacySheetSnapshot,
  type MigrationIssue,
} from "./migration";
import {
  classifyLegacyPaymentStatus,
  validateLegacyPaymentSnapshot,
  type LegacyPaymentCategory,
  type LegacyPaymentIssue,
} from "./migration-payments";
import { buildLegacyPaymentExternalReference } from "./migration-manifest";
import {
  normalizeLegacyOfferSource,
  type LegacyOfferCategoryCode,
} from "./migration-offer-normalization";
import {
  validateLegacyOfferSnapshot,
  type LegacyOfferIssue,
} from "./migration-offers";

export type ChallengeMigrationDto = {
  legacyIdDesafioBase: string;
  publicName: string | null;
};

export type ChallengeOfferMigrationDto = {
  legacyIdDesafioLista: string;
  legacyChallengeBaseId: string;
  publicName: string | null;
  categoryCode: LegacyOfferCategoryCode;
  registrationStartsAt: string;
  registrationEndsAt: string;
};

export type ParticipantMigrationDto = {
  legacyIdDgmb: string;
  fullName: string | null;
  city: string | null;
  stateCode: string | null;
};

export type RegistrationMigrationDto = {
  legacyIdInscricao: string;
  legacyParticipantId: string;
  legacyChallengeOfferId: string;
};

export type PaymentMigrationDto = {
  legacyRegistrationId: string;
  legacyBatchId: string;
  batchName: string | null;
  externalReference: string;
  amount: number;
  category: Exclude<LegacyPaymentCategory, "EXEMPT" | "UNKNOWN">;
};

export type InventoryMigrationDto = {
  legacyIdItemEstoque: string;
  legacyChallengeOfferId: string;
  targetKm: number;
  quantity: number;
  legacyStatus: string;
};

export type LegacyMigrationStagingBundle = {
  ready: boolean;
  writeMode: "NONE";
  insertReady: false;
  unresolvedDestinationFields: readonly string[];
  structuralIssues: MigrationIssue[];
  paymentIssues: LegacyPaymentIssue[];
  offerIssues: LegacyOfferIssue[];
  challenges: ChallengeMigrationDto[];
  challengeOffers: ChallengeOfferMigrationDto[];
  participants: ParticipantMigrationDto[];
  registrations: RegistrationMigrationDto[];
  payments: PaymentMigrationDto[];
  inventory: InventoryMigrationDto[];
};

function fieldIndex(
  sheet: LegacySheetSnapshot,
  aliases: readonly string[],
): number {
  const normalizedHeaders = sheet.headers.map(normalizeLegacyHeader);
  return (
    aliases
      .map(normalizeLegacyHeader)
      .map((alias) => normalizedHeaders.indexOf(alias))
      .find((index) => index >= 0) ?? -1
  );
}

function value(
  sheet: LegacySheetSnapshot,
  row: readonly string[],
  aliases: readonly string[],
): string {
  const index = fieldIndex(sheet, aliases);
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function nullable(value: string): string | null {
  return value || null;
}

function decimal(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function integer(value: string): number {
  return Number.parseInt(value.trim(), 10);
}

function blockedBundle(
  structuralIssues: MigrationIssue[],
  paymentIssues: LegacyPaymentIssue[],
  offerIssues: LegacyOfferIssue[],
): LegacyMigrationStagingBundle {
  return {
    ready: false,
    writeMode: "NONE",
    insertReady: false,
    unresolvedDestinationFields: unresolvedDestinationFields,
    structuralIssues,
    paymentIssues,
    offerIssues,
    challenges: [],
    challengeOffers: [],
    participants: [],
    registrations: [],
    payments: [],
    inventory: [],
  };
}

export const unresolvedDestinationFields = [
  "public.challenges.reference_year",
  "public.challenges.sports_starts_at",
  "public.challenges.sports_ends_at",
  "public.challenge_offers.price",
  "public.registrations.goal_id",
  "public.registrations.occurrence_number",
  "public.registration_payments.method_code",
] as const;

export function transformLegacySnapshotToStagingDtos(
  snapshot: LegacyMigrationSnapshot,
): LegacyMigrationStagingBundle {
  const structural = validateLegacyMigrationSnapshot(snapshot);
  const payment = validateLegacyPaymentSnapshot(snapshot);
  const offer = validateLegacyOfferSnapshot(snapshot);

  if (!structural.ok || !payment.ok || !offer.ok) {
    return blockedBundle(structural.issues, payment.issues, offer.issues);
  }

  const challengeBaseSheet = snapshot.DesafiosBase!;
  const challengeOfferSheet = snapshot.ListaDesafios!;
  const participantSheet = snapshot.DadosPessoais!;
  const registrationSheet = snapshot.dgmbDesafios!;
  const inventorySheet = snapshot.DesafioKMEstoque!;

  const challenges = challengeBaseSheet.rows.map((row) => ({
    legacyIdDesafioBase: value(challengeBaseSheet, row, [
      "id_desafio_base",
      "ID_Desafio_Base",
    ]),
    publicName: nullable(
      value(challengeBaseSheet, row, [
        "nome_exibicao",
        "Nome_Desafio",
        "nome_desafio",
      ]),
    ),
  }));

  const challengeOffers = challengeOfferSheet.rows.map((row) => {
    const normalized = normalizeLegacyOfferSource({
      tipo: value(challengeOfferSheet, row, ["Tipo", "tipo"]),
      dataInicio: value(challengeOfferSheet, row, [
        "Data_Inicio",
        "data_inicio",
        "Data Inicio",
      ]),
      dataFim: value(challengeOfferSheet, row, [
        "Data_Fim",
        "data_fim",
        "Data Fim",
      ]),
    });

    return {
      legacyIdDesafioLista: value(challengeOfferSheet, row, [
        "id_Desafio_lista",
        "ID_Desafio_Lista",
        "id_desafio_lista",
      ]),
      legacyChallengeBaseId: value(challengeOfferSheet, row, [
        "id_desafio_base",
        "ID_Desafio_Base",
      ]),
      publicName: nullable(
        value(challengeOfferSheet, row, ["Nome_Desafio", "nome_desafio"]),
      ),
      categoryCode: normalized.categoryCode,
      registrationStartsAt: normalized.registrationStartsAt,
      registrationEndsAt: normalized.registrationEndsAt,
    };
  });

  const participants = participantSheet.rows.map((row) => ({
    legacyIdDgmb: value(participantSheet, row, [
      "ID_DGMB",
      "id_dgmb",
      "idDgmb",
    ]),
    fullName: nullable(
      value(participantSheet, row, ["Nome", "nome", "Nome_Completo"]),
    ),
    city: nullable(value(participantSheet, row, ["Cidade", "cidade"])),
    stateCode: nullable(
      value(participantSheet, row, ["UF", "uf"]).toUpperCase(),
    ),
  }));

  const registrations = registrationSheet.rows.map((row) => ({
    legacyIdInscricao: value(registrationSheet, row, [
      "ID_INSCRICAO",
      "ID_Inscricao",
      "id_inscricao",
    ]),
    legacyParticipantId: value(registrationSheet, row, [
      "ID_DGMB",
      "id_dgmb",
      "idDgmb",
    ]),
    legacyChallengeOfferId: value(registrationSheet, row, [
      "ID_Desafio_Lista",
      "id_Desafio_lista",
      "id_desafio_lista",
    ]),
  }));

  const payments = registrationSheet.rows.map((row) => {
    const legacyRegistrationId = value(registrationSheet, row, [
      "ID_INSCRICAO",
      "ID_Inscricao",
      "id_inscricao",
    ]);
    const legacyBatchId = value(registrationSheet, row, ["id_lote_pagamento"]);
    const category = classifyLegacyPaymentStatus(
      value(registrationSheet, row, [
        "Status_Pagamento",
        "status_pagamento",
        "Status Pagamento",
        "pagamento_status",
      ]),
    ) as PaymentMigrationDto["category"];

    return {
      legacyRegistrationId,
      legacyBatchId,
      batchName: nullable(
        value(registrationSheet, row, ["nome_lote_pagamento"]),
      ),
      externalReference: buildLegacyPaymentExternalReference(
        legacyRegistrationId,
        legacyBatchId,
      ),
      amount: decimal(
        value(registrationSheet, row, ["valor_unitario_pagamento"]),
      ),
      category,
    };
  });

  const inventory = inventorySheet.rows.map((row) => ({
    legacyIdItemEstoque: value(inventorySheet, row, [
      "id_item_estoque",
      "ID_Item_Estoque",
      "ID_ITEM_ESTOQUE",
    ]),
    legacyChallengeOfferId: value(inventorySheet, row, [
      "id_desafio_lista",
      "ID_Desafio_Lista",
      "id_Desafio_lista",
    ]),
    targetKm: integer(
      value(inventorySheet, row, [
        "distancia_km",
        "Distancia_KM",
        "DISTANCIA_KM",
      ]),
    ),
    quantity: integer(
      value(inventorySheet, row, ["quantidade", "Quantidade", "QUANTIDADE"]),
    ),
    legacyStatus: value(inventorySheet, row, ["status", "Status", "STATUS"]),
  }));

  return {
    ready: true,
    writeMode: "NONE",
    insertReady: false,
    unresolvedDestinationFields,
    structuralIssues: [],
    paymentIssues: [],
    offerIssues: [],
    challenges,
    challengeOffers,
    participants,
    registrations,
    payments,
    inventory,
  };
}
