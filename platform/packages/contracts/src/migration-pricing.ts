import {
  normalizeLegacyHeader,
  type LegacyMigrationSnapshot,
  type LegacySheetSnapshot,
} from "./migration";

export type LegacyPricingIssueCode =
  | "MISSING_PRICING_SHEET"
  | "MISSING_PRICING_HEADER"
  | "INVALID_PRICING_PERIOD_REFERENCE"
  | "INVALID_PRICING_STATUS"
  | "INVALID_PRICING_WINDOW"
  | "INVALID_PRICING_MODE"
  | "INVALID_PRICING_QUANTITY"
  | "INVALID_PRICING_VALUE";

export type LegacyPricingIssue = {
  code: LegacyPricingIssueCode;
  field: string;
  count: number;
};

export type LegacyPricingValidation = {
  ok: boolean;
  issues: LegacyPricingIssue[];
};

export type LegacyPricingLotNormalized = {
  periodCode: string;
  monthlyPrefix: string;
  externalReference: string;
  internalName: string;
  startsAt: string;
  endsAt: string | null;
  selectionMode: "ANY" | "REGISTRATION_COUNT";
  registrationCount: number | null;
  unitPrice: number;
  totalPrice: number | null;
  status: "ACTIVE" | "INACTIVE";
};

const requiredHeaders = [
  ["status", ["status"]],
  ["data_inicio_sistema", ["data_inicio_sistema", "data inicio sistema"]],
  ["valor_unitario", ["valor_unitario", "valor unitario"]],
  ["id_lote", ["id_lote", "id lote"]],
  ["nome_lote", ["nome_lote", "nome lote"]],
] as const;

function fieldIndex(sheet: LegacySheetSnapshot, aliases: readonly string[]): number {
  const headers = sheet.headers.map(normalizeLegacyHeader);
  return (
    aliases
      .map(normalizeLegacyHeader)
      .map((alias) => headers.indexOf(alias))
      .find((index) => index >= 0) ?? -1
  );
}

function value(
  sheet: LegacySheetSnapshot,
  row: readonly string[],
  aliases: readonly string[],
): string {
  const index = fieldIndex(sheet, aliases);
  return index >= 0 ? (row[index] ?? "").trim() : "";
}

function parseDecimal(input: string): number {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function parseDateParts(input: string): { year: number; month: number; day: number } {
  const text = input.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!br && !iso) throw new Error("unsupported date");

  const year = Number(br ? br[3] : iso![1]);
  const month = Number(br ? br[2] : iso![2]);
  const day = Number(br ? br[1] : iso![3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 2020 ||
    year > 2200 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("invalid date");
  }
  return { year, month, day };
}

function startOfFortalezaDay(input: string): string {
  const date = parseDateParts(input);
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 3)).toISOString();
}

function endOfFortalezaDay(input: string): string {
  const date = parseDateParts(input);
  return new Date(
    Date.UTC(date.year, date.month - 1, date.day + 1, 2, 59, 59, 999),
  ).toISOString();
}

export function normalizeLegacyPricingPeriodReference(idLote: string): {
  periodCode: string;
  monthlyPrefix: string;
} {
  const match = /^([A-Z]{3})(\d{2})_/i.exec(idLote.trim());
  if (!match) throw new Error("missing monthly prefix");

  const months: Record<string, number> = {
    JAN: 1,
    FEV: 2,
    MAR: 3,
    ABR: 4,
    MAI: 5,
    JUN: 6,
    JUL: 7,
    AGO: 8,
    SET: 9,
    OUT: 10,
    NOV: 11,
    DEZ: 12,
  };
  const monthToken = match[1].toUpperCase();
  const month = months[monthToken];
  if (!month) throw new Error("unknown month prefix");

  const year = 2000 + Number(match[2]);
  return {
    periodCode: `${year}-${String(month).padStart(2, "0")}`,
    monthlyPrefix: `${monthToken}${match[2]}`,
  };
}

export function normalizeLegacyPricingLot(
  sheet: LegacySheetSnapshot,
  row: readonly string[],
): LegacyPricingLotNormalized {
  const idLote = value(sheet, row, ["id_lote", "id lote"]);
  const period = normalizeLegacyPricingPeriodReference(idLote);
  const statusToken = value(sheet, row, ["status"]).toUpperCase();
  const status =
    statusToken === "ATIVO"
      ? "ACTIVE"
      : statusToken === "INATIVO"
        ? "INACTIVE"
        : null;
  if (!status) throw new Error("invalid status");

  const startsAt = startOfFortalezaDay(
    value(sheet, row, ["data_inicio_sistema", "data inicio sistema"]),
  );
  const endRaw = value(sheet, row, ["data_fim_sistema", "data fim sistema"]);
  const endsAt = endRaw ? endOfFortalezaDay(endRaw) : null;
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error("invalid pricing window");
  }

  const modeToken = value(sheet, row, ["modo_pix", "modo pix"]).toUpperCase();
  const selectionMode =
    modeToken === "POR_QTD"
      ? "REGISTRATION_COUNT"
      : modeToken === "POR_LOTE" || modeToken === ""
        ? "ANY"
        : null;
  if (!selectionMode) throw new Error("invalid pricing mode");

  const quantityRaw = value(sheet, row, [
    "qtd_inscricoes",
    "quantidade_inscricoes",
    "qtd inscrições",
  ]);
  const registrationCount = selectionMode === "REGISTRATION_COUNT" ? Number(quantityRaw) : null;
  if (
    selectionMode === "REGISTRATION_COUNT" &&
    (!Number.isInteger(registrationCount) || (registrationCount ?? 0) <= 0)
  ) {
    throw new Error("invalid pricing quantity");
  }

  const unitPrice = parseDecimal(
    value(sheet, row, ["valor_unitario", "valor unitario"]),
  );
  const totalRaw = value(sheet, row, ["valor_total", "valor total"]);
  const totalPrice = totalRaw ? parseDecimal(totalRaw) : null;
  if (
    !Number.isFinite(unitPrice) ||
    unitPrice < 0 ||
    (totalPrice !== null && (!Number.isFinite(totalPrice) || totalPrice < 0))
  ) {
    throw new Error("invalid pricing value");
  }

  return {
    ...period,
    externalReference: idLote,
    internalName: value(sheet, row, ["nome_lote", "nome lote"]),
    startsAt,
    endsAt,
    selectionMode,
    registrationCount,
    unitPrice,
    totalPrice,
    status,
  };
}

export function validateLegacyPricingSnapshot(
  snapshot: LegacyMigrationSnapshot,
): LegacyPricingValidation {
  const sheet = snapshot.PixLotes;
  if (!sheet) {
    return {
      ok: false,
      issues: [{ code: "MISSING_PRICING_SHEET", field: "PixLotes", count: 1 }],
    };
  }

  const issues: LegacyPricingIssue[] = [];
  for (const [field, aliases] of requiredHeaders) {
    if (fieldIndex(sheet, aliases) < 0) {
      issues.push({ code: "MISSING_PRICING_HEADER", field, count: 1 });
    }
  }
  if (issues.length) return { ok: false, issues };

  const counts = new Map<LegacyPricingIssueCode, number>();
  for (const row of sheet.rows) {
    try {
      normalizeLegacyPricingPeriodReference(value(sheet, row, ["id_lote", "id lote"]));
    } catch {
      counts.set(
        "INVALID_PRICING_PERIOD_REFERENCE",
        (counts.get("INVALID_PRICING_PERIOD_REFERENCE") ?? 0) + 1,
      );
      continue;
    }

    try {
      normalizeLegacyPricingLot(sheet, row);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code: LegacyPricingIssueCode = message.includes("status")
        ? "INVALID_PRICING_STATUS"
        : message.includes("window") || message.includes("date")
          ? "INVALID_PRICING_WINDOW"
          : message.includes("mode")
            ? "INVALID_PRICING_MODE"
            : message.includes("quantity")
              ? "INVALID_PRICING_QUANTITY"
              : "INVALID_PRICING_VALUE";
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  for (const [code, count] of counts) {
    issues.push({ code, field: "PixLotes", count });
  }
  return { ok: issues.length === 0, issues };
}
