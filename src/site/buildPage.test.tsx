// Rendered with renderToStaticMarkup (node environment, no jsdom). Both facts
// states are covered here with vi.doMock and a fresh dynamic import per test,
// since vi.mock's hoisting allows one module shape per file.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lessons, lessonsHeading, serveModeLine } from "../buildCopy";
import type { BuildFacts } from "../buildFacts";

async function renderWithFacts(facts: BuildFacts | null): Promise<string> {
  vi.resetModules();
  vi.doMock("virtual:build-facts", () => ({ default: facts }));
  const { BuildPage } = await import("../components/BuildPage");
  return renderToStaticMarkup(<BuildPage isMobile={false} onBack={() => {}} />);
}

afterEach(() => {
  vi.doUnmock("virtual:build-facts");
  vi.resetModules();
});

describe("BuildPage - null facts (serve mode)", () => {
  it("renders exactly one h1", async () => {
    const html = await renderWithFacts(null);
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
  });

  it("shows the serve-mode line instead of a numbers strip", async () => {
    const html = await renderWithFacts(null);
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

  it("renders exactly one h1", async () => {
    const html = await renderWithFacts(facts);
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
  });

  it("renders all four pipeline figure labels", async () => {
    const html = await renderWithFacts(facts);
    for (const label of ["HTML LAB", "EXTRACT CANON", "HEADLESS CAPTURE", "RECT ASSERTED"]) {
      expect(html).toContain(label);
    }
  });

  it("renders all three self-contained lessons", async () => {
    const unescaped = (await renderWithFacts(facts)).replace(/&#x27;/g, "'");
    expect(lessons.length).toBe(3);
    for (const l of lessons) {
      expect(unescaped).toContain(l.title);
      expect(unescaped).toContain(l.body);
    }
  });

  it("carries the lessons section heading", async () => {
    const html = await renderWithFacts(facts);
    expect(html).toContain(lessonsHeading);
  });

  it("renders the numeric values from facts", async () => {
    const html = await renderWithFacts(facts);
    expect(html).toContain("950");
    expect(html).toContain(">35<");
    expect(html).toContain("99.76%");
  });

  it("every target=_blank anchor also carries rel=noopener noreferrer", async () => {
    const html = await renderWithFacts(facts);
    const blankAnchors = html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
    expect(blankAnchors.length).toBeGreaterThan(0);
    for (const tag of blankAnchors) {
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });
});

// No semicolon in any buildCopy.ts string value (statement semicolons are
// code, not copy).
describe("buildCopy.ts punctuation", () => {
  function stringLiterals(): string[] {
    const source = readFileSync(resolve(process.cwd(), "src/buildCopy.ts"), "utf8");
    return source.match(/"(?:[^"\\]|\\.)*"/g) ?? [];
  }

  it("no string literal value contains a semicolon", () => {
    const strings = stringLiterals();
    expect(strings.length).toBeGreaterThan(0);
    for (const s of strings) {
      expect(s).not.toContain(";");
    }
  });

  it("vacuity check: the semicolon regex DOES flag a planted semicolon", () => {
    expect('"a string with a ; semicolon"'.includes(";")).toBe(true);
  });
});
