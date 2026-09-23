/**
 * Computes the facts shown on the /build/ page.
 *
 * TypeScript, not .mjs: vite.config.ts imports it and tsconfig.node.json has
 * no allowJs. Inputs are read from disk under rootDir, so it tests against a
 * temp directory fixture.
 *
 * Inputs:
 *   coverage/vitest-report.json   vitest json reporter (numTotalTests, testResults, startTime)
 *   coverage/coverage-summary.json vitest json-summary reporter (total.branches.pct)
 *   package.json                  dependencies count
 *   CATS (src/content.ts)         the same slug walk shareShells uses in vite.config.ts
 *
 * mode "serve" returns null without touching the filesystem. mode "build"
 * throws BuildFactsError naming the missing or stale input, so a build never
 * publishes quietly wrong numbers.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { shellPaths } from "../src/site/shellPaths";
import type { BuildFacts } from "../src/buildFacts";

export type { BuildFacts };

export type BuildMode = "build" | "serve";

export class BuildFactsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildFactsError";
  }
}

/** A vitest run reporting fewer test files than this cannot be the whole
 * suite. A filtered `vitest run <one file>` still writes a complete-looking
 * report, so the file count is the cheapest partial-run tripwire. */
const MIN_TEST_FILES = 30;

export interface ComputeBuildFactsOptions {
  rootDir: string;
  mode: BuildMode;
  /** every file the build depends on, relative to rootDir (default: git, tracked + untracked, respecting .gitignore) */
  listFiles?: (rootDir: string) => string[];
  /** fallback "current time" used only when listFiles() returns nothing to compare against */
  now?: () => number;
}

interface VitestAssertionResult {
  [key: string]: unknown;
}

interface VitestTestFileResult {
  assertionResults?: VitestAssertionResult[];
}

interface VitestReport {
  numTotalTests?: number;
  startTime?: number;
  testResults?: VitestTestFileResult[];
}

interface CoverageSummary {
  total?: {
    branches?: {
      pct?: number;
    };
  };
}

function defaultListFiles(rootDir: string): string[] {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: rootDir,
    encoding: "utf8",
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function computeBuildFacts(options: ComputeBuildFactsOptions): BuildFacts | null {
  const { rootDir, mode, listFiles = defaultListFiles, now = () => Date.now() } = options;
  if (mode === "serve") return null;

  const reportPath = join(rootDir, "coverage", "vitest-report.json");
  const summaryPath = join(rootDir, "coverage", "coverage-summary.json");
  const pkgPath = join(rootDir, "package.json");

  const inputs: Array<[label: string, path: string]> = [
    ["coverage/vitest-report.json", reportPath],
    ["coverage/coverage-summary.json", summaryPath],
    ["package.json", pkgPath],
  ];
  for (const [label, path] of inputs) {
    if (!existsSync(path)) {
      throw new BuildFactsError(`missing build fact input: ${label} (run npm test first)`);
    }
  }

  const report = JSON.parse(readFileSync(reportPath, "utf8")) as VitestReport;
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as CoverageSummary;
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { dependencies?: Record<string, string> };

  const testResults = report.testResults ?? [];
  const testFiles = testResults.length;

  if (testFiles < MIN_TEST_FILES) {
    throw new BuildFactsError(
      `partial test run: coverage/vitest-report.json has only ${testFiles} test files, expected at least ${MIN_TEST_FILES}. Run npm test, not a filtered vitest run`,
    );
  }

  const assertionCount = testResults.reduce((sum, file) => sum + (file.assertionResults?.length ?? 0), 0);
  if (report.numTotalTests !== assertionCount) {
    throw new BuildFactsError(
      `stale build fact input: coverage/vitest-report.json numTotalTests (${report.numTotalTests}) does not match its own testResults (${assertionCount} assertions). Run npm test again`,
    );
  }

  if (typeof report.startTime !== "number") {
    throw new BuildFactsError("missing build fact input: startTime in coverage/vitest-report.json");
  }
  // A report claiming to start after "now" cannot be real (clock skew, or a
  // hand-edited fixture), so it is untrustworthy the same way a stale one is.
  if (report.startTime > now()) {
    throw new BuildFactsError(
      "stale build fact input: coverage/vitest-report.json startTime is in the future, the report is not trustworthy",
    );
  }

  // An empty list says nothing about staleness, so it is not an error.
  const sourceFiles = listFiles(rootDir);
  if (sourceFiles.length > 0) {
    const newestSourceMtime = Math.max(...sourceFiles.map((f) => statSync(join(rootDir, f)).mtimeMs));
    if (report.startTime < newestSourceMtime) {
      throw new BuildFactsError(
        "stale build fact input: coverage/vitest-report.json predates a source file change. Run npm test again before building",
      );
    }
  }

  const branchesPct = summary.total?.branches?.pct;
  if (typeof branchesPct !== "number") {
    throw new BuildFactsError("missing build fact input: total.branches.pct in coverage/coverage-summary.json");
  }

  const runtimeDeps = Object.keys(pkg.dependencies ?? {}).length;

  // The same list share-shells writes, so this count cannot drift from what
  // the build produces.
  const shareShells = shellPaths().length;

  return {
    tests: report.numTotalTests as number,
    testFiles,
    branchesPct,
    branchFloor: 95,
    shareShells,
    runtimeDeps,
  };
}
