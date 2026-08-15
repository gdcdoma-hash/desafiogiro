import { describe, expect, it } from "vitest";
import {
  confirmedLegacySourceFields,
  legacyMigrationSourceResolution,
  migrationSourceResolutionFor,
} from "./migration-source-resolution";

describe("legacy migration source resolution", () => {
  it("confirms only source semantics established by trusted legacy code", () => {
    expect(confirmedLegacySourceFields()).toEqual([
      "ListaDesafios.Data_Inicio",
      "ListaDesafios.Data_Fim",
      "ListaDesafios.Tipo",
    ]);
  });

  it("does not reinterpret registration dates as sports dates", () => {
    expect(
      migrationSourceResolutionFor("public.challenges.sports_starts_at"),
    ).toEqual(
      expect.objectContaining({
        status: "UNRESOLVED",
        sourceField: "Periodo",
      }),
    );
    expect(
      migrationSourceResolutionFor(
        "public.challenge_offers.registration_starts_at",
      ),
    ).toEqual(
      expect.objectContaining({
        status: "SOURCE_CONFIRMED",
        sourceSheet: "ListaDesafios",
        sourceField: "Data_Inicio",
        semanticRole: "REGISTRATION_ELIGIBILITY_START",
      }),
    );
  });

  it("keeps legacy pricing ambiguous instead of manufacturing an offer price", () => {
    expect(
      migrationSourceResolutionFor("public.challenge_offers.price"),
    ).toEqual(
      expect.objectContaining({
        status: "AMBIGUOUS_SOURCE",
        sourceSheet: null,
        sourceField: null,
      }),
    );
  });

  it("keeps target, occurrence and payment method blocked until evidence or policy exists", () => {
    expect(
      migrationSourceResolutionFor("public.registrations.goal_id")?.status,
    ).toBe("PARTIAL_SOURCE");
    expect(
      migrationSourceResolutionFor("public.registrations.occurrence_number")
        ?.status,
    ).toBe("DERIVATION_REQUIRED");
    expect(
      migrationSourceResolutionFor("public.registration_payments.method_code")
        ?.status,
    ).toBe("POLICY_REQUIRED");
  });

  it("contains one resolution record for every current unresolved destination field", () => {
    const destinations = legacyMigrationSourceResolution.map(
      (item) => item.destinationField,
    );
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).toHaveLength(10);
  });
});
