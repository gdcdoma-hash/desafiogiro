import { describe, expect, it } from "vitest";
import { transformLegacySnapshotToStagingDtos } from "./migration-dto";
import type { LegacyMigrationSnapshot } from "./migration";

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
        "Data_Inicio",
        "Data_Fim",
      ],
      rows: [
        [
          "legacy-list-1",
          "legacy-base-1",
          "Oferta Teste",
          "Normal",
          "01/08/2026",
          "10/08/2026",
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
        "chave_pix_lote",
        "validade_pix_lote",
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
          "PIX-NAO-DEVE-SAIR",
          "2099-01-01",
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

describe("legacy migration staging DTOs", () => {
  it("normalizes fictitious source rows without making them insert-ready", () => {
    const result = transformLegacySnapshotToStagingDtos(fixture());

    expect(result.ready).toBe(true);
    expect(result.writeMode).toBe("NONE");
    expect(result.insertReady).toBe(false);
    expect(result.structuralIssues).toEqual([]);
    expect(result.paymentIssues).toEqual([]);
    expect(result.offerIssues).toEqual([]);
    expect(result.goalIssues).toEqual([]);

    expect(result.challenges).toEqual([
      {
        legacyIdDesafioBase: "legacy-base-1",
        publicName: "Desafio Teste",
      },
    ]);
    expect(result.challengeGoals).toEqual([
      { legacyChallengeBaseId: "legacy-base-1", targetKm: 300 },
    ]);
    expect(result.challengeOffers).toEqual([
      {
        legacyIdDesafioLista: "legacy-list-1",
        legacyChallengeBaseId: "legacy-base-1",
        publicName: "Oferta Teste",
        categoryCode: "NORMAL",
        registrationStartsAt: "2026-08-01T03:00:00.000Z",
        registrationEndsAt: "2026-08-11T02:59:59.999Z",
      },
    ]);
    expect(result.challengeOfferGoals).toEqual([
      {
        legacyChallengeOfferId: "legacy-list-1",
        legacyChallengeBaseId: "legacy-base-1",
        targetKm: 300,
      },
    ]);
    expect(result.participants).toEqual([
      {
        legacyIdDgmb: "legacy-user-1",
        fullName: "PESSOA TESTE",
        city: "Cidade Teste",
        stateCode: "MA",
      },
    ]);
    expect(result.registrations[0]).toEqual({
      legacyIdInscricao: "legacy-registration-1",
      legacyParticipantId: "legacy-user-1",
      legacyChallengeOfferId: "legacy-list-1",
      targetKm: 300,
      occurrenceNumber: 1,
    });
    expect(result.payments[0]).toEqual({
      legacyRegistrationId: "legacy-registration-1",
      legacyBatchId: "legacy-batch-1",
      batchName: "Lote Teste",
      externalReference: "dgmb-payment:v1:legacy-registration-1:legacy-batch-1",
      amount: 44.9,
      category: "SETTLED",
    });
    expect(result.inventory[0]).toEqual({
      legacyIdItemEstoque: "legacy-stock-1",
      legacyChallengeOfferId: "legacy-list-1",
      targetKm: 300,
      quantity: 5,
      legacyStatus: "Ativo",
    });
  });

  it("reduces unresolved destination requirements to five fields", () => {
    const result = transformLegacySnapshotToStagingDtos(fixture());

    expect(result.unresolvedDestinationFields).toEqual([
      "public.challenges.reference_year",
      "public.challenges.sports_starts_at",
      "public.challenges.sports_ends_at",
      "public.challenge_offers.price",
      "public.registration_payments.method_code",
    ]);
  });

  it("deduplicates goals and derives repeated occurrence ordinals in source order", () => {
    const snapshot = fixture();
    snapshot.dgmbDesafios?.rows.push([
      "legacy-user-1",
      "legacy-registration-2",
      "legacy-list-1",
      "300",
      "Pago",
      "legacy-batch-2",
      "Lote Teste",
      "44,90",
      "",
      "",
    ]);

    const result = transformLegacySnapshotToStagingDtos(snapshot);
    expect(result.challengeGoals).toHaveLength(1);
    expect(result.challengeOfferGoals).toHaveLength(1);
    expect(result.registrations.map((item) => item.occurrenceNumber)).toEqual([
      1, 2,
    ]);
  });

  it("never carries temporary PIX secrets into staging DTOs", () => {
    const serialized = JSON.stringify(
      transformLegacySnapshotToStagingDtos(fixture()),
    );

    expect(serialized).not.toContain("PIX-NAO-DEVE-SAIR");
    expect(serialized).not.toContain("validade_pix_lote");
    expect(serialized).not.toContain("chave_pix_lote");
  });

  it("returns no DTO rows when structural preflight blocks the snapshot", () => {
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
      "",
      "",
    ]);

    const result = transformLegacySnapshotToStagingDtos(invalid);

    expect(result.ready).toBe(false);
    expect(result.writeMode).toBe("NONE");
    expect(result.challenges).toEqual([]);
    expect(result.challengeGoals).toEqual([]);
    expect(result.challengeOfferGoals).toEqual([]);
    expect(result.participants).toEqual([]);
    expect(result.registrations).toEqual([]);
    expect(result.payments).toEqual([]);
    expect(result.inventory).toEqual([]);
    expect(result.structuralIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "ORPHAN_REGISTRATION_PARTICIPANT" }),
      ]),
    );
  });

  it("returns no DTO rows when offer category or window is invalid", () => {
    const invalid = fixture();
    if (invalid.ListaDesafios) {
      invalid.ListaDesafios.rows[0][3] = "tipo desconhecido";
      invalid.ListaDesafios.rows[0][4] = "31/02/2026";
    }

    const result = transformLegacySnapshotToStagingDtos(invalid);

    expect(result.ready).toBe(false);
    expect(result.challengeOffers).toEqual([]);
    expect(result.offerIssues).toEqual(
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
  });

  it("returns no DTO rows when a registration target is invalid", () => {
    const invalid = fixture();
    if (invalid.dgmbDesafios) invalid.dgmbDesafios.rows[0][3] = "0";

    const result = transformLegacySnapshotToStagingDtos(invalid);
    expect(result.ready).toBe(false);
    expect(result.registrations).toEqual([]);
    expect(result.goalIssues).toEqual([
      {
        code: "INVALID_REGISTRATION_TARGET_KM",
        field: "Meta_KM",
        count: 1,
      },
    ]);
  });
});
