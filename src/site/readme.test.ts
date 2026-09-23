// Every backticked repo path in README.md must exist on disk, and the README
// follows the shell punctuation rule (no em dash, no en dash).
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);
const BANNED = new RegExp(`[${EM_DASH}${EN_DASH}]`);

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

/** "Looks like a repo path": no spaces (rules out prose and commands with
 * arguments), no URL scheme, and a slash or a file extension. */
function looksLikeRepoPath(text: string): boolean {
  if (/\s/.test(text)) return false;
  if (/^[a-z]+:\/\//.test(text)) return false;
  if (text.startsWith("/")) return false; // an app route (e.g. "/work/"), not a filesystem path
  return text.includes("/") || /\.[A-Za-z0-9]{1,6}$/.test(text);
}

describe("README", () => {
  const readme = read("README.md");
  // Strip fenced blocks first, or a ``` fence reads as three backticks and
  // the regex swallows the whole block as one bogus "path".
  const proseOnly = readme.replace(/```[\s\S]*?```/g, "");

  it("has no em dash or en dash anywhere", () => {
    expect(BANNED.test(readme)).toBe(false);
  });

  it("every backticked repo path exists on disk", () => {
    const backticked = proseOnly.match(/`([^`]+)`/g) ?? [];
    let checked = 0;
    for (const raw of backticked) {
      const text = raw.slice(1, -1);
      if (!looksLikeRepoPath(text)) continue;
      checked++;
      expect(existsSync(resolve(process.cwd(), text)), `README references \`${text}\`, which does not exist`).toBe(true);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("does not bake in a test count", () => {
    expect(readme).not.toMatch(/\b\d+\s+tests?\b/i);
  });
});
