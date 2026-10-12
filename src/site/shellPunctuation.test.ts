// No em dash (U+2014) or en dash (U+2013) anywhere in index.html,
// public/404.html, vite.config.ts, src/landingCopy.ts or src/buildCopy.ts,
// comments included.
// Semicolons are not checked file-wide (code uses them); the copy semicolon
// gate is src/battle/scenes/punctuation.test.ts. Both rules live in
// src/testing/punctuation.ts, and the vacuity checks below cover every gate
// that imports them.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COPY_RULE, DASH_RULE, EM_DASH, EN_DASH, SEMICOLON } from "../testing/punctuation";

const FILES = ["index.html", "public/404.html", "vite.config.ts", "src/landingCopy.ts", "src/buildCopy.ts"];

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("shell punctuation gate", () => {
  for (const file of FILES) {
    it(`${file} has no em dash or en dash anywhere`, () => {
      expect(DASH_RULE.test(read(file))).toBe(false);
    });
  }

  // The share-shell build in vite.config.ts rewrites these two tags with a
  // .replace that silently does nothing when a tag is missing or reshaped.
  it.each([
    { tag: "title", pattern: /<title>[^<]*<\/title>/ },
    { tag: "description meta", pattern: /<meta name="description"[^>]*\/>/ },
  ])("index.html carries the $tag the share shells rewrite", ({ pattern }) => {
    expect(read("index.html")).toMatch(pattern);
  });

  // Proves each rule fires on a planted character, so a miswired regex cannot
  // pass silently.
  it.each([
    { rule: "dash rule", regex: DASH_RULE, name: "em dash", char: EM_DASH },
    { rule: "dash rule", regex: DASH_RULE, name: "en dash", char: EN_DASH },
    { rule: "copy rule", regex: COPY_RULE, name: "em dash", char: EM_DASH },
    { rule: "copy rule", regex: COPY_RULE, name: "en dash", char: EN_DASH },
    { rule: "copy rule", regex: COPY_RULE, name: "semicolon", char: SEMICOLON },
  ])("vacuity check: a planted $name IS caught by the $rule", ({ regex, char }) => {
    expect(regex.test(`placeholder ${char} text`)).toBe(true);
  });
});
