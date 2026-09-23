import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Separate from vite.config.ts on purpose: adding a `test` key there fails
// `tsc -b` (vite's defineConfig type has no `test` property — TS2353).
export default defineConfig({
  resolve: {
    alias: {
      // vitest never runs the vite plugin, so resolve the virtual module to the
      // same null serve mode yields. Tests needing numbers vi.mock it.
      "virtual:build-facts": resolve(__dirname, "src/site/buildFactsNull.ts"),
    },
  },
  test: {
    include: [
      "src/battle/**/*.test.ts",
      "src/progress/**/*.test.ts",
      "src/figures/**/*.test.ts",
      "src/site/**/*.test.{ts,tsx}",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "json-summary"],
      include: ["src/battle/**/*.ts", "src/progress/**/*.ts", "src/figures/**/*.ts"],
      thresholds: {
        "src/battle/**/*.ts": { branches: 95 },
        "src/progress/**/*.ts": { branches: 95 },
        "src/figures/**/*.ts": { branches: 95 },
      },
    },
  },
});
