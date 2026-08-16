import { describe, expect, it } from "vitest";
import type { LegacyMigrationSnapshot } from "./migration";
import { transformLegacySnapshotToStagingDtosWithSportsPeriods } from "./migration-dto-sports";

function fixture(): LegacyMigrationSnapshot {
  return {
    DadosPessoais: {
      headers: ["ID_DGMB", "Nome", "Cidade", "UF"],
      rows: [["legacy-user-1", "PESSOA TESTE", "Cidade Teste", "ma"]],
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

describe("sports period staging integration", () => {
  it("resolves the final sports destination fields from a valid manifest", () => {
    const result = transformLegacySnapshotToStagingDtosWithSportsPeriods(
      fixture(),
      [
        {
          legacyChallengeKey: "legacy-base-1:2026-08",
          sportsStartsAt: "2026-08-01T03:00:00.000Z",
          sportsEndsAt: "2026-09-01T02:59:59.999Z",
          sourceNote: "Official challenge calendar archived by operator",
        },
      ],
    );

    expect(result.ready).toBe(true);
    expect(result.writeMode).toBe("NONE");
    expect(result.insertReady).toBe(false);
    expect(result.unresolvedDestinationFields).toEqual([]);
    expect(result.sportsPeriodIssues).toEqual([]);
    expect(result.challenges).toEqual([
      expect.objectContaining({
        legacyChallengeKey: "legacy-base-1:2026-08",
        sportsStartsAt: "2026-08-01T03:00:00.000Z",
        sportsEndsAt: "2026-09-01T02:59:59.999Z",
        sportsSourceNote: "Official challenge calendar archived by operator",
      }),
    ]);
  });

  it("blocks every staged row when the sports manifest is incomplete", () => {
    const result = transformLegacySnapshotToStagingDtosWithSportsPeriods(
      fixture(),
      [],
    );

    expect(result.ready).toBe(false);
    expect(result.writeMode).toBe("NONE");
    expect(result.insertReady).toBe(false);
    expect(result.unresolvedDestinationFields).toEqual([
      "public.challenges.sports_starts_at",
      "public.challenges.sports_ends_at",
    ]);
    expect(result.sportsPeriodIssues).toContainEqual({
      code: "MISSING_SPORTS_PERIOD",
      legacyChallengeKey: "legacy-base-1:2026-08",
      count: 1,
    });
    expect(result.challenges).toEqual([]);
    expect(result.challengeOffers).toEqual([]);
    expect(result.pricingLots).toEqual([]);
    expect(result.participants).toEqual([]);
    expect(result.registrations).toEqual([]);
    expect(result.payments).toEqual([]);
    expect(result.inventory).toEqual([]);
  });

  it("preserves earlier preflight failures before evaluating sports periods", () => {
    const invalid = fixture();
    invalid.dgmbDesafios?.rows.push([
      "missing-user",
      "legacy-registration-2",
      "legacy-list-1",
      "300",
      "Pago",
      "legacy-batch-2",
      "Lote Teste",
      "44,90",
    ]);

    const result = transformLegacySnapshotToStagingDtosWithSportsPeriods(
      invalid,
      [],
    );

    expect(result.ready).toBe(false);
    expect(result.sportsPeriodIssues).toEqual([]);
    expect(result.structuralIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ORPHAN_REGISTRATION_PARTICIPANT" }),
      ]),
    );
  });
});
