// computeBuildFacts (tools/build-facts.ts) against a temp directory
// fixture, so these tests never depend on this repo's own coverage output.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeBuildFacts, BuildFactsError } from "../../tools/build-facts";
import { CATS } from "../content";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

let rootDir: string;

function writeReport(overrides: Partial<{ numTotalTests: number; startTime: number; fileCount: number }> = {}) {
  const fileCount = overrides.fileCount ?? 30;
  const testResults = Array.from({ length: fileCount }, () => ({ assertionResults: [{ status: "passed" }] }));
  const report = {
    numTotalTests: overrides.numTotalTests ?? fileCount,
    startTime: overrides.startTime ?? Date.now(),
    testResults,
  };
  mkdirSync(join(rootDir, "coverage"), { recursive: true });
  writeFileSync(join(rootDir, "coverage", "vitest-report.json"), JSON.stringify(report));
}

function writeSummary(branchesPct = 87.5) {
  mkdirSync(join(rootDir, "coverage"), { recursive: true });
  writeFileSync(
    join(rootDir, "coverage", "coverage-summary.json"),
    JSON.stringify({ total: { branches: { pct: branchesPct } } }),
  );
}

function writePackageJson(deps: Record<string, string> = { react: "^18.0.0", "react-dom": "^18.0.0" }) {
  writeFileSync(join(rootDir, "package.json"), JSON.stringify({ dependencies: deps }));
}

/** every input file present, all numbers self-consistent */
function writeValidFixture() {
  writeReport();
  writeSummary();
  writePackageJson();
}

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), "build-facts-test-"));
});

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

describe("computeBuildFacts", () => {
  it("mode serve always returns null, without touching the filesystem", () => {
    const bogusDir = join(rootDir, "does-not-exist");
    const facts = computeBuildFacts({ rootDir: bogusDir, mode: "serve" });
    expect(facts).toBeNull();
  });

  it("computes the expected facts from a valid fixture", () => {
    writeValidFixture();
    const facts = computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] });
    expect(facts).not.toBeNull();
    expect(facts!.tests).toBe(30);
    expect(facts!.testFiles).toBe(30);
    expect(facts!.branchesPct).toBe(87.5);
    expect(facts!.branchFloor).toBe(95);
    expect(facts!.runtimeDeps).toBe(2);
  });

  it("shareShells matches an independent walk of CATS plus the browse and build shells", () => {
    writeValidFixture();
    const facts = computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] });
    let expected = 2;
    for (const cat of CATS) {
      if (cat.key === "contact") continue;
      for (const item of cat.items) if (item.slug) expected++;
    }
    expect(facts!.shareShells).toBe(expected);
  });

  it("throws BuildFactsError naming the missing input when the vitest report is absent", () => {
    writeSummary();
    writePackageJson();
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] })).toThrow(BuildFactsError);
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] })).toThrow(
      /vitest-report\.json/,
    );
  });

  it("throws BuildFactsError naming the missing input when the coverage summary is absent", () => {
    writeReport();
    writePackageJson();
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] })).toThrow(
      /coverage-summary\.json/,
    );
  });

  it("throws BuildFactsError naming the missing input when package.json is absent", () => {
    writeReport();
    writeSummary();
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] })).toThrow(/package\.json/);
  });

  it("throws BuildFactsError on a partial run (too few test files)", () => {
    writeReport({ fileCount: 2, numTotalTests: 2 });
    writeSummary();
    writePackageJson();
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] })).toThrow(/partial test run/);
  });

  it("throws BuildFactsError when numTotalTests does not match the summed assertion results", () => {
    writeReport({ numTotalTests: 999 });
    writeSummary();
    writePackageJson();
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] })).toThrow(
      /stale build fact input/,
    );
  });

  it("throws BuildFactsError when the report predates a source file change", () => {
    writeReport({ startTime: 1000 });
    writeSummary();
    writePackageJson();
    const srcFile = "touched.ts";
    writeFileSync(join(rootDir, srcFile), "export {};");
    utimesSync(join(rootDir, srcFile), new Date(), new Date());
    expect(() =>
      computeBuildFacts({ rootDir, mode: "build", listFiles: () => [srcFile] }),
    ).toThrow(/predates a source file change/);
  });

  it("throws BuildFactsError when the report startTime is in the future relative to now", () => {
    writeReport({ startTime: 5_000_000_000_000 });
    writeSummary();
    writePackageJson();
    expect(() =>
      computeBuildFacts({ rootDir, mode: "build", listFiles: () => [], now: () => 1_000 }),
    ).toThrow(/future/);
  });

  it("does not throw when the report postdates every source file (fresh run)", () => {
    const srcFile = "touched.ts";
    writeFileSync(join(rootDir, srcFile), "export {};");
    utimesSync(join(rootDir, srcFile), new Date(2000, 0, 1), new Date(2000, 0, 1));
    writeReport({ startTime: Date.now() });
    writeSummary();
    writePackageJson();
    expect(() => computeBuildFacts({ rootDir, mode: "build", listFiles: () => [srcFile] })).not.toThrow();
  });

  it("branchFloor (95) matches the branches threshold literal in vitest.config.ts", () => {
    writeValidFixture();
    const facts = computeBuildFacts({ rootDir, mode: "build", listFiles: () => [] });
    const config = readFileSync(resolve(process.cwd(), "vitest.config.ts"), "utf8");
    const match = config.match(/branches:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(95);
    expect(facts!.branchFloor).toBe(95);
  });
});
