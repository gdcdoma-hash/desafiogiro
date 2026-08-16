import type {
  MigrationPersistenceContract,
  MigrationPersistenceOperation,
} from "./migration-persistence-contract";

export type ActivatedMigrationPersistenceContract = Omit<
  MigrationPersistenceContract,
  | "persistenceEnabled"
  | "writeMode"
  | "requiresExplicitActivation"
> & {
  persistenceEnabled: true;
  writeMode: "IDEMPOTENT_WRITE";
  requiresExplicitActivation: false;
  activationId: string;
};

export type MigrationWriterCollections = Readonly<
  Record<string, readonly unknown[]>
>;

export type MigrationWriterRowResult = "INSERTED" | "VERIFIED_EQUAL";

export type MigrationWriterTransaction = {
  insertOrVerify(
    operation: MigrationPersistenceOperation,
    row: unknown,
  ): Promise<MigrationWriterRowResult>;
};

export type MigrationWriterAdapter = {
  transaction<T>(
    work: (transaction: MigrationWriterTransaction) => Promise<T>,
  ): Promise<T>;
};

export type MigrationWriterExecutionSummary = {
  activationId: string;
  insertedRows: number;
  verifiedRows: number;
  processedRows: number;
  processedOperations: number;
};

export type MigrationWriterBlockedReason =
  | "STAGING_NOT_READY"
  | "PERSISTENCE_DISABLED"
  | "EXPLICIT_ACTIVATION_REQUIRED";

export function migrationWriterBlockedReasons(
  contract: MigrationPersistenceContract,
): MigrationWriterBlockedReason[] {
  const reasons: MigrationWriterBlockedReason[] = [];

  if (!contract.stagingReady) reasons.push("STAGING_NOT_READY");
  if (!contract.persistenceEnabled) reasons.push("PERSISTENCE_DISABLED");
  if (contract.requiresExplicitActivation) {
    reasons.push("EXPLICIT_ACTIVATION_REQUIRED");
  }

  return reasons;
}

function assertActivationId(activationId: string): void {
  if (!activationId.trim()) {
    throw new Error("Migration writer activationId must be nonblank");
  }
}

export async function executeActivatedLegacyMigrationWriter(
  contract: ActivatedMigrationPersistenceContract,
  collections: MigrationWriterCollections,
  adapter: MigrationWriterAdapter,
): Promise<MigrationWriterExecutionSummary> {
  if (!contract.stagingReady) {
    throw new Error("Migration writer requires stagingReady=true");
  }
  if (contract.transactionPolicy !== "SINGLE_TRANSACTION_REQUIRED") {
    throw new Error("Migration writer requires a single transaction");
  }
  if (contract.conflictPolicy !== "VERIFY_EQUAL_OR_BLOCK") {
    throw new Error("Migration writer requires verify-equal conflict policy");
  }

  assertActivationId(contract.activationId);

  return adapter.transaction(async (transaction) => {
    let insertedRows = 0;
    let verifiedRows = 0;
    let processedRows = 0;
    let processedOperations = 0;

    const operations = [...contract.operations].sort(
      (left, right) => left.order - right.order,
    );

    for (const operation of operations) {
      const rows = collections[operation.sourceCollection] ?? [];
      processedOperations += 1;

      for (const row of rows) {
        const result = await transaction.insertOrVerify(operation, row);
        processedRows += 1;
        if (result === "INSERTED") insertedRows += 1;
        else verifiedRows += 1;
      }
    }

    return {
      activationId: contract.activationId,
      insertedRows,
      verifiedRows,
      processedRows,
      processedOperations,
    };
  });
}
