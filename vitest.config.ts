import { defineConfig } from "vitest/config";

// Separate from vite.config.ts on purpose: adding a `test` key there fails
// `tsc -b` (vite's defineConfig type has no `test` property — TS2353).
export default defineConfig({
  test: {
    include: ["src/battle/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/battle/engine.ts"],
      thresholds: {
        "src/battle/engine.ts": { branches: 95 },
      },
    },
  },
});
