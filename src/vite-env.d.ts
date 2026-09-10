/// <reference types="vite/client" />

/** The /build/ page's numbers, computed at build time by the
 * buildFacts() plugin in vite.config.ts (see tools/build-facts.ts). null in
 * dev (serve mode) and in vitest (aliased to src/site/buildFactsNull.ts). */
declare module "virtual:build-facts" {
  const facts: import("./buildFacts").BuildFacts | null;
  export default facts;
}
