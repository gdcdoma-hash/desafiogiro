import { describe, expect, it } from "vitest";
import type { LegacyMigrationSnapshot } from "./migration";
import { buildLegacyMigrationReadinessReport } from "./migration-readiness-report";

function fixture(): LegacyMigrationSnapshot {
  return {
    DadosPessoais: {
      headers: ["ID_DGMB", "Nome", "Cidade", "UF"],
      rows: [["legacy-user-1", "PESSOA TESTE", "Cidade Teste", "MA"]],
    },
    DesafiosBase: {
      headers: ["id_desafio_base", "nome_exibicao"],
      rows: [["legacy-base-1", "Desafio Teste"]],
    },
    ListaDesafios: {
      headers: [
        "id_Desafio_lista",
        "id_desafio_base",
        "Nome_Desafio",
        "Tipo",
        "Periodo",
        "Data_Inicio",
        "Data_Fim",
      ],
      rows: [
        [
          "legacy-list-1",
          "legacy-base-1",
          "Oferta Teste",
          "Normal",
          "08/2026",
          "01/08/2026",
          "10/08/2026",
        ],
      ],
    },
    PixLotes: {
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
      ],
      rows: [
        [
          "Ativo",
          "01/08/2026",
          "31/08/2026",
          "POR_QTD",
          "1",
          "44,90",
          "44,90",
          "AGO26_QTD_1",
          "Lote Agosto",
        ],
      ],
    },
    dgmbDesafios: {
      headers: [
        "ID_DGMB",
        "ID_Inscricao",
        "ID_Desafio_Lista",
        "Meta_KM",
        "Status_Pagamento",
        "id_lote_pagamento",
        "nome_lote_pagamento",
        "valor_unitario_pagamento",
      ],
      rows: [
        [
          "legacy-user-1",
          "legacy-registration-1",
          "legacy-list-1",
          "300",
          "Pago",
          "legacy-batch-1",
          "Lote Teste",
          "44,90",
        ],
      ],
    },
    DesafioKMEstoque: {
      headers: [
        "id_item_estoque",
        "id_desafio_lista",
        "distancia_km",
        "quantidade",
        "status",
      ],
      rows: [["legacy-stock-1", "legacy-list-1", "300", "5", "Ativo"]],
    },
  };
}

const sportsManifest = [
  {
    legacyChallengeKey: "legacy-base-1:2026-08",
    sportsStartsAt: "2026-08-01T03:00:00.000Z",
    sportsEndsAt: "2026-09-01T02:59:59.999Z",
    sourceNote: "Official challenge calendar archived by operator",
  },
] as const;

describe("consolidated migration readiness report", () => {
  it("reports fully resolved staging while keeping persistence disabled", () => {
    const report = buildLegacyMigrationReadinessReport(
      fixture(),
      sportsManifest,
    );

    expect(report.stagingReady).toBe(true);
    expect(report.persistenceEnabled).toBe(false);
    expect(report.writeMode).toBe("NONE");
    expect(report.unresolvedDestinationFields).toEqual([]);
    expect(report.issueCounts).toEqual({
      structural: 0,
      payments: 0,
      offers: 0,
      goals: 0,
      pricing: 0,
      sportsPeriods: 0,
    });
    expect(
      report.steps.map(({ order, domain }) => ({ order, domain })),
    ).toEqual([
      { order: 1, domain: "CHALLENGES" },
      { order: 2, domain: "PRICING" },
      { order: 3, domain: "PARTICIPANTS" },
      { order: 4, domain: "REGISTRATIONS" },
      { order: 5, domain: "PAYMENTS" },
      { order: 6, domain: "INVENTORY" },
    ]);
    expect(report.steps[1]).toEqual(
      expect.objectContaining({
        domain: "PRICING",
        destinationTables: [
          "public.challenge_pricing_groups",
          "public.challenge_pricing_group_offers",
          "public.challenge_offer_price_lots",
        ],
        stagedRows: 3,
        dependsOn: ["CHALLENGES"],
      }),
    );
    expect(report.totalStagedRows).toBe(11);
  });

  it("reports the sports-period blocker without leaking source values", () => {
    const report = buildLegacyMigrationReadinessReport(fixture(), []);

    expect(report.stagingReady).toBe(false);
    expect(report.persistenceEnabled).toBe(false);
    expect(report.unresolvedDestinationFields).toEqual([
      "public.challenges.sports_starts_at",
      "public.challenges.sports_ends_at",
    ]);
    expect(report.issueCounts.sportsPeriods).toBe(1);
    expect(report.totalStagedRows).toBe(0);
    expect(JSON.stringify(report)).not.toContain("legacy-user-1");
    expect(JSON.stringify(report)).not.toContain("legacy-registration-1");
    expect(JSON.stringify(report)).not.toContain("44,90");
  });

  it("summarizes earlier preflight failures without exposing bad row data", () => {
    const invalid = fixture();
    invalid.dgmbDesafios?.rows.push([
      "missing-user-secret",
      "legacy-registration-2",
      "legacy-list-1",
      "300",
      "Pago",
      "legacy-batch-2",
      "Lote Teste",
      "44,90",
    ]);

    const report = buildLegacyMigrationReadinessReport(invalid, sportsManifest);

    expect(report.stagingReady).toBe(false);
    expect(report.issueCounts.structural).toBeGreaterThan(0);
    expect(report.totalStagedRows).toBe(0);
    expect(JSON.stringify(report)).not.toContain("missing-user-secret");
  });
});
