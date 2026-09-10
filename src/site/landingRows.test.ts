import { describe, expect, it } from "vitest";
import { contactLinks, landingRows, nextRowIndex } from "./landingRows";
import { bioLine, footerEmail, footerGithub, footerLinkedin, ogRootDescription, phoneNote } from "../landingCopy";

describe("landingRows", () => {
  it("fresh visitor: New game, My work, Contact (no Continue, no build row)", () => {
    expect(landingRows(false).map((r) => r.kind)).toEqual(["game", "work", "contact"]);
  });

  it("visitor with progress: Continue sits right after New game", () => {
    expect(landingRows(true).map((r) => r.kind)).toEqual(["game", "continue", "work", "contact"]);
  });

  it("the work row is labelled My work", () => {
    expect(landingRows(false).find((r) => r.kind === "work")!.label).toBe("My work");
  });

  it("anchor rows carry real hrefs, button rows carry none", () => {
    const rows = landingRows(true);
    const by = (k: string) => rows.find((r) => r.kind === k)!;
    expect(by("game").href).toBeUndefined();
    expect(by("continue").href).toBeUndefined();
    expect(by("work").href).toBe("/work/");
    expect(by("contact").href).toMatch(/^mailto:/);
  });

  it("every landing string obeys the punctuation rule (no em/en dash, no semicolon)", () => {
    const strings = [
      ...landingRows(true).map((r) => r.label),
      bioLine,
      phoneNote,
      ogRootDescription,
      footerGithub,
      footerLinkedin,
      footerEmail,
    ];
    for (const s of strings) {
      expect(s.length).toBeGreaterThan(0);
      expect(s).not.toMatch(/[–—;]/);
    }
  });
});

describe("nextRowIndex", () => {
  it("nothing focused: ArrowDown lands on the first row, ArrowUp on the last", () => {
    expect(nextRowIndex(null, "ArrowDown", 5)).toBe(0);
    expect(nextRowIndex(null, "ArrowUp", 5)).toBe(4);
  });

  it("steps and wraps in both directions", () => {
    expect(nextRowIndex(0, "ArrowDown", 5)).toBe(1);
    expect(nextRowIndex(4, "ArrowDown", 5)).toBe(0);
    expect(nextRowIndex(0, "ArrowUp", 5)).toBe(4);
    expect(nextRowIndex(2, "ArrowUp", 5)).toBe(1);
  });

  it("a single row always resolves to itself", () => {
    expect(nextRowIndex(0, "ArrowDown", 1)).toBe(0);
    expect(nextRowIndex(null, "ArrowUp", 1)).toBe(0);
  });
});

describe("contactLinks", () => {
  it("reads the three contact hrefs from content.ts, no hardcoded addresses", () => {
    const l = contactLinks();
    expect(l.github).toMatch(/^https:\/\/github\.com\//);
    expect(l.linkedin).toMatch(/^https:\/\/www\.linkedin\.com\//);
    expect(l.email).toMatch(/^mailto:/);
  });
});
