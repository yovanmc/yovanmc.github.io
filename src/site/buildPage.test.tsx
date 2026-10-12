// Rendered with renderToStaticMarkup (node environment, no jsdom). Both facts
// states are covered here with vi.doMock and a fresh dynamic import per
// state, since vi.mock's hoisting allows one module shape per file. Each
// state renders once in beforeAll and its tests read the same markup.
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lessons, lessonsHeading, serveModeLine } from "../buildCopy";
import type { BuildFacts } from "../buildFacts";
import { blankTargetAnchors, h1Count } from "../testing/markup";

async function renderWithFacts(facts: BuildFacts | null): Promise<string> {
  vi.resetModules();
  vi.doMock("virtual:build-facts", () => ({ default: facts }));
  try {
    const { BuildPage } = await import("../components/BuildPage");
    return renderToStaticMarkup(<BuildPage isMobile={false} onBack={() => {}} />);
  } finally {
    vi.doUnmock("virtual:build-facts");
    vi.resetModules();
  }
}

describe("BuildPage - null facts (serve mode)", () => {
  let html: string;
  beforeAll(async () => {
    html = await renderWithFacts(null);
  });

  it("renders exactly one h1", () => {
    expect(h1Count(html)).toBe(1);
  });

  it("shows the serve-mode line instead of a numbers strip", () => {
    expect(html).toContain(serveModeLine);
  });
});

describe("BuildPage - populated facts", () => {
  const facts: BuildFacts = {
    tests: 950,
    testFiles: 35,
    branchesPct: 99.76,
    branchFloor: 95,
    shareShells: 10,
    runtimeDeps: 2,
  };
  let html: string;
  beforeAll(async () => {
    html = await renderWithFacts(facts);
  });

  it("renders exactly one h1", () => {
    expect(h1Count(html)).toBe(1);
  });

  it("renders all four pipeline figure labels", () => {
    for (const label of ["HTML LAB", "EXTRACT CANON", "HEADLESS CAPTURE", "RECT ASSERTED"]) {
      expect(html).toContain(label);
    }
  });

  it("renders all three self-contained lessons", () => {
    const unescaped = html.replace(/&#x27;/g, "'");
    expect(lessons.length).toBe(3);
    for (const l of lessons) {
      expect(unescaped).toContain(l.title);
      expect(unescaped).toContain(l.body);
    }
  });

  it("carries the lessons section heading", () => {
    expect(html).toContain(lessonsHeading);
  });

  it("renders the numeric values from facts", () => {
    expect(html).toContain("950");
    expect(html).toContain(">35<");
    expect(html).toContain("99.76%");
  });

  it("every target=_blank anchor also carries rel=noopener noreferrer", () => {
    const blankAnchors = blankTargetAnchors(html);
    expect(blankAnchors.length).toBeGreaterThan(0);
    for (const tag of blankAnchors) {
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });
});

// No semicolon in any buildCopy.ts string value (statement semicolons are
// code, not copy).
describe("buildCopy.ts punctuation", () => {
  function stringLiterals(source: string): string[] {
    return source.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
  }

  function literalsWithSemicolon(source: string): string[] {
    return stringLiterals(source).filter((s) => s.includes(";"));
  }

  it("no string literal value contains a semicolon", () => {
    const source = readFileSync(resolve(process.cwd(), "src/buildCopy.ts"), "utf8");
    expect(stringLiterals(source).length).toBeGreaterThan(0);
    expect(literalsWithSemicolon(source)).toEqual([]);
  });

  it("vacuity check: a planted semicolon inside a literal is flagged, statement semicolons are not", () => {
    const planted = 'export const a = "clean";\nexport const b = "say \\"hi\\"; then go";\n';
    expect(literalsWithSemicolon(planted)).toEqual(['"say \\"hi\\"; then go"']);
  });
});
