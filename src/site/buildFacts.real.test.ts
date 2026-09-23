// computeBuildFacts against this repo's real coverage output, cross-checked
// with independent counts. Skipped when coverage/vitest-report.json is absent.
//
// That means it always skips inside `npm test` itself: the v8 provider clears
// coverage/ at the start of the run and the reporters write only at the end.
// It exercises real code only when run alone after an `npm test`, e.g.
// npx vitest run src/site/buildFacts.real.test.ts
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
