// Punctuation rule over the site shell: no em dash
// (U+2014) or en dash (U+2013) anywhere in index.html, public/404.html,
// vite.config.ts, or src/landingCopy.ts, including comments. Semicolons are
// NOT checked file-wide here (vite.config.ts and landingCopy.ts are code, so
// every statement-terminating semicolon would trip a naive scan) - the
// scene-copy semicolon gate lives at src/battle/scenes/punctuation.test.ts
// instead, scoped to actual copy string values. Banned chars are built via
// String.fromCharCode (never a literal glyph or escape sequence in source)
// so this file never contains a banned literal itself.
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

  // Vacuity check: prove the rule actually fires on a planted dash, so an
  // empty or miswired regex can't pass this suite silently.
  it("vacuity check: a planted em dash IS caught by the rule", () => {
    expect(BANNED.test(`placeholder ${EM_DASH} text`)).toBe(true);
  });
  it("vacuity check: a planted en dash IS caught by the rule", () => {
    expect(BANNED.test(`placeholder ${EN_DASH} text`)).toBe(true);
  });

  it("index.html <title> has no dash", () => {
    const m = read("index.html").match(/<title>([^<]*)<\/title>/);
    expect(m).not.toBeNull();
    expect(BANNED.test(m![1])).toBe(false);
  });

  it("index.html description has no dash", () => {
    const m = read("index.html").match(/<meta name="description" content="([^"]*)"/);
    expect(m).not.toBeNull();
    expect(BANNED.test(m![1])).toBe(false);
  });
});
