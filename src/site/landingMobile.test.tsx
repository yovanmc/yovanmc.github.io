// Phone landing markup is frozen: below the 760 px breakpoint the landing
// renders exactly the fixtures captured before the desktop landing changed.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Landing } from "../components/Landing";

const noop = () => {};
const fixture = (name: string) =>
  readFileSync(resolve(__dirname, "__fixtures__", name), "utf8").replace(/\r\n/g, "\n").trimEnd();

describe("phone landing markup", () => {
  it.each([
    [390, false, "landing-mobile.390.fresh.html"],
    [390, true, "landing-mobile.390.progress.html"],
    [759, false, "landing-mobile.759.fresh.html"],
    [759, true, "landing-mobile.759.progress.html"],
  ])("at %ipx with progress %s matches %s", (vw, hasProgress, name) => {
    const html = renderToStaticMarkup(
      <Landing
        onPlay={noop}
        onContinue={noop}
        onBrowse={noop}
        hasProgress={hasProgress}
        vw={vw}
        vh={844}
        playMove={noop}
        playEnter={noop}
      />,
    );
    expect(html).toBe(fixture(name));
  });
});
