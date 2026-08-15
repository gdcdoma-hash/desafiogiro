export type LegacyChallengePeriod = {
  periodCode: string;
  referenceYear: number;
  referenceMonth: number;
};

const monthByName: Record<string, number> = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

function buildPeriod(year: number, month: number): LegacyChallengePeriod {
  if (!Number.isInteger(year) || year < 2020 || year > 2200) {
    throw new Error("Invalid legacy challenge period");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid legacy challenge period");
  }

  return {
    periodCode: `${year}-${String(month).padStart(2, "0")}`,
    referenceYear: year,
    referenceMonth: month,
  };
}

export function normalizeLegacyChallengePeriod(
  raw: string,
): LegacyChallengePeriod {
  const text = raw.trim();
  if (!text) throw new Error("Invalid legacy challenge period");

  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const yearMatch = normalized.match(/(?:^|\D)((?:20)\d{2})(?:\D|$)/);
  const namedMonth = Object.entries(monthByName).find(([name]) =>
    normalized.includes(name),
  );
  if (yearMatch?.[1] && namedMonth) {
    return buildPeriod(Number(yearMatch[1]), namedMonth[1]);
  }

  const numbers = text.match(/\d+/g) ?? [];
  const first = numbers[0];
  const second = numbers[1];
  const third = numbers[2];
  if (first && second) {
    if (first.length === 4) {
      return buildPeriod(Number(first), Number(second));
    }
    if (third && third.length === 4) {
      return buildPeriod(Number(third), Number(second));
    }
    if (second.length === 4) {
      return buildPeriod(Number(second), Number(first));
    }
  }

  throw new Error("Invalid legacy challenge period");
}

export function buildLegacyChallengeInstanceKey(
  legacyChallengeBaseId: string,
  periodCode: string,
): string {
  const baseId = legacyChallengeBaseId.trim();
  const period = periodCode.trim();
  if (!baseId || !/^\d{4}-\d{2}$/.test(period)) {
    throw new Error("Invalid legacy challenge instance key");
  }
  return `${baseId}:${period}`;
}
