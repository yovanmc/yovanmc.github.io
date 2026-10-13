// The case study page stays mounted while closed. Its background glints must
// not keep animating under the landing then.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CaseStudyPage } from "../components/CaseStudyPage";

const glintStates = (html: string) =>
  [...html.matchAll(/animation:twinkle[^;"]*;animation-play-state:(\w+)/g)].map((m) => m[1]);

describe("case study glints", () => {
  it("pause while the page is closed", () => {
    const states = glintStates(renderToStaticMarkup(<CaseStudyPage page={null} isMobile={false} onClose={() => {}} />));
    expect(states.length).toBe(26);
    expect(new Set(states)).toEqual(new Set(["paused"]));
  });

  it("run while the page is open", () => {
    const states = glintStates(renderToStaticMarkup(<CaseStudyPage page={{ ri: 0, si: 0 }} isMobile={false} onClose={() => {}} />));
    expect(states.length).toBe(26);
    expect(new Set(states)).toEqual(new Set(["running"]));
  });
});
