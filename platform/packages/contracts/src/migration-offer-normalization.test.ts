import { describe, expect, it } from "vitest";
import {
  normalizeLegacyOfferCategory,
  normalizeLegacyOfferSource,
  normalizeLegacyRegistrationWindow,
} from "./migration-offer-normalization";

describe("legacy offer normalization", () => {
  it("normalizes only the legacy offer types established by the trusted code", () => {
    expect(normalizeLegacyOfferCategory("Normal")).toBe("NORMAL");
    expect(normalizeLegacyOfferCategory(" repescagem ")).toBe("REPESCAGEM");
    expect(() => normalizeLegacyOfferCategory("tipo novo")).toThrow(
      "Unknown legacy offer category",
    );
  });

  it("normalizes Brazilian dates to the America/Fortaleza registration window", () => {
    expect(normalizeLegacyRegistrationWindow("01/08/2026", "10/08/2026")).toEqual({
      timezone: "America/Fortaleza",
      registrationStartsAt: "2026-08-01T03:00:00.000Z",
      registrationEndsAt: "2026-08-11T02:59:59.999Z",
    });
  });

  it("accepts canonical ISO calendar dates without accepting ambiguous timestamps", () => {
    expect(normalizeLegacyRegistrationWindow("2026-08-11", "2026-08-31")).toEqual({
      timezone: "America/Fortaleza",
      registrationStartsAt: "2026-08-11T03:00:00.000Z",
      registrationEndsAt: "2026-09-01T02:59:59.999Z",
    });
    expect(() =>
      normalizeLegacyRegistrationWindow(
        "2026-08-11T00:00:00Z",
        "2026-08-31T00:00:00Z",
      ),
    ).toThrow("Unsupported legacy registration date format");
  });

  it("rejects invalid calendar dates and reversed windows", () => {
    expect(() =>
      normalizeLegacyRegistrationWindow("31/02/2026", "10/03/2026"),
    ).toThrow("Invalid legacy registration date");
    expect(() =>
      normalizeLegacyRegistrationWindow("10/08/2026", "09/08/2026"),
    ).toThrow("must end after it starts");
  });

  it("produces a complete normalized source result without price inference", () => {
    expect(
      normalizeLegacyOfferSource({
        tipo: "Repescagem",
        dataInicio: "15/08/2026",
        dataFim: "20/08/2026",
      }),
    ).toEqual({
      categoryCode: "REPESCAGEM",
      timezone: "America/Fortaleza",
      registrationStartsAt: "2026-08-15T03:00:00.000Z",
      registrationEndsAt: "2026-08-21T02:59:59.999Z",
    });
  });
});
