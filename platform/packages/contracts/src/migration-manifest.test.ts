import { describe, expect, it } from "vitest";
import {
  buildLegacyInventoryOpeningExternalReference,
  buildLegacyPaymentExternalReference,
  legacyKeyTargetsForDomain,
  legacyMigrationKeyManifest,
} from "./migration-manifest";

describe("migration legacy key manifest", () => {
  it("binds migration domains to durable destination keys", () => {
    expect(legacyMigrationKeyManifest).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: "CHALLENGES",
          sourceField: "ID_DESAFIO_BASE",
          destinationTable: "public.challenges",
          destinationColumn: "legacy_id_desafio_base",
          uniqueness: "LOOKUP_ONLY",
        }),
        expect.objectContaining({
          domain: "CHALLENGES",
          sourceField: "ID_DESAFIO_BASE + PERIODO",
          destinationTable: "public.challenges",
          destinationColumn: "legacy_challenge_key",
          uniqueness: "UNIQUE_WHEN_PRESENT",
        }),
        expect.objectContaining({
          domain: "CHALLENGES",
          sourceField: "ID_DESAFIO_LISTA",
          destinationTable: "public.challenge_offers",
          destinationColumn: "legacy_id_desafio_lista",
        }),
        expect.objectContaining({
          domain: "PARTICIPANTS",
          sourceField: "ID_DGMB",
          destinationTable: "public.participants",
          destinationColumn: "legacy_id_dgmb",
        }),
        expect.objectContaining({
          domain: "REGISTRATIONS",
          sourceField: "ID_INSCRICAO",
          destinationTable: "public.registrations",
          destinationColumn: "legacy_id_inscricao",
        }),
        expect.objectContaining({
          domain: "PAYMENTS",
          destinationTable: "public.registration_payments",
          destinationColumn: "external_reference",
        }),
        expect.objectContaining({
          domain: "INVENTORY",
          sourceField: "ID_ITEM_ESTOQUE",
          destinationTable: "public.inventory_items",
          destinationColumn: "legacy_id_item_estoque",
        }),
        expect.objectContaining({
          domain: "INVENTORY",
          destinationTable: "public.inventory_movements",
          destinationColumn: "external_reference",
        }),
      ]),
    );
  });

  it("produces a deterministic namespaced payment reference", () => {
    expect(
      buildLegacyPaymentExternalReference(
        " registration/legacy 1 ",
        " batch:legacy 2 ",
      ),
    ).toBe("dgmb-payment:v1:registration%2Flegacy%201:batch%3Alegacy%202");
    expect(
      buildLegacyPaymentExternalReference(
        "registration/legacy 1",
        "batch:legacy 2",
      ),
    ).toBe(
      buildLegacyPaymentExternalReference(
        " registration/legacy 1 ",
        " batch:legacy 2 ",
      ),
    );
  });

  it("produces a deterministic inventory opening reference", () => {
    expect(
      buildLegacyInventoryOpeningExternalReference(" stock/legacy 1 "),
    ).toBe("dgmb-inventory-opening:v1:stock%2Flegacy%201");
  });

  it("rejects incomplete external reference inputs", () => {
    expect(() => buildLegacyPaymentExternalReference("", "batch-1")).toThrow(
      "requires registration and batch identifiers",
    );
    expect(() =>
      buildLegacyPaymentExternalReference("registration-1", "   "),
    ).toThrow("requires registration and batch identifiers");
    expect(() => buildLegacyInventoryOpeningExternalReference("   ")).toThrow(
      "requires an inventory item identifier",
    );
  });

  it("returns only unique schema coordinates, never lookup-only coordinates", () => {
    expect(legacyKeyTargetsForDomain("CHALLENGES")).toEqual([
      "public.challenges.legacy_challenge_key",
      "public.challenge_offers.legacy_id_desafio_lista",
    ]);
    expect(legacyKeyTargetsForDomain("INVENTORY")).toEqual([
      "public.inventory_items.legacy_id_item_estoque",
      "public.inventory_movements.external_reference",
    ]);
    expect(JSON.stringify(legacyMigrationKeyManifest)).not.toContain(
      "registration/legacy 1",
    );
  });
});
