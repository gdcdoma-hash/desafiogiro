import { describe, expect, it } from "vitest";
import {
  resolveLegacyRegistrationStatus as resolve,
} from "./migration-registration-status";

describe("legacy registration status migration contract", () => {
  it("maps terminal participant statuses", () => {
    expect(resolve("Concluído", "SETTLED")).toEqual({
      ok: true,
      status: "COMPLETED",
    });
    expect(resolve("Cancelado", "PENDING")).toEqual({
      ok: true,
      status: "CANCELLED",
    });
    expect(resolve("Desistente", "SETTLED")).toEqual({
      ok: true,
      status: "CANCELLED",
    });
    expect(resolve("Não concluído", "SETTLED")).toEqual({
      ok: true,
      status: "EXPIRED",
    });
  });

  it("uses payment state for em andamento", () => {
    expect(resolve("Em andamento", "PENDING")).toEqual({
      ok: true,
      status: "PENDING",
    });
    expect(resolve("Em andamento", "SETTLED")).toEqual({
      ok: true,
      status: "CONFIRMED",
    });
    expect(resolve("Em andamento", "CANCELLED")).toEqual({
      ok: true,
      status: "CANCELLED",
    });
  });

  it("keeps pending payment and follows the blank default", () => {
    expect(resolve("Pendente pagamento", "SETTLED")).toEqual({
      ok: true,
      status: "PENDING",
    });
    expect(resolve("", "PENDING")).toEqual({
      ok: true,
      status: "PENDING",
    });
    expect(resolve("", "SETTLED")).toEqual({
      ok: true,
      status: "CONFIRMED",
    });
  });

  it("blocks unknown status vocabulary", () => {
    expect(resolve("estado improvisado", "SETTLED")).toEqual({
      ok: false,
      reason: "UNKNOWN_LEGACY_REGISTRATION_STATUS",
    });
    expect(resolve("Em andamento", "UNKNOWN")).toEqual({
      ok: false,
      reason: "UNKNOWN_LEGACY_REGISTRATION_STATUS",
    });
  });
});
