import { describe, expect, it } from "vitest";
import {
  validateChallengeDraft,
  validateGoalDraft,
  validateOfferDraft,
} from "./challenge-form-validation";

describe("challenge form validation", () => {
  it("accepts a coherent challenge draft", () => {
    expect(
      validateChallengeDraft({
        name: "Desafio Giro Setembro 2026",
        code: "setembro-2026",
        referenceMonth: 9,
        referenceYear: 2026,
        startsAt: "2026-09-01T00:00",
        endsAt: "2026-09-30T23:59",
      }),
    ).toBeNull();
  });

  it("rejects duplicate goal targets", () => {
    expect(
      validateGoalDraft({ targetKm: 300, existingTargets: [100, 300, 500] }),
    ).toBe("Essa meta já está cadastrada neste desafio.");
  });

  it("rejects an offer ending after the challenge", () => {
    expect(
      validateOfferDraft({
        internalName: "Normal setembro",
        publicName: "Inscrição Setembro",
        startsAt: "2026-08-20T00:00",
        endsAt: "2026-10-01T00:00",
        challengeStartsAt: "2026-09-01T00:00",
        challengeEndsAt: "2026-09-30T23:59",
        price: 44.9,
        limit: 1,
        goalIds: ["goal-1"],
      }),
    ).toBe(
      "A oferta não pode terminar depois do período esportivo do desafio.",
    );
  });

  it("requires at least one goal in the offer", () => {
    expect(
      validateOfferDraft({
        internalName: "Normal setembro",
        publicName: "Inscrição Setembro",
        startsAt: "2026-08-20T00:00",
        endsAt: "2026-09-25T23:59",
        challengeStartsAt: "2026-09-01T00:00",
        challengeEndsAt: "2026-09-30T23:59",
        price: 44.9,
        limit: 1,
        goalIds: [],
      }),
    ).toBe("Selecione pelo menos uma meta disponível nesta oferta.");
  });
});
