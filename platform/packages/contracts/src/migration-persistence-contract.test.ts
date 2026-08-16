import { describe, expect, it } from "vitest";
import {
  buildLegacyMigrationPersistenceContract,
  legacyMigrationPersistenceOperations,
} from "./migration-persistence-contract";
import type { MigrationReadinessReport } from "./migration-readiness-report";

function readiness(stagingReady: boolean): MigrationReadinessReport {
  return {
    stagingReady,
    persistenceEnabled: false,
    writeMode: "NONE",
    unresolvedDestinationFields: stagingReady
      ? []
      : ["public.challenges.sports_starts_at"],
    issueCounts: {
      structural: 0,
      payments: 0,
      offers: 0,
      goals: 0,
      pricing: 0,
      sportsPeriods: stagingReady ? 0 : 1,
    },
    totalStagedRows: 0,
    steps: [],
  };
}

describe("migration persistence contract", () => {
  it("keeps persistence disabled even when staging is ready", () => {
    const contract = buildLegacyMigrationPersistenceContract(readiness(true));

    expect(contract.stagingReady).toBe(true);
    expect(contract.eligibleForWriterImplementation).toBe(true);
    expect(contract.persistenceEnabled).toBe(false);
    expect(contract.writeMode).toBe("NONE");
    expect(contract.transactionPolicy).toBe("SINGLE_TRANSACTION_REQUIRED");
    expect(contract.conflictPolicy).toBe("VERIFY_EQUAL_OR_BLOCK");
    expect(contract.requiresExplicitActivation).toBe(true);
  });

  it("does not consider writer implementation eligible while staging is blocked", () => {
    const contract = buildLegacyMigrationPersistenceContract(readiness(false));

    expect(contract.stagingReady).toBe(false);
    expect(contract.eligibleForWriterImplementation).toBe(false);
    expect(contract.persistenceEnabled).toBe(false);
  });

  it("defines a deterministic dependency order with stable identities", () => {
    expect(
      legacyMigrationPersistenceOperations.map((operation) => ({
        order: operation.order,
        table: operation.destinationTable,
        identity: operation.identityColumns,
      })),
    ).toEqual([
      {
        order: 1,
        table: "public.challenges",
        identity: ["legacy_challenge_key"],
      },
      {
        order: 2,
        table: "public.challenge_goals",
        identity: ["challenge_id", "target_km"],
      },
      {
        order: 3,
        table: "public.challenge_offers",
        identity: ["legacy_id_desafio_lista"],
      },
      {
        order: 4,
        table: "public.challenge_offer_goals",
        identity: ["offer_id", "goal_id"],
      },
      {
        order: 5,
        table: "public.challenge_pricing_groups",
        identity: ["period_code", "external_reference"],
      },
      {
        order: 6,
        table: "public.challenge_pricing_group_offers",
        identity: ["pricing_group_id", "offer_id"],
      },
      {
        order: 7,
        table: "public.challenge_offer_price_lots",
        identity: ["pricing_group_id", "external_reference"],
      },
      {
        order: 8,
        table: "public.participants",
        identity: ["legacy_id_dgmb"],
      },
      {
        order: 9,
        table: "public.registrations",
        identity: ["legacy_id_inscricao"],
      },
      {
        order: 10,
        table: "public.registration_payments",
        identity: ["external_reference"],
      },
      {
        order: 11,
        table: "public.inventory_items",
        identity: ["legacy_id_item_estoque"],
      },
      {
        order: 12,
        table: "public.inventory_movements",
        identity: ["external_reference"],
      },
    ]);
    expect(
      legacyMigrationPersistenceOperations.every(
        (operation) => operation.strategy === "INSERT_OR_VERIFY",
      ),
    ).toBe(true);
  });
});
