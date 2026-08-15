import { describe, expect, it } from "vitest";
import {
  confirmedLegacySourceFields,
  legacyMigrationSourceResolution,
  migrationSourceResolutionFor,
} from "./migration-source-resolution";

describe("legacy migration source resolution", () => {
  it("confirms only direct source semantics established by trusted evidence", () => {
    expect(confirmedLegacySourceFields()).toEqual([
      "ListaDesafios.Data_Inicio",
      "ListaDesafios.Data_Fim",
      "ListaDesafios.Tipo",
      "dgmbDesafios.Meta_KM",
    ]);
  });

  it("derives reference year from Periodo without inventing sports boundaries", () => {
    expect(
      migrationSourceResolutionFor("public.challenges.reference_year"),
    ).toEqual(
      expect.objectContaining({
        status: "DERIVATION_CONFIRMED",
        sourceSheet: "ListaDesafios",
        sourceField: "Periodo",
        semanticRole: "MONTHLY_CHALLENGE_EDITION",
      }),
    );
    expect(
      migrationSourceResolutionFor("public.challenges.sports_starts_at"),
    ).toEqual(
      expect.objectContaining({
        status: "UNRESOLVED",
        sourceField: "Periodo",
      }),
    );
    expect(
      migrationSourceResolutionFor("public.challenges.sports_ends_at"),
    ).toEqual(
      expect.objectContaining({
        status: "UNRESOLVED",
        sourceField: "Periodo",
      }),
    );
  });

  it("does not reinterpret registration dates as sports dates", () => {
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

  it("confirms Meta_KM and occurrence derivation while payment method remains blocked", () => {
    expect(
      migrationSourceResolutionFor("public.registrations.goal_id"),
    ).toEqual(
      expect.objectContaining({
        status: "SOURCE_CONFIRMED",
        sourceSheet: "dgmbDesafios",
        sourceField: "Meta_KM",
        semanticRole: "REGISTRATION_TARGET_KM",
      }),
    );
    expect(
      migrationSourceResolutionFor("public.registrations.occurrence_number"),
    ).toEqual(
      expect.objectContaining({
        status: "DERIVATION_CONFIRMED",
        sourceSheet: "dgmbDesafios",
        sourceField: null,
        semanticRole: "OFFER_OCCURRENCE_ORDINAL",
      }),
    );
    expect(
      migrationSourceResolutionFor("public.registration_payments.method_code")
        ?.status,
    ).toBe("POLICY_REQUIRED");
  });

  it("contains one source-resolution record per tracked destination field", () => {
    const destinations = legacyMigrationSourceResolution.map(
      (item) => item.destinationField,
    );
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).toHaveLength(10);
  });
});
