import { describe, expect, it } from "vitest";
import {
  executeActivatedLegacyMigrationWriter,
  migrationWriterBlockedReasons,
  type ActivatedMigrationPersistenceContract,
  type MigrationWriterAdapter,
} from "./migration-persistence-writer";
import {
  buildLegacyMigrationPersistenceContract,
} from "./migration-persistence-contract";
import type { MigrationReadinessReport } from "./migration-readiness-report";

function readiness(stagingReady: boolean): MigrationReadinessReport {
  return {
    stagingReady,
    persistenceEnabled: false,
    writeMode: "NONE",
    unresolvedDestinationFields: [],
    issueCounts: {
      structural: 0,
      payments: 0,
      offers: 0,
      goals: 0,
      pricing: 0,
      sportsPeriods: 0,
    },
    totalStagedRows: 0,
    steps: [],
  };
}

describe("migration persistence writer", () => {
  it("keeps the normal persistence contract blocked by default", () => {
    const contract = buildLegacyMigrationPersistenceContract(readiness(true));

    expect(migrationWriterBlockedReasons(contract)).toEqual([
      "PERSISTENCE_DISABLED",
      "EXPLICIT_ACTIVATION_REQUIRED",
    ]);
  });

  it("also reports staging as a blocker when reconciliation is incomplete", () => {
    const contract = buildLegacyMigrationPersistenceContract(readiness(false));

    expect(migrationWriterBlockedReasons(contract)).toEqual([
      "STAGING_NOT_READY",
      "PERSISTENCE_DISABLED",
      "EXPLICIT_ACTIVATION_REQUIRED",
    ]);
  });

  it("runs activated rows in one transaction and operation order", async () => {
    const calls: string[] = [];
    const adapter: MigrationWriterAdapter = {
      async transaction(work) {
        calls.push("BEGIN");
        const result = await work({
          async insertOrVerify(operation, row) {
            calls.push(`${operation.order}:${String(row)}`);
            return row === "existing" ? "VERIFIED_EQUAL" : "INSERTED";
          },
        });
        calls.push("COMMIT");
        return result;
      },
    };
    const contract: ActivatedMigrationPersistenceContract = {
      stagingReady: true,
      eligibleForWriterImplementation: true,
      persistenceEnabled: true,
      writeMode: "IDEMPOTENT_WRITE",
      transactionPolicy: "SINGLE_TRANSACTION_REQUIRED",
      conflictPolicy: "VERIFY_EQUAL_OR_BLOCK",
      requiresExplicitActivation: false,
      activationId: "controlled-test-run",
      operations: [
        {
          order: 2,
          domain: "PARTICIPANTS",
          sourceCollection: "participants",
          destinationTable: "public.participants",
          identityColumns: ["legacy_id_dgmb"],
          strategy: "INSERT_OR_VERIFY",
          dependsOnTables: [],
        },
        {
          order: 1,
          domain: "CHALLENGES",
          sourceCollection: "challenges",
          destinationTable: "public.challenges",
          identityColumns: ["legacy_challenge_key"],
          strategy: "INSERT_OR_VERIFY",
          dependsOnTables: [],
        },
      ],
    };

    const result = await executeActivatedLegacyMigrationWriter(
      contract,
      {
        challenges: ["new"],
        participants: ["existing"],
      },
      adapter,
    );

    expect(calls).toEqual(["BEGIN", "1:new", "2:existing", "COMMIT"]);
    expect(result).toEqual({
      activationId: "controlled-test-run",
      insertedRows: 1,
      verifiedRows: 1,
      processedRows: 2,
      processedOperations: 2,
    });
  });

  it("rejects blank activation identifiers before opening a transaction", async () => {
    let transactionOpened = false;
    const adapter: MigrationWriterAdapter = {
      async transaction(work) {
        transactionOpened = true;
        return work({
          async insertOrVerify() {
            return "INSERTED";
          },
        });
      },
    };
    const contract = {
      stagingReady: true,
      eligibleForWriterImplementation: true,
      persistenceEnabled: true,
      writeMode: "IDEMPOTENT_WRITE",
      transactionPolicy: "SINGLE_TRANSACTION_REQUIRED",
      conflictPolicy: "VERIFY_EQUAL_OR_BLOCK",
      requiresExplicitActivation: false,
      activationId: "   ",
      operations: [],
    } as ActivatedMigrationPersistenceContract;

    await expect(
      executeActivatedLegacyMigrationWriter(contract, {}, adapter),
    ).rejects.toThrow("activationId must be nonblank");
    expect(transactionOpened).toBe(false);
  });
});
