import { describe, expect, it } from "vitest";
import { validateLegacyOfferSnapshot } from "./migration-offers";
import type { LegacyMigrationSnapshot } from "./migration";

function fixture(): LegacyMigrationSnapshot {
  return {
    ListaDesafios: {
      headers: ["Tipo", "Data_Inicio", "Data_Fim"],
      rows: [
        ["Normal", "01/08/2026", "10/08/2026"],
        ["Repescagem", "11/08/2026", "20/08/2026"],
      ],
    },
  };
}

describe("legacy offer migration preflight", () => {
  it("accepts only rows that can be deterministically normalized", () => {
    expect(validateLegacyOfferSnapshot(fixture())).toEqual({
      ok: true,
      rows: 2,
      issues: [],
    });
  });

  it("reports missing required offer headers without exposing row values", () => {
    const snapshot: LegacyMigrationSnapshot = {
      ListaDesafios: {
        headers: ["Tipo"],
        rows: [["Normal"]],
      },
    };

    const report = validateLegacyOfferSnapshot(snapshot);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "MISSING_OFFER_HEADER",
          field: "DATA_INICIO",
          count: 1,
        },
        {
          code: "MISSING_OFFER_HEADER",
          field: "DATA_FIM",
          count: 1,
        },
      ]),
    );
  });

  it("aggregates unknown categories and invalid windows", () => {
    const snapshot = fixture();
    snapshot.ListaDesafios?.rows.push([
      "categoria privada desconhecida",
      "31/02/2026",
      "10/03/2026",
    ]);

    const report = validateLegacyOfferSnapshot(snapshot);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "UNKNOWN_OFFER_CATEGORY",
          field: "TIPO",
          count: 1,
        },
        {
          code: "INVALID_REGISTRATION_WINDOW",
          field: "DATA_INICIO/DATA_FIM",
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("categoria privada desconhecida");
  });
});
