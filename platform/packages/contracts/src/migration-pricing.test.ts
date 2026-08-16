import { describe, expect, it } from "vitest";
import type { LegacyMigrationSnapshot, LegacySheetSnapshot } from "./migration";
import {
  normalizeLegacyPricingLot,
  normalizeLegacyPricingPeriodReference,
  validateLegacyPricingSnapshot,
} from "./migration-pricing";

function pricingSheet(): LegacySheetSnapshot {
  return {
    headers: [
      "status",
      "data_inicio_sistema",
      "data_fim_sistema",
      "modo_pix",
      "qtd_inscricoes",
      "valor_total",
      "valor_unitario",
      "id_lote",
      "nome_lote",
      "chave_pix",
      "validade_pix",
    ],
    rows: [
      [
        "Ativo",
        "01/08/2026",
        "31/08/2026",
        "POR_QTD",
        "2",
        "79,80",
        "39,90",
        "AGO26_QTD_2",
        "Agosto 2 inscrições",
        "PIX-SECRETO",
        "31/08/2026",
      ],
    ],
  };
}

describe("legacy PixLotes pricing normalization", () => {
  it("derives the monthly period from the legacy lot prefix", () => {
    expect(normalizeLegacyPricingPeriodReference("AGO26_QTD_2")).toEqual({
      periodCode: "2026-08",
      monthlyPrefix: "AGO26",
    });
  });

  it("normalizes a quantity lot without exposing PIX credentials", () => {
    const sheet = pricingSheet();
    const normalized = normalizeLegacyPricingLot(sheet, sheet.rows[0]);

    expect(normalized).toEqual({
      periodCode: "2026-08",
      monthlyPrefix: "AGO26",
      externalReference: "AGO26_QTD_2",
      internalName: "Agosto 2 inscrições",
      startsAt: "2026-08-01T03:00:00.000Z",
      endsAt: "2026-09-01T02:59:59.999Z",
      selectionMode: "REGISTRATION_COUNT",
      registrationCount: 2,
      unitPrice: 39.9,
      totalPrice: 79.8,
      status: "ACTIVE",
    });
    expect(JSON.stringify(normalized)).not.toContain("PIX-SECRETO");
  });

  it("accepts POR_LOTE as an unqualified lot rule", () => {
    const sheet = pricingSheet();
    sheet.rows[0][3] = "POR_LOTE";
    sheet.rows[0][4] = "";

    expect(normalizeLegacyPricingLot(sheet, sheet.rows[0])).toEqual(
      expect.objectContaining({
        selectionMode: "ANY",
        registrationCount: null,
      }),
    );
  });

  it("blocks prefixless lots instead of guessing a challenge period", () => {
    const snapshot: LegacyMigrationSnapshot = { PixLotes: pricingSheet() };
    snapshot.PixLotes!.rows[0][7] = "LOTE_SEM_PERIODO";

    expect(validateLegacyPricingSnapshot(snapshot)).toEqual({
      ok: false,
      issues: [
        {
          code: "INVALID_PRICING_PERIOD_REFERENCE",
          field: "PixLotes",
          count: 1,
        },
      ],
    });
  });

  it("requires only migration-safe pricing headers, not PIX secret columns", () => {
    const sheet = pricingSheet();
    sheet.headers = sheet.headers.slice(0, 9);
    sheet.rows = sheet.rows.map((row) => row.slice(0, 9));

    expect(validateLegacyPricingSnapshot({ PixLotes: sheet })).toEqual({
      ok: true,
      issues: [],
    });
  });
});
