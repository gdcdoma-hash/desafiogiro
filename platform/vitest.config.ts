import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { reporter: ["text", "html"], provider: "v8" },
    include: ["apps/**/*.test.ts", "packages/**/*.test.ts"],
  },
});
