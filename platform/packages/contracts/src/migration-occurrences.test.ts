import { describe, expect, it } from "vitest";
import { assignLegacyOccurrenceNumbers } from "./migration-occurrences";

describe("legacy registration occurrence derivation", () => {
  it("assigns one-based ordinals within participant and offer in source order", () => {
    expect(
      assignLegacyOccurrenceNumbers([
        {
          legacyIdInscricao: "registration-a",
          legacyParticipantId: "participant-1",
          legacyChallengeOfferId: "offer-1",
        },
        {
          legacyIdInscricao: "registration-b",
          legacyParticipantId: "participant-1",
          legacyChallengeOfferId: "offer-1",
        },
        {
          legacyIdInscricao: "registration-c",
          legacyParticipantId: "participant-1",
          legacyChallengeOfferId: "offer-2",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        legacyIdInscricao: "registration-a",
        occurrenceNumber: 1,
      }),
      expect.objectContaining({
        legacyIdInscricao: "registration-b",
        occurrenceNumber: 2,
      }),
      expect.objectContaining({
        legacyIdInscricao: "registration-c",
        occurrenceNumber: 1,
      }),
    ]);
  });

  it("keeps participants independent within the same offer", () => {
    const result = assignLegacyOccurrenceNumbers([
      {
        legacyIdInscricao: "registration-a",
        legacyParticipantId: "participant-1",
        legacyChallengeOfferId: "offer-1",
      },
      {
        legacyIdInscricao: "registration-b",
        legacyParticipantId: "participant-2",
        legacyChallengeOfferId: "offer-1",
      },
    ]);

    expect(result.map((item) => item.occurrenceNumber)).toEqual([1, 1]);
  });

  it("blocks incomplete migration keys instead of manufacturing an ordinal", () => {
    expect(() =>
      assignLegacyOccurrenceNumbers([
        {
          legacyIdInscricao: "registration-a",
          legacyParticipantId: "",
          legacyChallengeOfferId: "offer-1",
        },
      ]),
    ).toThrow("Cannot derive legacy occurrence from an incomplete key");
  });
});
