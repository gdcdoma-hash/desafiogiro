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
import {
  normalizeLegacyTargetKm,
  validateLegacyGoalSnapshot,
  type LegacyGoalIssue,
} from "./migration-goals";
import { assignLegacyOccurrenceNumbers } from "./migration-occurrences";
import {
  normalizeLegacyPricingLot,
  validateLegacyPricingSnapshot,
  type LegacyPricingIssue,
} from "./migration-pricing";
import {
  buildLegacyChallengeInstanceKey,
  normalizeLegacyChallengePeriod,
} from "./migration-period";

export const LEGACY_UNSPECIFIED_PAYMENT_METHOD = "LEGACY_UNSPECIFIED" as const;

export type ChallengeMigrationDto = {
  legacyChallengeKey: string;
  legacyIdDesafioBase: string;
  periodCode: string;
  referenceYear: number;
  referenceMonth: number;
  publicName: string | null;
};

export type ChallengeGoalMigrationDto = {
  legacyChallengeKey: string;
  targetKm: number;
};

export type ChallengeOfferMigrationDto = {
  legacyIdDesafioLista: string;
  legacyChallengeKey: string;
  legacyChallengeBaseId: string;
  periodCode: string;
  publicName: string | null;
  categoryCode: LegacyOfferCategoryCode;
  registrationStartsAt: string;
  registrationEndsAt: string;
};

export type ChallengeOfferGoalMigrationDto = {
  legacyChallengeOfferId: string;
  legacyChallengeKey: string;
  targetKm: number;
};

export type PricingGroupMigrationDto = {
  periodCode: string;
  externalReference: string;
  internalName: string;
};

export type PricingGroupOfferMigrationDto = {
  periodCode: string;
  legacyChallengeOfferId: string;
};

export type PricingLotMigrationDto = {
  periodCode: string;
  externalReference: string;
  internalName: string;
  startsAt: string;
  endsAt: string | null;
  selectionMode: "ANY" | "REGISTRATION_COUNT";
  registrationCount: number | null;
  unitPrice: number;
  totalPrice: number | null;
  status: "ACTIVE" | "INACTIVE";
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
  targetKm: number;
  occurrenceNumber: number;
  priceSnapshot: number;
};

export type PaymentMigrationDto = {
  legacyRegistrationId: string;
  legacyBatchId: string;
  batchName: string | null;
  externalReference: string;
  amount: number;
  methodCode: typeof LEGACY_UNSPECIFIED_PAYMENT_METHOD;
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
  goalIssues: LegacyGoalIssue[];
  pricingIssues: LegacyPricingIssue[];
  challenges: ChallengeMigrationDto[];
  challengeGoals: ChallengeGoalMigrationDto[];
  challengeOffers: ChallengeOfferMigrationDto[];
  challengeOfferGoals: ChallengeOfferGoalMigrationDto[];
  pricingGroups: PricingGroupMigrationDto[];
  pricingGroupOffers: PricingGroupOfferMigrationDto[];
  pricingLots: PricingLotMigrationDto[];
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

function nullable(input: string): string | null {
  return input || null;
}

function decimal(input: string): number {
  return Number(input.trim().replace(",", "."));
}

function integer(input: string): number {
  return Number.parseInt(input.trim(), 10);
}

function blockedBundle(
  structuralIssues: MigrationIssue[],
  paymentIssues: LegacyPaymentIssue[],
  offerIssues: LegacyOfferIssue[],
  goalIssues: LegacyGoalIssue[],
  pricingIssues: LegacyPricingIssue[],
): LegacyMigrationStagingBundle {
  return {
    ready: false,
    writeMode: "NONE",
    insertReady: false,
    unresolvedDestinationFields,
    structuralIssues,
    paymentIssues,
    offerIssues,
    goalIssues,
    pricingIssues,
    challenges: [],
    challengeGoals: [],
    challengeOffers: [],
    challengeOfferGoals: [],
    pricingGroups: [],
    pricingGroupOffers: [],
    pricingLots: [],
    participants: [],
    registrations: [],
    payments: [],
    inventory: [],
  };
}

export const unresolvedDestinationFields = [
  "public.challenges.sports_starts_at",
  "public.challenges.sports_ends_at",
] as const;

export function transformLegacySnapshotToStagingDtos(
  snapshot: LegacyMigrationSnapshot,
): LegacyMigrationStagingBundle {
  const structural = validateLegacyMigrationSnapshot(snapshot);
  const payment = validateLegacyPaymentSnapshot(snapshot);
  const offer = validateLegacyOfferSnapshot(snapshot);
  const goal = validateLegacyGoalSnapshot(snapshot);
  const pricing = validateLegacyPricingSnapshot(snapshot);

  if (!structural.ok || !payment.ok || !offer.ok || !goal.ok || !pricing.ok) {
    return blockedBundle(
      structural.issues,
      payment.issues,
      offer.issues,
      goal.issues,
      pricing.issues,
    );
  }

  const challengeBaseSheet = snapshot.DesafiosBase!;
  const challengeOfferSheet = snapshot.ListaDesafios!;
  const participantSheet = snapshot.DadosPessoais!;
  const registrationSheet = snapshot.dgmbDesafios!;
  const inventorySheet = snapshot.DesafioKMEstoque!;
  const pricingSheet = snapshot.PixLotes!;

  const baseNameById = new Map(
    challengeBaseSheet.rows.map((row) => [
      value(challengeBaseSheet, row, ["id_desafio_base", "ID_Desafio_Base"]),
      nullable(
        value(challengeBaseSheet, row, [
          "nome_exibicao",
          "Nome_Desafio",
          "nome_desafio",
        ]),
      ),
    ]),
  );

  const challengeMap = new Map<string, ChallengeMigrationDto>();

  const challengeOffers = challengeOfferSheet.rows.map((row) => {
    const legacyChallengeBaseId = value(challengeOfferSheet, row, [
      "id_desafio_base",
      "ID_Desafio_Base",
    ]);
    const period = normalizeLegacyChallengePeriod(
      value(challengeOfferSheet, row, ["Periodo", "Período", "periodo"]),
    );
    const legacyChallengeKey = buildLegacyChallengeInstanceKey(
      legacyChallengeBaseId,
      period.periodCode,
    );
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

    challengeMap.set(legacyChallengeKey, {
      legacyChallengeKey,
      legacyIdDesafioBase: legacyChallengeBaseId,
      periodCode: period.periodCode,
      referenceYear: period.referenceYear,
      referenceMonth: period.referenceMonth,
      publicName: baseNameById.get(legacyChallengeBaseId) ?? null,
    });

    return {
      legacyIdDesafioLista: value(challengeOfferSheet, row, [
        "id_Desafio_lista",
        "ID_Desafio_Lista",
        "id_desafio_lista",
      ]),
      legacyChallengeKey,
      legacyChallengeBaseId,
      periodCode: period.periodCode,
      publicName: nullable(
        value(challengeOfferSheet, row, ["Nome_Desafio", "nome_desafio"]),
      ),
      categoryCode: normalized.categoryCode,
      registrationStartsAt: normalized.registrationStartsAt,
      registrationEndsAt: normalized.registrationEndsAt,
    };
  });

  const challenges = [...challengeMap.values()];
  const offerByLegacyId = new Map(
    challengeOffers.map((offerDto) => [
      offerDto.legacyIdDesafioLista,
      offerDto,
    ]),
  );

  const normalizedPricingLots = pricingSheet.rows.map((row) =>
    normalizeLegacyPricingLot(pricingSheet, row),
  );
  const pricingGroupMap = new Map<string, PricingGroupMigrationDto>();
  for (const lot of normalizedPricingLots) {
    pricingGroupMap.set(lot.periodCode, {
      periodCode: lot.periodCode,
      externalReference: lot.monthlyPrefix,
      internalName: `Legacy pricing ${lot.monthlyPrefix}`,
    });
  }
  const pricingGroups = [...pricingGroupMap.values()];
  const pricingGroupOffers = challengeOffers
    .filter((offerDto) => pricingGroupMap.has(offerDto.periodCode))
    .map((offerDto) => ({
      periodCode: offerDto.periodCode,
      legacyChallengeOfferId: offerDto.legacyIdDesafioLista,
    }));
  const pricingLots: PricingLotMigrationDto[] = normalizedPricingLots.map(
    (lot) => ({
      periodCode: lot.periodCode,
      externalReference: lot.externalReference,
      internalName: lot.internalName,
      startsAt: lot.startsAt,
      endsAt: lot.endsAt,
      selectionMode: lot.selectionMode,
      registrationCount: lot.registrationCount,
      unitPrice: lot.unitPrice,
      totalPrice: lot.totalPrice,
      status: lot.status,
    }),
  );

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

  const registrationSources = registrationSheet.rows.map((row) => ({
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
    targetKm: normalizeLegacyTargetKm(
      value(registrationSheet, row, ["Meta_KM", "meta_km"]),
    ),
    priceSnapshot: decimal(
      value(registrationSheet, row, ["valor_unitario_pagamento"]),
    ),
  }));

  const occurrences = assignLegacyOccurrenceNumbers(registrationSources);
  const registrations: RegistrationMigrationDto[] = occurrences.map(
    (registration, index) => ({
      ...registrationSources[index],
      occurrenceNumber: registration.occurrenceNumber,
    }),
  );

  const goalMap = new Map<string, ChallengeGoalMigrationDto>();
  const offerGoalMap = new Map<string, ChallengeOfferGoalMigrationDto>();

  for (const registration of registrations) {
    const offerDto = offerByLegacyId.get(registration.legacyChallengeOfferId)!;
    const goalKey = `${offerDto.legacyChallengeKey}:${registration.targetKm}`;
    goalMap.set(goalKey, {
      legacyChallengeKey: offerDto.legacyChallengeKey,
      targetKm: registration.targetKm,
    });

    const offerGoalKey = `${registration.legacyChallengeOfferId}:${registration.targetKm}`;
    offerGoalMap.set(offerGoalKey, {
      legacyChallengeOfferId: registration.legacyChallengeOfferId,
      legacyChallengeKey: offerDto.legacyChallengeKey,
      targetKm: registration.targetKm,
    });
  }

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
      methodCode: LEGACY_UNSPECIFIED_PAYMENT_METHOD,
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
    goalIssues: [],
    pricingIssues: [],
    challenges,
    challengeGoals: [...goalMap.values()],
    challengeOffers,
    challengeOfferGoals: [...offerGoalMap.values()],
    pricingGroups,
    pricingGroupOffers,
    pricingLots,
    participants,
    registrations,
    payments,
    inventory,
  };
}
