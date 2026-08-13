import { describe, expect, it } from "vitest";
import { summarizeChallenges } from "./challenge-summary";

describe("summarizeChallenges", () => {
  it("resume situações e visibilidade dos desafios", () => {
    const summary = summarizeChallenges([
      { status: "DRAFT", is_public: false },
      { status: "ACTIVE", is_public: true },
      { status: "ACTIVE", is_public: true },
      { status: "FINISHED", is_public: false },
    ]);

    expect(summary).toEqual({
      total: 4,
      draft: 1,
      scheduled: 0,
      active: 2,
      finished: 1,
      cancelled: 0,
      archived: 0,
      publicCount: 2,
      privateCount: 2,
    });
  });
});
