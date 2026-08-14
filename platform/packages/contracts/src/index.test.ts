import { describe, expect, it } from "vitest";
import { isPermission, permissions } from "./index";

describe("permission contract", () => {
  it("contains the current platform permission set without duplicates", () => {
    expect(permissions).toEqual([
      "admin.access",
      "admin.users.manage",
      "admin.users.read",
      "audit.read",
      "challenges.manage",
      "challenges.read",
      "inventory.manage",
      "inventory.read",
      "medal_deliveries.manage",
      "medal_deliveries.read",
      "operations.read",
      "participants.manage",
      "participants.read",
      "payments.manage",
      "payments.read",
      "public_registrations.manage",
      "public_registrations.read",
      "rbac.manage",
      "rbac.read",
      "registrations.manage",
      "registrations.read",
    ]);
    expect(new Set(permissions).size).toBe(permissions.length);
  });

  it("recognizes only known permissions", () => {
    expect(isPermission("public_registrations.manage")).toBe(true);
    expect(isPermission("unknown.permission")).toBe(false);
  });
});
