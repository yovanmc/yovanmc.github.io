/**
 * The shape of the numbers on the /build/ page. Computed at build time
 * by tools/build-facts.ts from the test run, coverage summary, package.json
 * and the site content model, never typed by hand. This file is the type
 * only, kept in src/ so it can be imported by both the browser bundle
 * (via virtual:build-facts) and the node-only compute function in tools/.
 */
export interface BuildFacts {
  /** total assertions across the whole vitest run (report.numTotalTests) */
  tests: number;
  /** number of test files (report.testResults.length, not suite/describe count) */
  testFiles: number;
  /** branch coverage percentage over the measured population (battle + progress + figures) */
  branchesPct: number;
  /** the branches threshold vitest.config.ts enforces on the measured population */
  branchFloor: number;
  /** static share shells written at build time: every project/experience slug plus /work/ and /build/ */
  shareShells: number;
  /** count of package.json dependencies (runtime, not devDependencies) */
  runtimeDeps: number;
}
