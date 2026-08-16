import type {
  MigrationReadinessDomain,
  MigrationReadinessReport,
} from "./migration-readiness-report";

export type MigrationPersistenceStrategy = "INSERT_OR_VERIFY";

export type MigrationPersistenceOperation = {
  order: number;
  domain: MigrationReadinessDomain;
  sourceCollection: string;
  destinationTable: string;
  identityColumns: readonly string[];
  strategy: MigrationPersistenceStrategy;
  dependsOnTables: readonly string[];
};

export type MigrationPersistenceContract = {
  stagingReady: boolean;
  eligibleForWriterImplementation: boolean;
  persistenceEnabled: false;
  writeMode: "NONE";
  transactionPolicy: "SINGLE_TRANSACTION_REQUIRED";
  conflictPolicy: "VERIFY_EQUAL_OR_BLOCK";
  requiresExplicitActivation: true;
  operations: readonly MigrationPersistenceOperation[];
};

export const legacyMigrationPersistenceOperations = [
  {
    order: 1,
    domain: "CHALLENGES",
    sourceCollection: "challenges",
    destinationTable: "public.challenges",
    identityColumns: ["legacy_challenge_key"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: [],
  },
  {
    order: 2,
    domain: "CHALLENGES",
    sourceCollection: "challengeGoals",
    destinationTable: "public.challenge_goals",
    identityColumns: ["challenge_id", "target_km"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.challenges"],
  },
  {
    order: 3,
    domain: "CHALLENGES",
    sourceCollection: "challengeOffers",
    destinationTable: "public.challenge_offers",
    identityColumns: ["legacy_id_desafio_lista"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.challenges"],
  },
  {
    order: 4,
    domain: "CHALLENGES",
    sourceCollection: "challengeOfferGoals",
    destinationTable: "public.challenge_offer_goals",
    identityColumns: ["offer_id", "goal_id"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.challenge_offers", "public.challenge_goals"],
  },
  {
    order: 5,
    domain: "PRICING",
    sourceCollection: "pricingGroups",
    destinationTable: "public.challenge_pricing_groups",
    identityColumns: ["period_code", "external_reference"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: [],
  },
  {
    order: 6,
    domain: "PRICING",
    sourceCollection: "pricingGroupOffers",
    destinationTable: "public.challenge_pricing_group_offers",
    identityColumns: ["pricing_group_id", "offer_id"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: [
      "public.challenge_pricing_groups",
      "public.challenge_offers",
    ],
  },
  {
    order: 7,
    domain: "PRICING",
    sourceCollection: "pricingLots",
    destinationTable: "public.challenge_offer_price_lots",
    identityColumns: ["pricing_group_id", "external_reference"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.challenge_pricing_groups"],
  },
  {
    order: 8,
    domain: "PARTICIPANTS",
    sourceCollection: "participants",
    destinationTable: "public.participants",
    identityColumns: ["legacy_id_dgmb"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: [],
  },
  {
    order: 9,
    domain: "REGISTRATIONS",
    sourceCollection: "registrations",
    destinationTable: "public.registrations",
    identityColumns: ["legacy_id_inscricao"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: [
      "public.participants",
      "public.challenges",
      "public.challenge_goals",
      "public.challenge_offers",
    ],
  },
  {
    order: 10,
    domain: "PAYMENTS",
    sourceCollection: "payments",
    destinationTable: "public.registration_payments",
    identityColumns: ["external_reference"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.registrations"],
  },
  {
    order: 11,
    domain: "INVENTORY",
    sourceCollection: "inventory",
    destinationTable: "public.inventory_items",
    identityColumns: ["legacy_id_item_estoque"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.challenges", "public.challenge_goals"],
  },
  {
    order: 12,
    domain: "INVENTORY",
    sourceCollection: "inventoryOpeningMovements",
    destinationTable: "public.inventory_movements",
    identityColumns: ["external_reference"],
    strategy: "INSERT_OR_VERIFY",
    dependsOnTables: ["public.inventory_items"],
  },
] as const satisfies readonly MigrationPersistenceOperation[];

export function buildLegacyMigrationPersistenceContract(
  readiness: MigrationReadinessReport,
): MigrationPersistenceContract {
  return {
    stagingReady: readiness.stagingReady,
    eligibleForWriterImplementation: readiness.stagingReady,
    persistenceEnabled: false,
    writeMode: "NONE",
    transactionPolicy: "SINGLE_TRANSACTION_REQUIRED",
    conflictPolicy: "VERIFY_EQUAL_OR_BLOCK",
    requiresExplicitActivation: true,
    operations: legacyMigrationPersistenceOperations,
  };
}
