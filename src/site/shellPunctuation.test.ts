// No em dash (U+2014) or en dash (U+2013) anywhere in index.html,
// public/404.html, vite.config.ts or src/landingCopy.ts, comments included.
// Semicolons are not checked file-wide (code uses them); the copy semicolon
// gate is src/battle/scenes/punctuation.test.ts. Banned chars are built with
// String.fromCharCode so this file never contains one.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const BANNED = new RegExp(`[${EM_DASH}${EN_DASH}]`);

const FILES = ["index.html", "public/404.html", "vite.config.ts", "src/landingCopy.ts", "src/buildCopy.ts"];

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("shell punctuation gate", () => {
  for (const file of FILES) {
    it(`${file} has no em dash or en dash anywhere`, () => {
      expect(BANNED.test(read(file))).toBe(false);
    });
  }

  // Proves the rule fires on a planted dash, so a miswired regex cannot pass
  // silently.
  it.each([
    { name: "em dash", char: EM_DASH },
    { name: "en dash", char: EN_DASH },
  ])("vacuity check: a planted $name IS caught by the rule", ({ char }) => {
    expect(BANNED.test(`placeholder ${char} text`)).toBe(true);
  });
});
