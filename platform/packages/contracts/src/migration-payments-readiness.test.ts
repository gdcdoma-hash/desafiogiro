import { describe, expect, it } from "vitest";
import { validateLegacyPaymentSnapshot } from "./migration-payments";
import type { LegacyMigrationSnapshot } from "./migration";

function fixture(batchId: string, amount: string): LegacyMigrationSnapshot {
  return {
    dgmbDesafios: {
      headers: [
        "Status_Pagamento",
        "id_lote_pagamento",
        "nome_lote_pagamento",
        "valor_unitario_pagamento",
      ],
      rows: [["Pendente", batchId, "Lote fictício", amount]],
    },
  };
}

describe("legacy payment migration prerequisites", () => {
  it("blocks blank payment batch identifiers", () => {
    const report = validateLegacyPaymentSnapshot(fixture("   ", "40,00"));

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "MISSING_PAYMENT_BATCH_ID",
          field: "ID_LOTE_PAGAMENTO",
          count: 1,
        },
      ]),
    );
  });

  it("blocks blank, zero and negative amounts because target payments require amount > 0", () => {
    for (const amount of ["", "0", "-1", "valor-inválido"]) {
      const report = validateLegacyPaymentSnapshot(fixture("batch-1", amount));
      expect(report.ok).toBe(false);
      expect(report.issues).toEqual(
        expect.arrayContaining([
          {
            code: "INVALID_PAYMENT_AMOUNT",
            field: "VALOR_UNITARIO_PAGAMENTO",
            count: 1,
          },
        ]),
      );
    }
  });
});
