// Static-markup gate over the standalone LockedCaseStudy overlay. Same
// renderToStaticMarkup convention as src/site/links.test.tsx, no jsdom.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LockedCaseStudy } from "../components/LockedCaseStudy";
import { CATS } from "../content";
import { guardingBoss } from "../progress/unlocks";
import { readAnyway } from "../landingCopy";

const projects = CATS.find((c) => c.key === "projects")!;
const item = projects.items.find((it) => it.slug === "observability-by-default")!;
const boss = guardingBoss(item.slug!);

describe("LockedCaseStudy static markup", () => {
  const html = renderToStaticMarkup(
    <LockedCaseStudy
      item={item}
      catLabel={projects.label}
      isMobile={false}
      boss={boss}
      onReveal={() => {}}
      onClose={() => {}}
    />,
  );

  it("shows the real title, not a generic locked label", () => {
    expect(html).toContain(item.title);
  });

  it("names the guarding boss", () => {
    expect(boss).not.toBeNull();
    expect(html).toContain(boss!);
  });

  it("renders the read-it-anyway control", () => {
    expect(html).toContain(readAnyway);
  });

  it("the dialog's accessible name is the real title, not a generic locked label", () => {
    expect(html).toMatch(new RegExp(`aria-label="${item.title}"`));
  });
});
