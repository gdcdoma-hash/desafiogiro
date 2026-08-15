import { describe, expect, it } from "vitest";
import {
  classifyLegacyPaymentStatus,
  ignoredLegacyPaymentFields,
  validateLegacyPaymentSnapshot,
} from "./migration-payments";
import type { LegacyMigrationSnapshot } from "./migration";

function paymentFixture(): LegacyMigrationSnapshot {
  return {
    dgmbDesafios: {
      headers: [
        "ID_DGMB",
        "ID_Inscricao",
        "ID_Desafio_Lista",
        "Status_Pagamento",
        "id_lote_pagamento",
        "nome_lote_pagamento",
        "valor_unitario_pagamento",
        "chave_pix_lote",
        "validade_pix_lote",
      ],
      rows: [
        [
          "fixture-user-1",
          "fixture-registration-1",
          "fixture-list-1",
          "Pendente",
          "fixture-batch-1",
          "Lote fictício",
          "40,00",
          "PIX-SENSIVEL-NAO-DEVE-APARECER",
          "2099-01-01",
        ],
        [
          "fixture-user-2",
          "fixture-registration-2",
          "fixture-list-1",
          "Pago",
          "fixture-batch-1",
          "Lote fictício",
          "40.00",
          "PIX-SENSIVEL-NAO-DEVE-APARECER-2",
          "2099-01-01",
        ],
        [
          "fixture-user-3",
          "fixture-registration-3",
          "fixture-list-1",
          "Isento",
          "fixture-batch-2",
          "Cortesia fictícia",
          "0",
          "",
          "",
        ],
      ],
    },
  };
}

describe("legacy payment migration contract", () => {
  it("classifies the historical payment vocabulary explicitly", () => {
    expect(classifyLegacyPaymentStatus("Pendente")).toBe("PENDING");
    expect(classifyLegacyPaymentStatus("Não pago")).toBe("PENDING");
    expect(classifyLegacyPaymentStatus("Pago")).toBe("SETTLED");
    expect(classifyLegacyPaymentStatus("Confirmada")).toBe("SETTLED");
    expect(classifyLegacyPaymentStatus("Cancelado")).toBe("CANCELLED");
    expect(classifyLegacyPaymentStatus("Isenta")).toBe("EXEMPT");
    expect(classifyLegacyPaymentStatus("status improvisado")).toBe("UNKNOWN");
  });

  it("accepts valid fictitious payment metadata and reports only aggregates", () => {
    const report = validateLegacyPaymentSnapshot(paymentFixture());

    expect(report).toEqual({
      ok: true,
      rows: 3,
      categories: {
        PENDING: 1,
        SETTLED: 1,
        CANCELLED: 0,
        EXEMPT: 1,
        UNKNOWN: 0,
      },
      issues: [],
      ignoredSensitiveFields: ignoredLegacyPaymentFields,
    });
    expect(JSON.stringify(report)).not.toContain("PIX-SENSIVEL");
    expect(JSON.stringify(report)).not.toContain("fixture-user-1");
    expect(report.ignoredSensitiveFields).toEqual([
      "chave_pix_lote",
      "validade_pix_lote",
    ]);
  });

  it("blocks unknown statuses and malformed amounts without exposing values", () => {
    const fixture = paymentFixture();
    fixture.dgmbDesafios?.rows.push([
      "private-user",
      "private-registration",
      "fixture-list-1",
      "status privado desconhecido",
      "private-batch",
      "Lote privado",
      "valor privado inválido",
      "PIX-PRIVADO",
      "2099-01-01",
    ]);

    const report = validateLegacyPaymentSnapshot(fixture);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "UNKNOWN_PAYMENT_STATUS",
          field: "STATUS_PAGAMENTO",
          count: 1,
        },
        {
          code: "INVALID_PAYMENT_AMOUNT",
          field: "VALOR_UNITARIO_PAGAMENTO",
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("private-user");
    expect(JSON.stringify(report)).not.toContain("valor privado inválido");
    expect(JSON.stringify(report)).not.toContain("PIX-PRIVADO");
  });

  it("requires only payment fields needed by the migration contract", () => {
    const fixture: LegacyMigrationSnapshot = {
      dgmbDesafios: {
        headers: ["Status_Pagamento"],
        rows: [["Pago"]],
      },
    };

    const report = validateLegacyPaymentSnapshot(fixture);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "MISSING_PAYMENT_HEADER",
          field: "ID_LOTE_PAGAMENTO",
          count: 1,
        },
        {
          code: "MISSING_PAYMENT_HEADER",
          field: "NOME_LOTE_PAGAMENTO",
          count: 1,
        },
        {
          code: "MISSING_PAYMENT_HEADER",
          field: "VALOR_UNITARIO_PAGAMENTO",
          count: 1,
        },
      ]),
    );
    expect(report.issues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "chave_pix_lote" }),
        expect.objectContaining({ field: "validade_pix_lote" }),
      ]),
    );
  });
});
