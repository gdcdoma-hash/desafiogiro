export type LegacyOccurrenceInput = {
  legacyIdInscricao: string;
  legacyParticipantId: string;
  legacyChallengeOfferId: string;
};

export type LegacyOccurrenceAssignment = LegacyOccurrenceInput & {
  occurrenceNumber: number;
};

export function assignLegacyOccurrenceNumbers(
  registrationsInSourceOrder: readonly LegacyOccurrenceInput[],
): LegacyOccurrenceAssignment[] {
  const counts = new Map<string, number>();

  return registrationsInSourceOrder.map((registration) => {
    const participant = registration.legacyParticipantId.trim();
    const offer = registration.legacyChallengeOfferId.trim();
    const registrationId = registration.legacyIdInscricao.trim();

    if (!participant || !offer || !registrationId) {
      throw new Error("Cannot derive legacy occurrence from an incomplete key");
    }

    const key = `${participant}:${offer}`;
    const occurrenceNumber = (counts.get(key) ?? 0) + 1;
    counts.set(key, occurrenceNumber);

    return {
      ...registration,
      occurrenceNumber,
    };
  });
}
