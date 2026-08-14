export type LegacySheetName =
  | "DadosPessoais"
  | "ListaDesafios"
  | "dgmbDesafios"
  | "DesafioKMEstoque"
  | "DesafiosBase";

export type LegacySheetSnapshot = {
  headers: string[];
  rows: string[][];
};

export type LegacyMigrationSnapshot = Partial<
  Record<LegacySheetName, LegacySheetSnapshot>
>;

export type MigrationIssueCode =
  | "MISSING_SHEET"
  | "MISSING_HEADER"
  | "MISSING_REGISTRATION_ID"
  | "DUPLICATE_REGISTRATION_ID";

export type MigrationIssue = {
  code: MigrationIssueCode;
  sheet: LegacySheetName;
  count: number;
  field?: string;
};

export type MigrationPreflightReport = {
  ok: boolean;
  sheetsPresent: number;
  rowsBySheet: Record<LegacySheetName, number>;
  issues: MigrationIssue[];
};

type RequiredField = {
  field: string;
  aliases: readonly string[];
};

type SheetContract = {
  required: readonly RequiredField[];
};

export const legacyMigrationContracts: Record<LegacySheetName, SheetContract> = {
  DadosPessoais: {
    required: [
      { field: "ID_DGMB", aliases: ["ID_DGMB", "id_dgmb", "idDgmb"] },
    ],
  },
  ListaDesafios: {
    required: [
      {
        field: "ID_DESAFIO_LISTA",
        aliases: ["id_Desafio_lista", "ID_Desafio_Lista", "id_desafio_lista"],
      },
      {
        field: "ID_DESAFIO_BASE",
        aliases: ["id_desafio_base", "ID_Desafio_Base"],
      },
    ],
  },
  dgmbDesafios: {
    required: [
      { field: "ID_DGMB", aliases: ["ID_DGMB", "id_dgmb", "idDgmb"] },
      {
        field: "ID_INSCRICAO",
        aliases: ["ID_INSCRICAO", "ID_Inscricao", "id_inscricao"],
      },
      {
        field: "ID_DESAFIO_LISTA",
        aliases: ["ID_Desafio_Lista", "id_Desafio_lista", "id_desafio_lista"],
      },
    ],
  },
  DesafioKMEstoque: {
    required: [
      {
        field: "ID_ITEM_ESTOQUE",
        aliases: ["id_item_estoque", "ID_Item_Estoque", "ID_ITEM_ESTOQUE"],
      },
    ],
  },
  DesafiosBase: {
    required: [
      {
        field: "ID_DESAFIO_BASE",
        aliases: ["id_desafio_base", "ID_Desafio_Base"],
      },
    ],
  },
};

const sheetNames = Object.keys(legacyMigrationContracts) as LegacySheetName[];

export function normalizeLegacyHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function findHeaderIndex(
  headers: readonly string[],
  aliases: readonly string[],
): number {
  const normalized = headers.map(normalizeLegacyHeader);
  return aliases
    .map(normalizeLegacyHeader)
    .map((alias) => normalized.indexOf(alias))
    .find((index) => index >= 0) ?? -1;
}

function emptyRowCounts(): Record<LegacySheetName, number> {
  return {
    DadosPessoais: 0,
    ListaDesafios: 0,
    dgmbDesafios: 0,
    DesafioKMEstoque: 0,
    DesafiosBase: 0,
  };
}

function registrationIdIssues(
  sheet: LegacySheetSnapshot,
): MigrationIssue[] {
  const idField = legacyMigrationContracts.dgmbDesafios.required.find(
    ({ field }) => field === "ID_INSCRICAO",
  );
  if (!idField) return [];

  const index = findHeaderIndex(sheet.headers, idField.aliases);
  if (index < 0) return [];

  let missing = 0;
  let duplicates = 0;
  const seen = new Set<string>();

  for (const row of sheet.rows) {
    const value = (row[index] ?? "").trim().toLowerCase();
    if (!value) {
      missing += 1;
      continue;
    }
    if (seen.has(value)) {
      duplicates += 1;
    } else {
      seen.add(value);
    }
  }

  const issues: MigrationIssue[] = [];
  if (missing > 0) {
    issues.push({
      code: "MISSING_REGISTRATION_ID",
      sheet: "dgmbDesafios",
      field: "ID_INSCRICAO",
      count: missing,
    });
  }
  if (duplicates > 0) {
    issues.push({
      code: "DUPLICATE_REGISTRATION_ID",
      sheet: "dgmbDesafios",
      field: "ID_INSCRICAO",
      count: duplicates,
    });
  }
  return issues;
}

export function validateLegacyMigrationSnapshot(
  snapshot: LegacyMigrationSnapshot,
): MigrationPreflightReport {
  const rowsBySheet = emptyRowCounts();
  const issues: MigrationIssue[] = [];
  let sheetsPresent = 0;

  for (const sheetName of sheetNames) {
    const sheet = snapshot[sheetName];
    if (!sheet) {
      issues.push({ code: "MISSING_SHEET", sheet: sheetName, count: 1 });
      continue;
    }

    sheetsPresent += 1;
    rowsBySheet[sheetName] = sheet.rows.length;

    for (const required of legacyMigrationContracts[sheetName].required) {
      if (findHeaderIndex(sheet.headers, required.aliases) < 0) {
        issues.push({
          code: "MISSING_HEADER",
          sheet: sheetName,
          field: required.field,
          count: 1,
        });
      }
    }
  }

  const registrations = snapshot.dgmbDesafios;
  if (registrations) issues.push(...registrationIdIssues(registrations));

  return {
    ok: issues.length === 0,
    sheetsPresent,
    rowsBySheet,
    issues,
  };
}
