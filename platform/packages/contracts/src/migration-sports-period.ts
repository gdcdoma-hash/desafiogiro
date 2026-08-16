export type SportsPeriodManifestEntry = {
  legacyChallengeKey: string;
  sportsStartsAt: string;
  sportsEndsAt: string;
  sourceNote: string;
};

export type SportsPeriodManifest = readonly SportsPeriodManifestEntry[];

export type SportsPeriodIssueCode =
  | "MISSING_SPORTS_PERIOD"
  | "DUPLICATE_SPORTS_PERIOD"
  | "INVALID_SPORTS_START"
  | "INVALID_SPORTS_END"
  | "INVALID_SPORTS_RANGE"
  | "MISSING_SPORTS_SOURCE_NOTE";

export type SportsPeriodIssue = {
  code: SportsPeriodIssueCode;
  legacyChallengeKey: string;
  count: number;
};

export type SportsPeriodResolution = {
  ok: boolean;
  issues: SportsPeriodIssue[];
  byChallengeKey: ReadonlyMap<string, SportsPeriodManifestEntry>;
};

function validIsoInstant(value: string): boolean {
  const text = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    return false;
  }
  return Number.isFinite(Date.parse(text));
}

export function validateSportsPeriodManifest(
  expectedChallengeKeys: readonly string[],
  manifest: SportsPeriodManifest,
): SportsPeriodResolution {
  const expected = new Set(expectedChallengeKeys);
  const issues: SportsPeriodIssue[] = [];
  const byChallengeKey = new Map<string, SportsPeriodManifestEntry>();
  const counts = new Map<string, number>();

  for (const entry of manifest) {
    const key = entry.legacyChallengeKey.trim();
    if (!expected.has(key)) continue;

    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (counts.get(key)! > 1) continue;

    if (!validIsoInstant(entry.sportsStartsAt)) {
      issues.push({ code: "INVALID_SPORTS_START", legacyChallengeKey: key, count: 1 });
      continue;
    }
    if (!validIsoInstant(entry.sportsEndsAt)) {
      issues.push({ code: "INVALID_SPORTS_END", legacyChallengeKey: key, count: 1 });
      continue;
    }
    if (Date.parse(entry.sportsEndsAt) <= Date.parse(entry.sportsStartsAt)) {
      issues.push({ code: "INVALID_SPORTS_RANGE", legacyChallengeKey: key, count: 1 });
      continue;
    }
    if (!entry.sourceNote.trim()) {
      issues.push({
        code: "MISSING_SPORTS_SOURCE_NOTE",
        legacyChallengeKey: key,
        count: 1,
      });
      continue;
    }

    byChallengeKey.set(key, {
      legacyChallengeKey: key,
      sportsStartsAt: entry.sportsStartsAt.trim(),
      sportsEndsAt: entry.sportsEndsAt.trim(),
      sourceNote: entry.sourceNote.trim(),
    });
  }

  for (const key of expectedChallengeKeys) {
    const count = counts.get(key) ?? 0;
    if (count === 0) {
      issues.push({ code: "MISSING_SPORTS_PERIOD", legacyChallengeKey: key, count: 1 });
    } else if (count > 1) {
      issues.push({
        code: "DUPLICATE_SPORTS_PERIOD",
        legacyChallengeKey: key,
        count,
      });
      byChallengeKey.delete(key);
    }
  }

  return {
    ok: issues.length === 0 && byChallengeKey.size === expected.size,
    issues,
    byChallengeKey,
  };
}
