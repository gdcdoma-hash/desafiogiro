import { describe, expect, it } from "vitest";
import {
  buildLegacyChallengeInstanceKey,
  normalizeLegacyChallengePeriod,
} from "./migration-period";

describe("legacy challenge period normalization", () => {
  it("normalizes year-month and month-year period labels", () => {
    expect(normalizeLegacyChallengePeriod("2026-08")).toEqual({
      periodCode: "2026-08",
      referenceYear: 2026,
      referenceMonth: 8,
    });
    expect(normalizeLegacyChallengePeriod("08/2026")).toEqual({
      periodCode: "2026-08",
      referenceYear: 2026,
      referenceMonth: 8,
    });
  });

  it("matches the legacy month-name semantics without requiring accents", () => {
    expect(normalizeLegacyChallengePeriod("Agosto de 2026").periodCode).toBe(
      "2026-08",
    );
    expect(normalizeLegacyChallengePeriod("março 2026").periodCode).toBe(
      "2026-03",
    );
  });

  it("accepts a date-like legacy label only for its year and month", () => {
    expect(normalizeLegacyChallengePeriod("01/08/2026").periodCode).toBe(
      "2026-08",
    );
  });

  it("rejects unparseable or invalid periods", () => {
    expect(() => normalizeLegacyChallengePeriod("periodo privado")).toThrow(
      "Invalid legacy challenge period",
    );
    expect(() => normalizeLegacyChallengePeriod("13/2026")).toThrow(
      "Invalid legacy challenge period",
    );
  });

  it("builds a stable challenge-instance key from base and monthly period", () => {
    expect(buildLegacyChallengeInstanceKey("base-1", "2026-08")).toBe(
      "base-1:2026-08",
    );
  });
});
