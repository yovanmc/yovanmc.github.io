// Static-markup checks on the desktop landing: the moon scene, the intro's
// effect on the rows, the copy tier and the reduced-motion branch. Live
// timing, input during the intro and layout are checked in a browser.
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Landing } from "../components/Landing";
import { footerEmail, footerGithub, footerLinkedin, roleLine, rowNewGame } from "../landingCopy";

const noop = () => {};
function render({ vw = 1440, vh = 900, hasProgress = false, introPlayed = false } = {}) {
  return renderToStaticMarkup(
    <Landing
      onPlay={noop}
      onContinue={noop}
      onBrowse={noop}
      hasProgress={hasProgress}
      vw={vw}
      vh={vh}
      playMove={noop}
      playEnter={noop}
      introPlayed={introPlayed}
      onIntroPlayed={noop}
    />,
  );
}
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktop landing markup", () => {
  it("renders the moon scene as decoration", () => {
    expect(render()).toMatch(/<div aria-hidden="true" data-landing-scene/);
  });

  it("disables every row while the intro has not played", () => {
    const html = render();
    expect((html.match(/data-landing-row/g) ?? []).length).toBe(3);
    expect((html.match(/data-landing-row[^>]*aria-disabled="true"/g) ?? []).length).toBe(3);
  });

  it("enables the rows once the intro has played", () => {
    expect(render({ introPlayed: true })).not.toContain("aria-disabled");
  });

  it("takes the copy tier the viewport fits", () => {
    expect(render()).toContain('data-tier="L"');
    expect(render({ vw: 1024, vh: 600 })).toContain('data-tier="S"');
  });

  it("sets the name on two lines and keeps it one heading reading Yovan Collins", () => {
    const html = render();
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1];
    expect(text(h1)).toBe("Yovan Collins");
    expect((h1.match(/<span/g) ?? []).length).toBe(2);
  });

  it("selects New game and draws one cursor beside it", () => {
    const html = render();
    const selected = [...html.matchAll(/<(button|a)[^>]*data-selected="true"[^>]*>([\s\S]*?)<\/\1>/g)];
    expect(selected.length).toBe(1);
    expect(text(selected[0][2])).toBe(rowNewGame);
    expect((html.match(/data-landing-cursor/g) ?? []).length).toBe(1);
  });

  it("shows the role line and footer labels from the landing copy", () => {
    const t = text(render());
    for (const s of [roleLine, footerGithub, footerLinkedin, footerEmail]) expect(t).toContain(s);
  });

  // Forced colors draws a backplate behind the name that is larger than its
  // lines. The role line and the rule paint above it, and the rule is art.
  it("keeps the role line and the rule above the name's backplate in forced colors", () => {
    const html = render();
    const role = html.match(/<div[^>]*style="([^"]*)"[^>]*><span aria-hidden="true"[^>]*><\/span><span>/)![1];
    expect(role).toMatch(/position:relative;?.*z-index:1/);
    const rule = html.match(/<div aria-hidden="true"[^>]*style="([^"]*height:12px[^"]*)"/)![1];
    expect(rule).toContain("z-index:1");
    expect(rule).toContain("forced-color-adjust:none");
  });

  it("mounts the entrance classes when motion is allowed", () => {
    expect(render()).toMatch(/class="lnd-in-/);
  });

  it("mounts no entrance class under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    expect(render()).not.toMatch(/lnd-in-/);
  });
});
