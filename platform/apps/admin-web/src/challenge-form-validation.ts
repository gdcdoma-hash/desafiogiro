export type ChallengeDraftInput = {
  name: string;
  code: string;
  referenceMonth: number;
  referenceYear: number;
  startsAt: string;
  endsAt: string;
};

export type GoalDraftInput = {
  targetKm: number;
  existingTargets: number[];
};

export type OfferDraftInput = {
  internalName: string;
  publicName: string;
  startsAt: string;
  endsAt: string;
  challengeStartsAt: string;
  challengeEndsAt: string;
  price: number;
  limit: number;
  goalIds: string[];
};

function validDateRange(startsAt: string, endsAt: string) {
  if (!startsAt || !endsAt) return false;
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export function validateChallengeDraft(
  input: ChallengeDraftInput,
): string | null {
  if (input.name.trim().length < 2) return "Informe um nome público válido.";
  if (!/^[A-Za-z0-9_-]+$/.test(input.code.trim())) {
    return "Use apenas letras, números, hífen e sublinhado no código interno.";
  }
  if (
    !Number.isInteger(input.referenceMonth) ||
    input.referenceMonth < 1 ||
    input.referenceMonth > 12
  ) {
    return "Informe um mês de referência válido.";
  }
  if (
    !Number.isInteger(input.referenceYear) ||
    input.referenceYear < 2020 ||
    input.referenceYear > 2200
  ) {
    return "Informe um ano de referência válido.";
  }
  if (!validDateRange(input.startsAt, input.endsAt)) {
    return "Confira o início e o fim do período esportivo.";
  }
  return null;
}

export function validateGoalDraft(input: GoalDraftInput): string | null {
  if (!Number.isInteger(input.targetKm) || input.targetKm <= 0) {
    return "Informe uma meta de quilômetros válida.";
  }
  if (input.existingTargets.includes(input.targetKm)) {
    return "Essa meta já está cadastrada neste desafio.";
  }
  return null;
}

export function validateOfferDraft(input: OfferDraftInput): string | null {
  if (
    input.internalName.trim().length < 2 ||
    input.publicName.trim().length < 2
  ) {
    return "Informe os nomes interno e público da oferta.";
  }
  if (!validDateRange(input.startsAt, input.endsAt)) {
    return "Confira o início e o fim da oferta.";
  }
  const offerStart = new Date(input.startsAt).getTime();
  const offerEnd = new Date(input.endsAt).getTime();
  const challengeStart = new Date(input.challengeStartsAt).getTime();
  const challengeEnd = new Date(input.challengeEndsAt).getTime();
  if (
    Number.isFinite(challengeStart) &&
    Number.isFinite(challengeEnd) &&
    (offerStart > challengeEnd || offerEnd > challengeEnd)
  ) {
    return "A oferta não pode terminar depois do período esportivo do desafio.";
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return "Informe um valor válido para a oferta.";
  }
  if (!Number.isInteger(input.limit) || input.limit < 1) {
    return "Informe um limite por participante válido.";
  }
  if (!input.goalIds.length) {
    return "Selecione pelo menos uma meta disponível nesta oferta.";
  }
  return null;
}
