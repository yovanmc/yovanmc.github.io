import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Separate from vite.config.ts on purpose: adding a `test` key there fails
// `tsc -b` (vite's defineConfig type has no `test` property — TS2353).
export default defineConfig({
  resolve: {
    alias: {
      // Components that import "virtual:build-facts" (the vite
      // plugin's own module) need something to resolve to under vitest,
      // which never runs the vite plugin pipeline. null is the same value
      // the real plugin yields in dev/serve mode; a test that needs
      // populated numbers uses vi.mock("virtual:build-facts") instead.
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
