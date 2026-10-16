import { describe, expect, it } from "vitest";
import { contactLinks, landingRows, menuKeyAction, nextRowIndex } from "./landingRows";
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
  it.each([
    { name: "nothing focused: ArrowDown lands on the first row", from: null, key: "ArrowDown", count: 5, expected: 0 },
    { name: "nothing focused: ArrowUp lands on the last row", from: null, key: "ArrowUp", count: 5, expected: 4 },
    { name: "steps forward", from: 0, key: "ArrowDown", count: 5, expected: 1 },
    { name: "wraps forward past the last row", from: 4, key: "ArrowDown", count: 5, expected: 0 },
    { name: "wraps backward past the first row", from: 0, key: "ArrowUp", count: 5, expected: 4 },
    { name: "steps backward", from: 2, key: "ArrowUp", count: 5, expected: 1 },
    { name: "a single row resolves to itself going down", from: 0, key: "ArrowDown", count: 1, expected: 0 },
    { name: "a single row resolves to itself going up from nothing focused", from: null, key: "ArrowUp", count: 1, expected: 0 },
  ] as const)("$name", ({ from, key, count, expected }) => {
    expect(nextRowIndex(from, key, count)).toBe(expected);
  });
});

describe("menuKeyAction", () => {
  it.each([
    { name: "Enter with nothing focused starts the game", key: "Enter", nothingFocused: true, blocked: false, expected: "play" },
    { name: "Enter with nothing focused does nothing while the menu is blocked", key: "Enter", nothingFocused: true, blocked: true, expected: "none" },
    { name: "Enter on a focused row is left to the row", key: "Enter", nothingFocused: false, blocked: false, expected: "none" },
    { name: "arrows move the focus, blocked or not: ArrowDown", key: "ArrowDown", nothingFocused: true, blocked: false, expected: "ArrowDown" },
    { name: "arrows move the focus, blocked or not, old key names included: Up", key: "Up", nothingFocused: false, blocked: true, expected: "ArrowUp" },
    { name: "other keys do nothing: a", key: "a", nothingFocused: true, blocked: false, expected: "none" },
    { name: "other keys do nothing: ArrowLeft", key: "ArrowLeft", nothingFocused: true, blocked: false, expected: "none" },
  ])("$name", ({ key, nothingFocused, blocked, expected }) => {
    expect(menuKeyAction(key, nothingFocused, blocked)).toBe(expected);
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
