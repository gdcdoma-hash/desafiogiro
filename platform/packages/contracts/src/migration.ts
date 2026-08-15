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
  | "DUPLICATE_REGISTRATION_ID"
  | "ORPHAN_REGISTRATION_PARTICIPANT"
  | "ORPHAN_REGISTRATION_CHALLENGE"
  | "ORPHAN_CHALLENGE_BASE"
  | "ORPHAN_INVENTORY_CHALLENGE";

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

export const legacyMigrationContracts: Record<LegacySheetName, SheetContract> =
  {
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
        {
          field: "ID_DESAFIO_LISTA",
          aliases: ["id_desafio_lista", "ID_Desafio_Lista", "id_Desafio_lista"],
        },
        {
          field: "DISTANCIA_KM",
          aliases: ["distancia_km", "Distancia_KM", "DISTANCIA_KM"],
        },
        {
          field: "QUANTIDADE",
          aliases: ["quantidade", "Quantidade", "QUANTIDADE"],
        },
        { field: "STATUS", aliases: ["status", "Status", "STATUS"] },
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
  return (
    aliases
      .map(normalizeLegacyHeader)
      .map((alias) => normalized.indexOf(alias))
      .find((index) => index >= 0) ?? -1
  );
}

function requiredField(
  sheetName: LegacySheetName,
  field: string,
): RequiredField | undefined {
  return legacyMigrationContracts[sheetName].required.find(
    (required) => required.field === field,
  );
}

function fieldIndex(
  sheetName: LegacySheetName,
  sheet: LegacySheetSnapshot,
  field: string,
): number {
  const required = requiredField(sheetName, field);
  return required ? findHeaderIndex(sheet.headers, required.aliases) : -1;
}

function normalizedValues(
  sheetName: LegacySheetName,
  sheet: LegacySheetSnapshot,
  field: string,
): string[] | null {
  const index = fieldIndex(sheetName, sheet, field);
  if (index < 0) return null;
  return sheet.rows.map((row) => (row[index] ?? "").trim().toLowerCase());
}

function nonEmptyValueSet(
  sheetName: LegacySheetName,
  sheet: LegacySheetSnapshot,
  field: string,
): Set<string> | null {
  const values = normalizedValues(sheetName, sheet, field);
  return values ? new Set(values.filter(Boolean)) : null;
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

function registrationIdIssues(sheet: LegacySheetSnapshot): MigrationIssue[] {
  const values = normalizedValues("dgmbDesafios", sheet, "ID_INSCRICAO");
  if (!values) return [];

  let missing = 0;
  let duplicates = 0;
  const seen = new Set<string>();

  for (const value of values) {
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

function countOrphans(
  values: string[] | null,
  targets: Set<string> | null,
): number {
  if (!values || !targets) return 0;
  return values.filter((value) => value && !targets.has(value)).length;
}

function reconciliationIssues(
  snapshot: LegacyMigrationSnapshot,
): MigrationIssue[] {
  const participants = snapshot.DadosPessoais;
  const challengeList = snapshot.ListaDesafios;
  const registrations = snapshot.dgmbDesafios;
  const inventory = snapshot.DesafioKMEstoque;
  const challengeBases = snapshot.DesafiosBase;
  const issues: MigrationIssue[] = [];

  const participantIds = participants
    ? nonEmptyValueSet("DadosPessoais", participants, "ID_DGMB")
    : null;
  const challengeListIds = challengeList
    ? nonEmptyValueSet("ListaDesafios", challengeList, "ID_DESAFIO_LISTA")
    : null;
  const challengeBaseIds = challengeBases
    ? nonEmptyValueSet("DesafiosBase", challengeBases, "ID_DESAFIO_BASE")
    : null;

  if (registrations) {
    const orphanParticipants = countOrphans(
      normalizedValues("dgmbDesafios", registrations, "ID_DGMB"),
      participantIds,
    );
    if (orphanParticipants > 0) {
      issues.push({
        code: "ORPHAN_REGISTRATION_PARTICIPANT",
        sheet: "dgmbDesafios",
        field: "ID_DGMB",
        count: orphanParticipants,
      });
    }

    const orphanChallenges = countOrphans(
      normalizedValues("dgmbDesafios", registrations, "ID_DESAFIO_LISTA"),
      challengeListIds,
    );
    if (orphanChallenges > 0) {
      issues.push({
        code: "ORPHAN_REGISTRATION_CHALLENGE",
        sheet: "dgmbDesafios",
        field: "ID_DESAFIO_LISTA",
        count: orphanChallenges,
      });
    }
  }

  if (challengeList) {
    const orphanBases = countOrphans(
      normalizedValues("ListaDesafios", challengeList, "ID_DESAFIO_BASE"),
      challengeBaseIds,
    );
    if (orphanBases > 0) {
      issues.push({
        code: "ORPHAN_CHALLENGE_BASE",
        sheet: "ListaDesafios",
        field: "ID_DESAFIO_BASE",
        count: orphanBases,
      });
    }
  }

  if (inventory) {
    const orphanInventoryChallenges = countOrphans(
      normalizedValues("DesafioKMEstoque", inventory, "ID_DESAFIO_LISTA"),
      challengeListIds,
    );
    if (orphanInventoryChallenges > 0) {
      issues.push({
        code: "ORPHAN_INVENTORY_CHALLENGE",
        sheet: "DesafioKMEstoque",
        field: "ID_DESAFIO_LISTA",
        count: orphanInventoryChallenges,
      });
    }
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
  issues.push(...reconciliationIssues(snapshot));

  return {
    ok: issues.length === 0,
    sheetsPresent,
    rowsBySheet,
    issues,
  };
}
