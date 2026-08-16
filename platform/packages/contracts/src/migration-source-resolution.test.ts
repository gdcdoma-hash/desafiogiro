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

  it("derives edition identity from Periodo but requires external evidence for exact sports instants", () => {
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
        status: "EXTERNAL_INPUT_REQUIRED",
        sourceSheet: null,
        sourceField: null,
        semanticRole: "SPORTS_PERIOD_MANIFEST",
      }),
    );
    expect(
      migrationSourceResolutionFor("public.challenges.sports_ends_at"),
    ).toEqual(
      expect.objectContaining({
        status: "EXTERNAL_INPUT_REQUIRED",
        sourceSheet: null,
        sourceField: null,
        semanticRole: "SPORTS_PERIOD_MANIFEST",
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

  it("confirms PixLotes as monthly shared lot pricing without manufacturing a fixed offer price", () => {
    expect(
      migrationSourceResolutionFor("public.challenge_offers.price"),
    ).toEqual(
      expect.objectContaining({
        status: "DERIVATION_CONFIRMED",
        sourceSheet: "PixLotes",
        sourceField: "valor_unitario",
        semanticRole: "MONTHLY_SHARED_LOT_PRICING",
      }),
    );
  });

  it("confirms Meta_KM, occurrence derivation and conservative payment-method policy", () => {
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
      migrationSourceResolutionFor("public.registration_payments.method_code"),
    ).toEqual(
      expect.objectContaining({
        status: "POLICY_CONFIRMED",
        sourceSheet: "dgmbDesafios",
        sourceField: null,
        semanticRole: "UNKNOWN_PAYMENT_METHOD_PRESERVATION",
      }),
    );
  });

  it("contains one source-resolution record per tracked destination field", () => {
    const destinations = legacyMigrationSourceResolution.map(
      (item) => item.destinationField,
    );
    expect(new Set(destinations).size).toBe(destinations.length);
    expect(destinations).toHaveLength(10);
  });
});
