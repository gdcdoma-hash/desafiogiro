import {
  normalizeLegacyHeader,
  type LegacyMigrationSnapshot,
  type LegacySheetSnapshot,
} from "./migration";

export type LegacyGoalIssueCode =
  "MISSING_GOAL_HEADER" | "INVALID_REGISTRATION_TARGET_KM";

export type LegacyGoalIssue = {
  code: LegacyGoalIssueCode;
  field: string;
  count: number;
};

export type LegacyGoalPreflightReport = {
  ok: boolean;
  rows: number;
  issues: LegacyGoalIssue[];
};

const goalAliases = ["Meta_KM", "meta_km"] as const;

function goalIndex(sheet: LegacySheetSnapshot): number {
  const headers = sheet.headers.map(normalizeLegacyHeader);
  return (
    goalAliases
      .map(normalizeLegacyHeader)
      .map((alias) => headers.indexOf(alias))
      .find((index) => index >= 0) ?? -1
  );
}

export function normalizeLegacyTargetKm(raw: string): number {
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(?:\.0+)?$/.test(normalized)) {
    throw new Error("Invalid legacy registration target km");
  }

  const targetKm = Number(normalized);
  if (!Number.isSafeInteger(targetKm) || targetKm <= 0) {
    throw new Error("Invalid legacy registration target km");
  }
  return targetKm;
}

export function validateLegacyGoalSnapshot(
  snapshot: LegacyMigrationSnapshot,
): LegacyGoalPreflightReport {
  const sheet = snapshot.dgmbDesafios;
  if (!sheet) {
    return {
      ok: false,
      rows: 0,
      issues: [{ code: "MISSING_GOAL_HEADER", field: "Meta_KM", count: 1 }],
    };
  }

  const index = goalIndex(sheet);
  if (index < 0) {
    return {
      ok: false,
      rows: sheet.rows.length,
      issues: [{ code: "MISSING_GOAL_HEADER", field: "Meta_KM", count: 1 }],
    };
  }

  let invalid = 0;
  for (const row of sheet.rows) {
    try {
      normalizeLegacyTargetKm(row[index] ?? "");
    } catch {
      invalid += 1;
    }
  }

  const issues: LegacyGoalIssue[] = invalid
    ? [
        {
          code: "INVALID_REGISTRATION_TARGET_KM",
          field: "Meta_KM",
          count: invalid,
        },
      ]
    : [];

  return { ok: issues.length === 0, rows: sheet.rows.length, issues };
}
