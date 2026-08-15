import {
  normalizeLegacyHeader,
  type LegacyMigrationSnapshot,
  type LegacySheetSnapshot,
} from "./migration";
import {
  normalizeLegacyOfferCategory,
  normalizeLegacyRegistrationWindow,
} from "./migration-offer-normalization";
import { normalizeLegacyChallengePeriod } from "./migration-period";

export type LegacyOfferIssueCode =
  | "MISSING_OFFER_HEADER"
  | "UNKNOWN_OFFER_CATEGORY"
  | "INVALID_REGISTRATION_WINDOW"
  | "INVALID_CHALLENGE_PERIOD";

export type LegacyOfferIssue = {
  code: LegacyOfferIssueCode;
  field: string;
  count: number;
};

export type LegacyOfferPreflightReport = {
  ok: boolean;
  rows: number;
  issues: LegacyOfferIssue[];
};

type OfferField = {
  field: string;
  aliases: readonly string[];
};

const offerFields = {
  type: {
    field: "TIPO",
    aliases: ["Tipo", "tipo"],
  },
  period: {
    field: "PERIODO",
    aliases: ["Periodo", "Período", "periodo"],
  },
  registrationStart: {
    field: "DATA_INICIO",
    aliases: ["Data_Inicio", "data_inicio", "Data Inicio"],
  },
  registrationEnd: {
    field: "DATA_FIM",
    aliases: ["Data_Fim", "data_fim", "Data Fim"],
  },
} as const satisfies Record<string, OfferField>;

function findFieldIndex(sheet: LegacySheetSnapshot, field: OfferField): number {
  const normalizedHeaders = sheet.headers.map(normalizeLegacyHeader);
  return (
    field.aliases
      .map(normalizeLegacyHeader)
      .map((alias) => normalizedHeaders.indexOf(alias))
      .find((index) => index >= 0) ?? -1
  );
}

export function validateLegacyOfferSnapshot(
  snapshot: LegacyMigrationSnapshot,
): LegacyOfferPreflightReport {
  const sheet = snapshot.ListaDesafios;
  const issues: LegacyOfferIssue[] = [];

  if (!sheet) {
    return {
      ok: false,
      rows: 0,
      issues: [
        {
          code: "MISSING_OFFER_HEADER",
          field: "ListaDesafios",
          count: 1,
        },
      ],
    };
  }

  const indexes = {
    type: findFieldIndex(sheet, offerFields.type),
    period: findFieldIndex(sheet, offerFields.period),
    registrationStart: findFieldIndex(sheet, offerFields.registrationStart),
    registrationEnd: findFieldIndex(sheet, offerFields.registrationEnd),
  };

  for (const [key, index] of Object.entries(indexes)) {
    if (index >= 0) continue;
    const field = offerFields[key as keyof typeof offerFields];
    issues.push({
      code: "MISSING_OFFER_HEADER",
      field: field.field,
      count: 1,
    });
  }

  if (indexes.type >= 0) {
    let invalidCategories = 0;
    for (const row of sheet.rows) {
      try {
        normalizeLegacyOfferCategory(row[indexes.type] ?? "");
      } catch {
        invalidCategories += 1;
      }
    }
    if (invalidCategories > 0) {
      issues.push({
        code: "UNKNOWN_OFFER_CATEGORY",
        field: offerFields.type.field,
        count: invalidCategories,
      });
    }
  }

  if (indexes.period >= 0) {
    let invalidPeriods = 0;
    for (const row of sheet.rows) {
      try {
        normalizeLegacyChallengePeriod(row[indexes.period] ?? "");
      } catch {
        invalidPeriods += 1;
      }
    }
    if (invalidPeriods > 0) {
      issues.push({
        code: "INVALID_CHALLENGE_PERIOD",
        field: offerFields.period.field,
        count: invalidPeriods,
      });
    }
  }

  if (indexes.registrationStart >= 0 && indexes.registrationEnd >= 0) {
    let invalidWindows = 0;
    for (const row of sheet.rows) {
      try {
        normalizeLegacyRegistrationWindow(
          row[indexes.registrationStart] ?? "",
          row[indexes.registrationEnd] ?? "",
        );
      } catch {
        invalidWindows += 1;
      }
    }
    if (invalidWindows > 0) {
      issues.push({
        code: "INVALID_REGISTRATION_WINDOW",
        field: "DATA_INICIO/DATA_FIM",
        count: invalidWindows,
      });
    }
  }

  return {
    ok: issues.length === 0,
    rows: sheet.rows.length,
    issues,
  };
}
