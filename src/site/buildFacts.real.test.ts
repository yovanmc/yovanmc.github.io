// computeBuildFacts run against this repo's own, real coverage output,
// cross-checked against independent counts. Skipped when
// coverage/vitest-report.json is not on disk yet (a fresh checkout, or CI's
// very first npm test before any coverage/ dir exists), so this file never
// blocks a clean-checkout run.
//
// Note this means the file is ALWAYS skipped when it runs as part of
// npm test itself: the v8 coverage provider clears coverage/ at the start
// of every --coverage run, before the json/json-summary reporters get a
// chance to write their own output at the end, so vitest-report.json does
// not exist yet at collection time. These assertions only exercise real
// code when this file is run on its own (for example
// npx vitest run src/site/buildFacts.real.test.ts) after a prior npm test
// has already populated coverage/. This is expected, not a bug.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeBuildFacts } from "../../tools/build-facts";
import { CATS } from "../content";

const REPORT_PATH = resolve(process.cwd(), "coverage", "vitest-report.json");

describe.skipIf(!existsSync(REPORT_PATH))("computeBuildFacts against the real repo", () => {
  it("computes non-null facts from the real coverage output", () => {
    const facts = computeBuildFacts({ rootDir: process.cwd(), mode: "build" });
    expect(facts).not.toBeNull();
  });

  it("testFiles matches the real report's testResults length, not numTotalTestSuites", () => {
    const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
    const facts = computeBuildFacts({ rootDir: process.cwd(), mode: "build" });
    expect(facts!.testFiles).toBe(report.testResults.length);
    expect(facts!.testFiles).not.toBe(report.numTotalTestSuites);
  });

  it("shareShells matches an independent walk of CATS plus the browse and build shells", () => {
    const facts = computeBuildFacts({ rootDir: process.cwd(), mode: "build" });
    let expected = 2;
    for (const cat of CATS) {
      if (cat.key === "contact") continue;
      for (const item of cat.items) if (item.slug) expected++;
    }
    expect(facts!.shareShells).toBe(expected);
  });

  it("branchFloor is 95, matching the literal in vitest.config.ts", () => {
    const config = readFileSync(resolve(process.cwd(), "vitest.config.ts"), "utf8");
    expect(config).toMatch(/branches:\s*95/);
    const facts = computeBuildFacts({ rootDir: process.cwd(), mode: "build" });
    expect(facts!.branchFloor).toBe(95);
  });

  it("runtimeDeps matches the real package.json dependencies count", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
    const facts = computeBuildFacts({ rootDir: process.cwd(), mode: "build" });
    expect(facts!.runtimeDeps).toBe(Object.keys(pkg.dependencies ?? {}).length);
  });
});
