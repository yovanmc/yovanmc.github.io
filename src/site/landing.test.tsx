// Static-markup gate over the letter-with-cursor-menu Landing. Same
// renderToStaticMarkup convention as links.test.tsx: no jsdom, node env.
// Keyboard arithmetic is covered by landingRows.test.ts. The live focus/keys
// contract (arrows, Enter with nothing focused, hover) is not covered here.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Landing } from "../components/Landing";
import { bioLine, phoneNote, rowContinue, rowNewGame } from "../landingCopy";
import { contactLinks } from "./landingRows";

const noop = () => {};
function render(hasProgress: boolean, vw = 1440) {
  return renderToStaticMarkup(
    <Landing
      onPlay={noop}
      onContinue={noop}
      onBrowse={noop}
      hasProgress={hasProgress}
      vw={vw}
      vh={900}
      playMove={noop}
      playEnter={noop}
    />,
  );
}
// the cursor <span> precedes the label inside every row
const buttonWith = (label: string) => new RegExp(`<button[^>]*>[\\s\\S]*?${label}<\\/button>`);

describe("Landing static markup", () => {
  const html = render(false);

  it("renders exactly one h1 and it holds the name Yovan Collins", () => {
    expect((html.match(/<h1[ >]/g) ?? []).length).toBe(1);
    const m = html.match(/<h1[^>]*>([^<]*)<\/h1>/);
    expect(m![1]).toBe("Yovan Collins");
  });

  it("shows the bio verbatim", () => {
    expect(html.replace(/&#x27;/g, "'")).toContain(bioLine);
  });

  it("wraps the menu in a labelled nav", () => {
    expect(html).toMatch(/<nav[^>]*aria-label="Start"/);
  });

  it("New game is a button and Continue is absent for a fresh visitor", () => {
    expect(html).toMatch(buttonWith(rowNewGame));
    expect(html).not.toContain(rowContinue);
  });

  it("Continue renders as a button when there is progress", () => {
    expect(render(true)).toMatch(buttonWith(rowContinue));
  });

  it("the work and contact rows are real anchors, and the menu has no build row", () => {
    expect(html).toMatch(/<a[^>]*href="\/work\/"/);
    expect(html).not.toMatch(/<a[^>]*href="\/build\/"/);
    expect(html).toMatch(/<a[^>]*href="mailto:/);
  });

  it("footer carries the three contact anchors from content.ts", () => {
    const l = contactLinks();
    for (const href of [l.github, l.linkedin, l.email]) expect(html).toContain(`href="${href}"`);
  });

  it("has no evidence cards, no PORTFOLIO eyebrow, no data-landing-cta", () => {
    expect(html).not.toContain("PORTFOLIO");
    expect(html).not.toContain("data-landing-cta");
    expect(html).not.toContain("Press Enter");
  });

  it("phone shows the desktop note, desktop does not", () => {
    expect(render(false, 390)).toContain(phoneNote);
    expect(html).not.toContain(phoneNote);
  });

  it("nothing is autofocused; the cursor glyph rests on New game and only there", () => {
    expect(html).not.toMatch(/autofocus/);
    // each row = <button|a ...><span aria-hidden style="...color:X...">▸</span>label
    const glyphColors = [...html.matchAll(/<span aria-hidden="true" style="[^"]*?color:([^;"]+)/g)].map((m) => m[1]);
    expect(glyphColors.length).toBe(3);
    expect(glyphColors[0]).toBe("#7fb0ff");
    expect(glyphColors.slice(1)).toEqual(["transparent", "transparent"]);
  });
});
