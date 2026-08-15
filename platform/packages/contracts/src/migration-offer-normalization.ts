export type LegacyOfferCategoryCode = "NORMAL" | "REPESCAGEM";

export type LegacyOfferRegistrationWindow = {
  timezone: "America/Fortaleza";
  registrationStartsAt: string;
  registrationEndsAt: string;
};

export type LegacyOfferNormalizationInput = {
  tipo: string;
  dataInicio: string;
  dataFim: string;
};

export type LegacyOfferNormalizationResult = LegacyOfferRegistrationWindow & {
  categoryCode: LegacyOfferCategoryCode;
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function normalizeLegacyOfferCategory(
  value: string,
): LegacyOfferCategoryCode {
  const normalized = normalizeToken(value);
  if (normalized === "NORMAL") return "NORMAL";
  if (normalized === "REPESCAGEM") return "REPESCAGEM";
  throw new Error("Unknown legacy offer category");
}

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseLegacyDate(value: string): DateParts {
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;

  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (br) {
    day = Number(br[1]);
    month = Number(br[2]);
    year = Number(br[3]);
  } else if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    throw new Error("Unsupported legacy registration date format");
  }

  if (year < 2020 || year > 2200) {
    throw new Error("Legacy registration date year is out of range");
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("Invalid legacy registration date");
  }

  return { year, month, day };
}

function startOfFortalezaDay(parts: DateParts): string {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, 3, 0, 0, 0),
  ).toISOString();
}

function endOfFortalezaDay(parts: DateParts): string {
  return new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + 1, 2, 59, 59, 999),
  ).toISOString();
}

export function normalizeLegacyRegistrationWindow(
  dataInicio: string,
  dataFim: string,
): LegacyOfferRegistrationWindow {
  const start = parseLegacyDate(dataInicio);
  const end = parseLegacyDate(dataFim);
  const registrationStartsAt = startOfFortalezaDay(start);
  const registrationEndsAt = endOfFortalezaDay(end);

  if (Date.parse(registrationEndsAt) <= Date.parse(registrationStartsAt)) {
    throw new Error("Legacy registration window must end after it starts");
  }

  return {
    timezone: "America/Fortaleza",
    registrationStartsAt,
    registrationEndsAt,
  };
}

export function normalizeLegacyOfferSource(
  input: LegacyOfferNormalizationInput,
): LegacyOfferNormalizationResult {
  return {
    categoryCode: normalizeLegacyOfferCategory(input.tipo),
    ...normalizeLegacyRegistrationWindow(input.dataInicio, input.dataFim),
  };
}
