import { describe, expect, it } from "vitest";
import { AuthorizationError, hasPermission, requirePermission } from "./index";

describe("authorization", () => {
  it("allows only an explicitly granted permission", () => {
    expect(hasPermission(["audit.read"], "audit.read")).toBe(true);
    expect(hasPermission(["audit.read"], "rbac.manage")).toBe(false);
  });

  it("denies an absent permission", () => {
    expect(() => requirePermission([], "admin.access")).toThrow(
      AuthorizationError,
    );
  });
});
