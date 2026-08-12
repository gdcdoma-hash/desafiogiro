import { describe, expect, it } from "vitest";
import { parsePublicConfig } from "./index";

describe("parsePublicConfig", () => {
  it("accepts an isolated local environment", () => {
    expect(
      parsePublicConfig({
        PORTAL_GIRO_ENV: "local",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: "fictional-local-key",
        ADMIN_WEB_ORIGIN: "http://localhost:5173",
      }).PORTAL_GIRO_ENV,
    ).toBe("local");
  });

  it("rejects an unknown environment", () => {
    expect(() =>
      parsePublicConfig({
        PORTAL_GIRO_ENV: "dev",
        SUPABASE_URL: "http://127.0.0.1:54321",
        SUPABASE_ANON_KEY: "fictional-local-key",
        ADMIN_WEB_ORIGIN: "http://localhost:5173",
      }),
    ).toThrow();
  });
});
