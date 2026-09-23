// /build/ routes exactly like /work/, so every "browse" dispatch site in
// App.tsx needs a "build" counterpart. Tested here:
//  1. phaseForPath(path), the path-only resolver decideBoot and popstate use.
//  2. A guard over App.tsx's source: every line containing the quoted
//     literal "browse" must have "build" on it or an adjacent line, so a new
//     browse-only branch fails here. The one exception is the keydown
//     early-return gate, where "build" must never be added (intro, battle and
//     gate own their input; build is handled in the browse-shaped arm). That
//     line holds no "browse" today, so findOffenders' own unit tests prove
//     the exception works.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalPath, phaseForPath } from "./phaseForPath";

describe("phaseForPath", () => {
  it("resolves /work/ and /work to browse, and the old /browse/ path as a legacy alias", () => {
    expect(phaseForPath("/work/")).toBe("browse");
    expect(phaseForPath("/work")).toBe("browse");
    expect(phaseForPath("/browse/")).toBe("browse");
    expect(phaseForPath("/browse")).toBe("browse");
  });

  it("resolves /build/ and /build to build", () => {
    expect(phaseForPath("/build/")).toBe("build");
    expect(phaseForPath("/build")).toBe("build");
  });

  it("resolves the root path to null", () => {
    expect(phaseForPath("/")).toBeNull();
  });

  it("resolves an unknown path to null", () => {
    expect(phaseForPath("/nope")).toBeNull();
    expect(phaseForPath("/work/curio/")).toBeNull();
  });
});

/** Allowed without a "build" sibling: the keydown early-return gate. Matched
 * by content, not line number, so file drift cannot disarm it. */
const GATE_LINE = 's.phase === "intro" || s.phase === "battle" || (s.phase === "gate" && !s.page)';

/** One string per offending line (1-indexed number + trimmed content), empty
 * when every "browse" line has a "build" sibling. */
export function findBrowseBuildOffenders(lines: string[]): string[] {
  const offenders: string[] = [];
  lines.forEach((line, i) => {
    if (!line.includes('"browse"')) return;
    if (line.includes(GATE_LINE)) return;
    const window = [lines[i - 1] ?? "", line, lines[i + 1] ?? ""].join("\n");
    if (!window.includes("build")) offenders.push(`line ${i + 1}: ${line.trim()}`);
  });
  return offenders;
}

function appTsxLines(): string[] {
  return readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8").split("\n");
}

describe("findBrowseBuildOffenders (unit, synthetic fixtures)", () => {
  it("flags a browse-only line with no build anywhere nearby", () => {
    const offenders = findBrowseBuildOffenders(['const x = "browse";']);
    expect(offenders).toHaveLength(1);
  });

  it("does not flag a line where browse and build are both on the same line", () => {
    const offenders = findBrowseBuildOffenders(['const x = p === "build" ? a : "browse";']);
    expect(offenders).toEqual([]);
  });

  it("does not flag a browse line when build is on the line directly before it", () => {
    const offenders = findBrowseBuildOffenders(["// build", 'const x = "browse";']);
    expect(offenders).toEqual([]);
  });

  it("does not flag a browse line when build is on the line directly after it", () => {
    const offenders = findBrowseBuildOffenders(['const x = "browse";', "// build"]);
    expect(offenders).toEqual([]);
  });

  it("vacuity check: the gate-line exception DOES suppress a hypothetical offender that matches it exactly", () => {
    const withoutException = findBrowseBuildOffenders([`if (${GATE_LINE} || x === "browse") return;`]);
    expect(withoutException).toEqual([]); // the same input minus the gate marker IS flagged
    const notExempt = findBrowseBuildOffenders(['if (x === "browse") return; // not the gate line']);
    expect(notExempt).toHaveLength(1);
  });
});

describe("App.tsx browse/build dispatch parity", () => {
  it('every line with a literal "browse" has a "build" sibling within one line, except the keydown early-return gate', () => {
    expect(findBrowseBuildOffenders(appTsxLines())).toEqual([]);
  });

  it("the keydown early-return gate is present in App.tsx and never gains a build check itself", () => {
    const lines = appTsxLines();
    const gateLine = lines.find((l) => l.includes(GATE_LINE));
    expect(gateLine).toBeDefined();
    expect(gateLine).not.toContain("build");
  });
});

describe("canonicalPath", () => {
  it("rewrites the legacy /browse/ index path to /work/", () => {
    expect(canonicalPath("/browse/")).toBe("/work/");
    expect(canonicalPath("/browse")).toBe("/work/");
  });

  it("leaves every other path alone", () => {
    for (const p of ["/work/", "/build/", "/work/curio/", "/experience/software-engineer/", "/"]) {
      expect(canonicalPath(p)).toBe(p);
    }
  });
});
