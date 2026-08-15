import { describe, expect, it } from "vitest";
import {
  buildLegacyPaymentExternalReference,
  legacyKeyTargetsForDomain,
  legacyMigrationKeyManifest,
} from "./migration-manifest";

describe("migration legacy key manifest", () => {
  it("binds every initial migration domain to durable destination keys", () => {
    expect(legacyMigrationKeyManifest).toEqual([
      expect.objectContaining({
        domain: "CHALLENGES",
        sourceField: "ID_DESAFIO_BASE",
        destinationTable: "public.challenges",
        destinationColumn: "legacy_id_desafio_base",
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
    ]);
  });

  it("produces a deterministic namespaced payment reference", () => {
    expect(
      buildLegacyPaymentExternalReference(
        " registration/legacy 1 ",
        " batch:legacy 2 ",
      ),
    ).toBe(
      "dgmb-payment:v1:registration%2Flegacy%201:batch%3Alegacy%202",
    );
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

  it("rejects incomplete payment reference inputs", () => {
    expect(() => buildLegacyPaymentExternalReference("", "batch-1")).toThrow(
      "requires registration and batch identifiers",
    );
    expect(() =>
      buildLegacyPaymentExternalReference("registration-1", "   "),
    ).toThrow("requires registration and batch identifiers");
  });

  it("returns only schema coordinates, never source values", () => {
    expect(legacyKeyTargetsForDomain("PAYMENTS")).toEqual([
      "public.registration_payments.external_reference",
    ]);
    expect(JSON.stringify(legacyMigrationKeyManifest)).not.toContain(
      "registration/legacy 1",
    );
  });
});
