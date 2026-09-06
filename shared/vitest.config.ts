import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.d.ts"],
      // Ratchet floors: about 0.3 points under the last measured run.
      thresholds: { statements: 91.4, branches: 99.7, functions: 87.2, lines: 91.3 },
    },
  },
});
