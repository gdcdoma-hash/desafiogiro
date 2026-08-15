import { describe, expect, it } from "vitest";
import { buildLegacyMigrationDryRunPlan } from "./migration-plan";
import type { LegacyMigrationSnapshot } from "./migration";

function validFixture(): LegacyMigrationSnapshot {
  return {
    DadosPessoais: {
      headers: ["ID_DGMB", "Nome", "Cidade", "UF"],
      rows: [
        ["private-user-1", "PESSOA TESTE UM", "Cidade A", "MA"],
        ["private-user-2", "PESSOA TESTE DOIS", "Cidade B", "PA"],
      ],
    },
    ListaDesafios: {
      headers: ["id_Desafio_lista", "id_desafio_base", "Nome_Desafio"],
      rows: [["private-list-1", "private-base-1", "Desafio Fictício"]],
    },
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
          "private-user-1",
          "private-registration-1",
          "private-list-1",
          "Pendente",
          "private-batch-1",
          "Lote fictício",
          "40,00",
          "PIX-PRIVADO-1",
          "2099-01-01",
        ],
        [
          "private-user-2",
          "private-registration-2",
          "private-list-1",
          "Pago",
          "private-batch-1",
          "Lote fictício",
          "40,00",
          "PIX-PRIVADO-2",
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
      rows: [["private-stock-1", "private-list-1", "300", "10", "Ativo"]],
    },
    DesafiosBase: {
      headers: ["id_desafio_base", "nome_exibicao"],
      rows: [["private-base-1", "Desafio Fictício"]],
    },
  };
}

describe("migration dry-run plan", () => {
  it("builds the five-domain plan in dependency order without write capability", () => {
    const plan = buildLegacyMigrationDryRunPlan(validFixture());

    expect(plan.ready).toBe(true);
    expect(plan.writeMode).toBe("NONE");
    expect(plan.structuralIssues).toEqual([]);
    expect(plan.paymentIssues).toEqual([]);
    expect(plan.steps.map(({ order, domain }) => ({ order, domain }))).toEqual([
      { order: 1, domain: "CHALLENGES" },
      { order: 2, domain: "PARTICIPANTS" },
      { order: 3, domain: "REGISTRATIONS" },
      { order: 4, domain: "PAYMENTS" },
      { order: 5, domain: "INVENTORY" },
    ]);

    expect(plan.steps[2]).toEqual(
      expect.objectContaining({
        domain: "REGISTRATIONS",
        candidateRows: 2,
        idempotencyKeys: ["ID_INSCRICAO"],
        dependsOn: ["CHALLENGES", "PARTICIPANTS"],
      }),
    );
    expect(plan.steps[3]).toEqual(
      expect.objectContaining({
        domain: "PAYMENTS",
        candidateRows: 2,
        idempotencyKeys: ["ID_INSCRICAO", "ID_LOTE_PAGAMENTO"],
        dependsOn: ["REGISTRATIONS"],
      }),
    );
    expect(plan.steps[4]).toEqual(
      expect.objectContaining({
        domain: "INVENTORY",
        candidateRows: 1,
        destinationTables: [
          "public.inventory_items",
          "public.inventory_movements",
          "public.inventory_reservations",
        ],
        idempotencyKeys: ["ID_ITEM_ESTOQUE"],
        dependsOn: ["CHALLENGES", "REGISTRATIONS"],
      }),
    );
  });

  it("contains no source row values or sensitive PIX data", () => {
    const plan = buildLegacyMigrationDryRunPlan(validFixture());
    const serialized = JSON.stringify(plan);

    expect(serialized).not.toContain("private-user-1");
    expect(serialized).not.toContain("private-registration-1");
    expect(serialized).not.toContain("private-batch-1");
    expect(serialized).not.toContain("PIX-PRIVADO");
    expect(serialized).not.toContain("PESSOA TESTE");
  });

  it("stays read-only and not ready when structural reconciliation fails", () => {
    const fixture = validFixture();
    fixture.dgmbDesafios?.rows.push([
      "orphan-user-value",
      "private-registration-3",
      "private-list-1",
      "Pendente",
      "private-batch-1",
      "Lote fictício",
      "40,00",
      "",
      "",
    ]);

    const plan = buildLegacyMigrationDryRunPlan(fixture);

    expect(plan.writeMode).toBe("NONE");
    expect(plan.ready).toBe(false);
    expect(plan.structuralIssues).toEqual(
      expect.arrayContaining([
        {
          code: "ORPHAN_REGISTRATION_PARTICIPANT",
          sheet: "dgmbDesafios",
          field: "ID_DGMB",
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(plan)).not.toContain("orphan-user-value");
  });

  it("stays read-only and not ready when payment metadata is ambiguous", () => {
    const fixture = validFixture();
    if (fixture.dgmbDesafios) {
      const statusIndex =
        fixture.dgmbDesafios.headers.indexOf("Status_Pagamento");
      fixture.dgmbDesafios.rows[0][statusIndex] =
        "estado financeiro desconhecido";
    }

    const plan = buildLegacyMigrationDryRunPlan(fixture);

    expect(plan.writeMode).toBe("NONE");
    expect(plan.ready).toBe(false);
    expect(plan.paymentIssues).toEqual(
      expect.arrayContaining([
        {
          code: "UNKNOWN_PAYMENT_STATUS",
          field: "STATUS_PAGAMENTO",
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(plan)).not.toContain(
      "estado financeiro desconhecido",
    );
  });

  it("stays blocked when an exempt legacy registration has no target mapping", () => {
    const fixture = validFixture();
    fixture.DadosPessoais?.rows.push([
      "private-exempt-user",
      "PESSOA ISENTA TESTE",
      "Cidade C",
      "MA",
    ]);
    fixture.dgmbDesafios?.rows.push([
      "private-exempt-user",
      "private-exempt-registration",
      "private-list-1",
      "Isento",
      "private-batch-2",
      "Cortesia fictícia",
      "0",
      "",
      "",
    ]);

    const plan = buildLegacyMigrationDryRunPlan(fixture);

    expect(plan.writeMode).toBe("NONE");
    expect(plan.ready).toBe(false);
    expect(plan.paymentIssues).toEqual(
      expect.arrayContaining([
        {
          code: "EXEMPT_PAYMENT_REQUIRES_MAPPING",
          field: "STATUS_PAGAMENTO",
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(plan)).not.toContain("private-exempt-user");
    expect(JSON.stringify(plan)).not.toContain("PESSOA ISENTA TESTE");
  });
});
