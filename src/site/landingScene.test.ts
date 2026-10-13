// The landing scene enters only through canon extraction. These checks pin
// what the extracted module must carry: the whole scene, the loop budget and
// only the landing's own names.
import { describe, expect, it } from "vitest";
import { landingAmbientLoops, landingSceneHtml, landingSequenceCss } from "../generated/landingScene.js";

const infiniteNames = (html: string) =>
  [...html.matchAll(/animation:\s*([^;"]*)/g)]
    .flatMap((m) => m[1].split(/,(?![^(]*\))/))
    .filter((part) => /\binfinite\b/.test(part))
    .map((part) => part.trim().split(/\s+/)[0]);

/** Ids, classes, keyframes and animation names that do not start with the
 * landing's prefixes (`lnd` for the scene, `lnq` for the intro sequence). */
const foreignNames = (html: string, css: string) => {
  const both = html + css;
  const names = [
    ...[...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
    ...[...html.matchAll(/\bclass="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)),
    ...[...both.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
    ...[...both.matchAll(/animation(?:-name)?:\s*([^;"}]*)/g)].flatMap((m) =>
      m[1].split(/,(?![^(]*\))/).map((part) => part.trim().split(/\s+/)[0]),
    ),
    ...[...css.matchAll(/[.#]([A-Za-z_][\w-]*)/g)].map((m) => m[1]),
  ];
  return [...new Set(names)].filter((n) => n && !/^ln[dq]/.test(n));
};

describe("landing scene module", () => {
  it("carries the whole scene: every layer and its gradient defs", () => {
    expect((landingSceneHtml.match(/<svg[\s>]/g) ?? []).length).toBeGreaterThanOrEqual(19);
    expect(landingSceneHtml).toContain('id="lnd-moon-fill"');
    expect(landingSceneHtml.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("names at most twelve ambient loops, each defined in the sequence CSS", () => {
    expect(landingAmbientLoops.length).toBeLessThanOrEqual(12);
    for (const name of landingAmbientLoops) expect(landingSequenceCss).toContain(`@keyframes ${name}{`);
  });

  it("runs only named ambient loops in the scene, eleven of them, leaving one for the cursor", () => {
    const names = infiniteNames(landingSceneHtml);
    expect(names.length).toBe(11);
    for (const n of names) expect(landingAmbientLoops).toContain(n);
    expect(landingAmbientLoops).toContain("lndCursor");
  });

  it("names every id, class, keyframe and animation with the landing's own prefixes", () => {
    expect(foreignNames(landingSceneHtml, landingSequenceCss)).toEqual([]);
  });

  it("carries no comments, so names are the only words the extraction keeps", () => {
    expect(landingSceneHtml).not.toContain("<!--");
    expect(landingSequenceCss).not.toContain("/*");
  });

  it("flags a name outside those prefixes", () => {
    expect(foreignNames('<div id="lnd-a" class="lnd-b x-c"></div>', "@keyframes lnqA{} .lnd-b{animation: y-d 1s}")).toEqual([
      "x-c",
      "y-d",
    ]);
  });
});
