import { describe, expect, it } from "vitest";
import {
  normalizeLegacyTargetKm,
  validateLegacyGoalSnapshot,
} from "./migration-goals";
import type { LegacyMigrationSnapshot } from "./migration";

describe("legacy registration goal preflight", () => {
  it("accepts the physically audited Meta_KM header", () => {
    const snapshot: LegacyMigrationSnapshot = {
      dgmbDesafios: {
        headers: ["ID_INSCRICAO", "Meta_KM"],
        rows: [
          ["legacy-1", "300"],
          ["legacy-2", "500"],
        ],
      },
    };

    expect(validateLegacyGoalSnapshot(snapshot)).toEqual({
      ok: true,
      rows: 2,
      issues: [],
    });
  });

  it("blocks a missing Meta_KM header", () => {
    const snapshot: LegacyMigrationSnapshot = {
      dgmbDesafios: { headers: ["ID_INSCRICAO"], rows: [["legacy-1"]] },
    };

    expect(validateLegacyGoalSnapshot(snapshot)).toEqual({
      ok: false,
      rows: 1,
      issues: [{ code: "MISSING_GOAL_HEADER", field: "Meta_KM", count: 1 }],
    });
  });

  it("aggregates invalid targets without exposing row values", () => {
    const snapshot: LegacyMigrationSnapshot = {
      dgmbDesafios: {
        headers: ["Meta_KM"],
        rows: [["0"], ["texto privado"]],
      },
    };

    const report = validateLegacyGoalSnapshot(snapshot);
    expect(report.issues).toEqual([
      {
        code: "INVALID_REGISTRATION_TARGET_KM",
        field: "Meta_KM",
        count: 2,
      },
    ]);
    expect(JSON.stringify(report)).not.toContain("texto privado");
  });

  it("normalizes integer-like legacy targets only", () => {
    expect(normalizeLegacyTargetKm(" 300 ")).toBe(300);
    expect(normalizeLegacyTargetKm("500,0")).toBe(500);
    expect(() => normalizeLegacyTargetKm("300,5")).toThrow(
      "Invalid legacy registration target km",
    );
  });
});
