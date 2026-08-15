import {
  validateLegacyMigrationSnapshot,
  type LegacyMigrationSnapshot,
  type LegacySheetName,
  type MigrationIssue,
} from "./migration";
import {
  validateLegacyPaymentSnapshot,
  type LegacyPaymentIssue,
} from "./migration-payments";

export type MigrationDomain =
  | "CHALLENGES"
  | "PARTICIPANTS"
  | "REGISTRATIONS"
  | "PAYMENTS"
  | "INVENTORY";

export type MigrationDryRunStep = {
  order: number;
  domain: MigrationDomain;
  sourceSheets: readonly LegacySheetName[];
  destinationTables: readonly string[];
  candidateRows: number;
  idempotencyKeys: readonly string[];
  dependsOn: readonly MigrationDomain[];
};

export type MigrationDryRunPlan = {
  ready: boolean;
  writeMode: "NONE";
  steps: MigrationDryRunStep[];
  structuralIssues: MigrationIssue[];
  paymentIssues: LegacyPaymentIssue[];
};

function rowCount(snapshot: LegacyMigrationSnapshot, sheet: LegacySheetName): number {
  return snapshot[sheet]?.rows.length ?? 0;
}

export function buildLegacyMigrationDryRunPlan(
  snapshot: LegacyMigrationSnapshot,
): MigrationDryRunPlan {
  const structural = validateLegacyMigrationSnapshot(snapshot);
  const payments = validateLegacyPaymentSnapshot(snapshot);

  const steps: MigrationDryRunStep[] = [
    {
      order: 1,
      domain: "CHALLENGES",
      sourceSheets: ["DesafiosBase", "ListaDesafios"],
      destinationTables: [
        "public.challenges",
        "public.challenge_offers",
        "public.challenge_goals",
        "public.challenge_offer_goals",
      ],
      candidateRows:
        rowCount(snapshot, "DesafiosBase") + rowCount(snapshot, "ListaDesafios"),
      idempotencyKeys: ["ID_DESAFIO_BASE", "ID_DESAFIO_LISTA"],
      dependsOn: [],
    },
    {
      order: 2,
      domain: "PARTICIPANTS",
      sourceSheets: ["DadosPessoais"],
      destinationTables: ["public.participants"],
      candidateRows: rowCount(snapshot, "DadosPessoais"),
      idempotencyKeys: ["ID_DGMB"],
      dependsOn: [],
    },
    {
      order: 3,
      domain: "REGISTRATIONS",
      sourceSheets: ["dgmbDesafios"],
      destinationTables: ["public.registrations"],
      candidateRows: rowCount(snapshot, "dgmbDesafios"),
      idempotencyKeys: ["ID_INSCRICAO"],
      dependsOn: ["CHALLENGES", "PARTICIPANTS"],
    },
    {
      order: 4,
      domain: "PAYMENTS",
      sourceSheets: ["dgmbDesafios"],
      destinationTables: ["public.registration_payments"],
      candidateRows: rowCount(snapshot, "dgmbDesafios"),
      idempotencyKeys: ["ID_INSCRICAO", "ID_LOTE_PAGAMENTO"],
      dependsOn: ["REGISTRATIONS"],
    },
    {
      order: 5,
      domain: "INVENTORY",
      sourceSheets: ["DesafioKMEstoque"],
      destinationTables: [
        "public.inventory_items",
        "public.inventory_movements",
        "public.inventory_reservations",
      ],
      candidateRows: rowCount(snapshot, "DesafioKMEstoque"),
      idempotencyKeys: ["ID_ITEM_ESTOQUE"],
      dependsOn: ["CHALLENGES", "REGISTRATIONS"],
    },
  ];

  return {
    ready: structural.ok && payments.ok,
    writeMode: "NONE",
    steps,
    structuralIssues: structural.issues,
    paymentIssues: payments.issues,
  };
}
