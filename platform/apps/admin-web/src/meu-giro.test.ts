import { describe, expect, it } from "vitest";
import { selectMeuGiroFocus, type MeuGiroProgress } from "./meu-giro";

function progress(overrides: Partial<MeuGiroProgress>): MeuGiroProgress {
  return {
    registration_id: "registration",
    challenge_id: "challenge",
    challenge_name: "Desafio",
    reference_year: 2026,
    reference_month: 8,
    target_km: 200,
    completed_km: 0,
    remaining_km: 200,
    progress_percent: 0,
    registration_status: "CONFIRMED",
    sports_starts_at: "2026-08-01T03:00:00Z",
    sports_ends_at: "2026-09-01T02:59:59Z",
    is_current_focus: false,
    ...overrides,
  };
}

describe("selectMeuGiroFocus", () => {
  it("prioritizes the current month over an old incomplete challenge", () => {
    const old = progress({ challenge_name: "Julho", remaining_km: 50 });
    const current = progress({
      challenge_name: "Agosto",
      is_current_focus: true,
    });
    expect(selectMeuGiroFocus([old, current])).toBe(current);
  });

  it("keeps a zero-kilometer registration visible", () => {
    const empty = progress({ completed_km: 0, progress_percent: 0 });
    expect(selectMeuGiroFocus([empty])).toBe(empty);
  });
});
