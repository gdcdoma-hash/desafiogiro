import { describe, expect, it } from "vitest";
import { isAdminContext } from "./session";

describe("isAdminContext", () => {
  it("accepts a platform administrator", () => {
    expect(
      isAdminContext({
        user_id: "fictional",
        roles: ["platform_admin"],
        permissions: ["admin.access"],
      }),
    ).toBe(true);
  });

  it("rejects a user without admin access", () => {
    expect(
      isAdminContext({ user_id: "fictional", roles: [], permissions: [] }),
    ).toBe(false);
  });

  it("rejects malformed responses", () => {
    expect(isAdminContext(null)).toBe(false);
    expect(isAdminContext({ roles: ["platform_admin"] })).toBe(false);
  });
});
