import { describe, expect, it } from "vitest";
import { validateSportsPeriodManifest } from "./migration-sports-period";

const keys = ["legacy-base-1:2026-08", "legacy-base-2:2026-08"] as const;

describe("sports period migration manifest", () => {
  it("resolves exact sports instants only from explicit manifest entries", () => {
    const result = validateSportsPeriodManifest(keys, [
      {
        legacyChallengeKey: keys[0],
        sportsStartsAt: "2026-08-01T03:00:00.000Z",
        sportsEndsAt: "2026-09-01T02:59:59.999Z",
        sourceNote: "Official challenge communication archived by operator",
      },
      {
        legacyChallengeKey: keys[1],
        sportsStartsAt: "2026-08-02T03:00:00.000Z",
        sportsEndsAt: "2026-08-31T02:59:59.999Z",
        sourceNote: "Official challenge communication archived by operator",
      },
    ]);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.byChallengeKey.get(keys[0])).toEqual(
      expect.objectContaining({
        sportsStartsAt: "2026-08-01T03:00:00.000Z",
        sportsEndsAt: "2026-09-01T02:59:59.999Z",
      }),
    );
  });

  it("blocks missing challenge periods instead of deriving calendar-month boundaries", () => {
    const result = validateSportsPeriodManifest(keys, [
      {
        legacyChallengeKey: keys[0],
        sportsStartsAt: "2026-08-01T03:00:00.000Z",
        sportsEndsAt: "2026-09-01T02:59:59.999Z",
        sourceNote: "Official challenge communication archived by operator",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      code: "MISSING_SPORTS_PERIOD",
      legacyChallengeKey: keys[1],
      count: 1,
    });
  });

  it("rejects duplicate entries for the same challenge edition", () => {
    const duplicate = {
      legacyChallengeKey: keys[0],
      sportsStartsAt: "2026-08-01T03:00:00.000Z",
      sportsEndsAt: "2026-09-01T02:59:59.999Z",
      sourceNote: "Official source",
    };
    const result = validateSportsPeriodManifest([keys[0]], [duplicate, duplicate]);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      code: "DUPLICATE_SPORTS_PERIOD",
      legacyChallengeKey: keys[0],
      count: 2,
    });
  });

  it("rejects invalid or reversed sports ranges", () => {
    const result = validateSportsPeriodManifest([keys[0]], [
      {
        legacyChallengeKey: keys[0],
        sportsStartsAt: "2026-09-01T03:00:00.000Z",
        sportsEndsAt: "2026-08-01T03:00:00.000Z",
        sourceNote: "Official source",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      code: "INVALID_SPORTS_RANGE",
      legacyChallengeKey: keys[0],
      count: 1,
    });
  });

  it("requires a traceable source note for every manually supplied period", () => {
    const result = validateSportsPeriodManifest([keys[0]], [
      {
        legacyChallengeKey: keys[0],
        sportsStartsAt: "2026-08-01T03:00:00.000Z",
        sportsEndsAt: "2026-09-01T02:59:59.999Z",
        sourceNote: "",
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      code: "MISSING_SPORTS_SOURCE_NOTE",
      legacyChallengeKey: keys[0],
      count: 1,
    });
  });
});
