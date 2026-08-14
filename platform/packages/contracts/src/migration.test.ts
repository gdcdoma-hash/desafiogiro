import { describe, expect, it } from "vitest";
import {
  normalizeLegacyHeader,
  validateLegacyMigrationSnapshot,
  type LegacyMigrationSnapshot,
} from "./migration";

function validFixture(): LegacyMigrationSnapshot {
  return {
    DadosPessoais: {
      headers: ["ID_DGMB", "Nome", "Cidade", "UF"],
      rows: [
        ["fixture-user-1", "PESSOA TESTE UM", "Cidade A", "MA"],
        ["fixture-user-2", "PESSOA TESTE DOIS", "Cidade B", "PA"],
      ],
    },
    ListaDesafios: {
      headers: ["id_Desafio_lista", "id_desafio_base", "Nome_Desafio"],
      rows: [["fixture-list-1", "fixture-base-1", "Desafio Fictício"]],
    },
    dgmbDesafios: {
      headers: ["ID_DGMB", "ID_Inscricao", "ID_Desafio_Lista"],
      rows: [
        ["fixture-user-1", "fixture-registration-1", "fixture-list-1"],
        ["fixture-user-2", "fixture-registration-2", "fixture-list-1"],
      ],
    },
    DesafioKMEstoque: {
      headers: ["id_item_estoque", "Quantidade"],
      rows: [["fixture-stock-1", "10"]],
    },
    DesafiosBase: {
      headers: ["id_desafio_base", "nome_exibicao"],
      rows: [["fixture-base-1", "Desafio Fictício"]],
    },
  };
}

describe("migration preflight contract", () => {
  it("normalizes historical header formatting without changing semantics", () => {
    expect(normalizeLegacyHeader("ID_Inscrição")).toBe("idinscricao");
    expect(normalizeLegacyHeader("Status Usuário Desafio")).toBe(
      "statususuariodesafio",
    );
  });

  it("accepts a complete fictitious snapshot and reports only aggregates", () => {
    const report = validateLegacyMigrationSnapshot(validFixture());

    expect(report).toEqual({
      ok: true,
      sheetsPresent: 5,
      rowsBySheet: {
        DadosPessoais: 2,
        ListaDesafios: 1,
        dgmbDesafios: 2,
        DesafioKMEstoque: 1,
        DesafiosBase: 1,
      },
      issues: [],
    });
    expect(JSON.stringify(report)).not.toContain("PESSOA TESTE");
    expect(JSON.stringify(report)).not.toContain("fixture-user-1");
  });

  it("rejects missing structures and headers without including row values", () => {
    const fixture = validFixture();
    delete fixture.DesafiosBase;
    fixture.ListaDesafios = {
      headers: ["Nome_Desafio"],
      rows: [["valor que não deve aparecer no relatório"]],
    };

    const report = validateLegacyMigrationSnapshot(fixture);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "MISSING_SHEET",
          sheet: "DesafiosBase",
          count: 1,
        },
        {
          code: "MISSING_HEADER",
          sheet: "ListaDesafios",
          field: "ID_DESAFIO_LISTA",
          count: 1,
        },
        {
          code: "MISSING_HEADER",
          sheet: "ListaDesafios",
          field: "ID_DESAFIO_BASE",
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("valor que não deve aparecer");
  });

  it("counts missing and duplicate registration tracking keys", () => {
    const fixture = validFixture();
    fixture.dgmbDesafios = {
      headers: ["id_dgmb", "id_inscricao", "id_desafio_lista"],
      rows: [
        ["fixture-user-1", "fixture-registration-1", "fixture-list-1"],
        ["fixture-user-2", "", "fixture-list-1"],
        ["fixture-user-3", "FIXTURE-REGISTRATION-1", "fixture-list-1"],
      ],
    };

    const report = validateLegacyMigrationSnapshot(fixture);

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        {
          code: "MISSING_REGISTRATION_ID",
          sheet: "dgmbDesafios",
          field: "ID_INSCRICAO",
          count: 1,
        },
        {
          code: "DUPLICATE_REGISTRATION_ID",
          sheet: "dgmbDesafios",
          field: "ID_INSCRICAO",
          count: 1,
        },
      ]),
    );
  });
});
