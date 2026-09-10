// /build/ routes exactly like /work/, so every "browse" dispatch site in
// App.tsx needs a "build" counterpart. Two things are tested here:
//  1. phaseForPath(path) - the pure path-only resolver both decideBoot and
//     popstate's path arm use.
//  2. A structural guard over App.tsx's source text: every line containing
//     the literal string "browse" (quoted, matching `grep -n '"browse"'`)
//     must have "build" within one line of it - same line, the line before,
//     or the line after - so a future edit that adds a new browse-only branch
//     trips this test instead of silently reintroducing the /build/ gap. The
//     one allowed exception is App.tsx's keydown early-return gate
//     (`s.phase === "intro" || s.phase === "battle" || (s.phase === "gate"
//     && !s.page)`) - "build" must NEVER be added there, since intro/
//     battle/gate own their own input entirely and build's ESC/Backspace
//     handling lives in the ordinary browse-shaped arm further down. At
//     HEAD that gate line does not itself contain "browse" (it never has,
//     it is not a browse/build dispatch site), so the exception clause is
//     currently a defensive no-op over the real file - findOffenders' own
//     unit tests below (not App.tsx) are what prove the clause actually
//     excludes a matching line when one exists.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { phaseForPath } from "./phaseForPath";

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

/** The one App.tsx line "browse" is allowed to appear on without a "build"
 * sibling: the keydown early-return gate. Matched by content, not a line
 * number, so file drift can't silently disarm the exception. */
const GATE_LINE = 's.phase === "intro" || s.phase === "battle" || (s.phase === "gate" && !s.page)';

/** Pure so it is testable against synthetic fixtures, not just the real
 * App.tsx - returns one string per offending line (1-indexed line number +
 * trimmed content), empty when every "browse" line has a "build" sibling. */
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
    expect(withoutException).toEqual([]); // proves the exception clause, not a coincidence: same input minus the gate marker below IS flagged
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
