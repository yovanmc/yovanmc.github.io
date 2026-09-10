// The reduced-motion dive is a purpose-built component, not a frozen copy of
// the cinematic. Mechanical gates here: the pure timeline, an opacity-only
// style contract, and one static-markup check that the station renders.
// Runtime behaviour (the actual cross-fade, onHandoff/onDone timing) is not
// unit-tested, the same way the full cinematic's own rAF loop is not.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DiveIntroReduced, REDUCED_STYLES, reducedDiveTimeline } from "../components/DiveIntro";

describe("reducedDiveTimeline", () => {
  it("handoff at 1250ms, done at 2500ms", () => {
    expect(reducedDiveTimeline()).toEqual({ handoffAtMs: 1250, doneAtMs: 2500 });
  });
});

describe("REDUCED_STYLES", () => {
  it("only ever mentions opacity in a transition/animation value, never transform/translate", () => {
    let checked = 0;
    for (const style of Object.values(REDUCED_STYLES)) {
      for (const [prop, val] of Object.entries(style)) {
        if (prop === "transition" || prop === "animation") {
          checked++;
          expect(String(val)).toMatch(/opacity/);
          expect(String(val)).not.toMatch(/transform|translate/i);
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("never references @keyframes (no animated-transform path exists to reference)", () => {
    expect(JSON.stringify(REDUCED_STYLES)).not.toMatch(/@keyframes/);
  });
});

describe("DiveIntroReduced static markup", () => {
  it("renders the station SVG exactly once", () => {
    const html = renderToStaticMarkup(<DiveIntroReduced onHandoff={() => {}} onDone={() => {}} onPlayFull={() => {}} />);
    const matches = html.match(/viewBox="-510 -510 1020 1020"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
