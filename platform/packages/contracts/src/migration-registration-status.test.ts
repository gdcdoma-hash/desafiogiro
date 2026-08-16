import { describe, expect, it } from "vitest";
import { resolveLegacyRegistrationStatus } from "./migration-registration-status";

describe("legacy registration status migration contract", () => {
  it("maps terminal participant statuses without depending on payment state", () => {
    expect(resolveLegacyRegistrationStatus("Concluído", "SETTLED")).toEqual({
      ok: true,
      status: "COMPLETED",
    });
    expect(resolveLegacyRegistrationStatus("Cancelado", "PENDING")).toEqual({
      ok: true,
      status: "CANCELLED",
    });
    expect(resolveLegacyRegistrationStatus("Desistente", "SETTLED")).toEqual({
      ok: true,
      status: "CANCELLED",
    });
    expect(resolveLegacyRegistrationStatus("Não concluído", "SETTLED")).toEqual({
      ok: true,
      status: "EXPIRED",
    });
  });

  it("uses payment state only to disambiguate em andamento", () => {
    expect(resolveLegacyRegistrationStatus("Em andamento", "PENDING")).toEqual({
      ok: true,
      status: "PENDING",
    });
    expect(resolveLegacyRegistrationStatus("Em andamento", "SETTLED")).toEqual({
      ok: true,
      status: "CONFIRMED",
    });
    expect(resolveLegacyRegistrationStatus("Em andamento", "CANCELLED")).toEqual({
      ok: true,
      status: "CANCELLED",
    });
  });

  it("keeps pendente pagamento pending and follows the legacy blank default", () => {
    expect(resolveLegacyRegistrationStatus("Pendente pagamento", "SETTLED")).toEqual({
      ok: true,
      status: "PENDING",
    });
    expect(resolveLegacyRegistrationStatus("", "PENDING")).toEqual({
      ok: true,
      status: "PENDING",
    });
    expect(resolveLegacyRegistrationStatus("", "SETTLED")).toEqual({
      ok: true,
      status: "CONFIRMED",
    });
  });

  it("blocks unknown status vocabulary instead of inventing a destination state", () => {
    expect(resolveLegacyRegistrationStatus("estado improvisado", "SETTLED")).toEqual({
      ok: false,
      reason: "UNKNOWN_LEGACY_REGISTRATION_STATUS",
    });
    expect(resolveLegacyRegistrationStatus("Em andamento", "UNKNOWN")).toEqual({
      ok: false,
      reason: "UNKNOWN_LEGACY_REGISTRATION_STATUS",
    });
  });
});
