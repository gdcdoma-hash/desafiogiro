import type { LegacyPaymentCategory } from "./migration-payments";

export type MigrationRegistrationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED";

export type LegacyRegistrationStatusResolution =
  | { ok: true; status: MigrationRegistrationStatus }
  | { ok: false; reason: "UNKNOWN_LEGACY_REGISTRATION_STATUS" };

function normalizeLegacyRegistrationStatus(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function resolveLegacyRegistrationStatus(
  userChallengeStatus: string,
  paymentCategory: LegacyPaymentCategory,
): LegacyRegistrationStatusResolution {
  const normalized = normalizeLegacyRegistrationStatus(userChallengeStatus.trim());

  if (normalized === "CONCLUIDO" || normalized === "CONCLUIDA") {
    return { ok: true, status: "COMPLETED" };
  }

  if (
    normalized === "CANCELADO" ||
    normalized === "CANCELADA" ||
    normalized === "DESISTENTE"
  ) {
    return { ok: true, status: "CANCELLED" };
  }

  if (normalized === "NAOCONCLUIDO" || normalized === "NAOCONCLUIDA") {
    return { ok: true, status: "EXPIRED" };
  }

  if (normalized === "PENDENTEPAGAMENTO") {
    return { ok: true, status: "PENDING" };
  }

  if (normalized === "" || normalized === "EMANDAMENTO") {
    if (paymentCategory === "SETTLED") {
      return { ok: true, status: "CONFIRMED" };
    }
    if (paymentCategory === "CANCELLED") {
      return { ok: true, status: "CANCELLED" };
    }
    if (paymentCategory === "PENDING") {
      return { ok: true, status: "PENDING" };
    }
  }

  return { ok: false, reason: "UNKNOWN_LEGACY_REGISTRATION_STATUS" };
}
