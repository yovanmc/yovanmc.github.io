// Static-markup gate over the site's crawlable links. Rendered with
// renderToStaticMarkup (no jsdom, this repo's vitest config runs a node
// environment), so effects never run: every component exercised here only
// touches window/document inside useEffect, never at module scope or during
// render.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BrowseIndex } from "../components/BrowseIndex";
import { CaseStudyPage } from "../components/CaseStudyPage";
import { CATS } from "../content";
import { buildEntryTitle, buildEntryMeta, backLabel } from "../buildCopy";

function count(html: string, tagOpen: RegExp): number {
  return (html.match(tagOpen) ?? []).length;
}

const H1 = /<h1[ >]/g;
const H2 = /<h2[ >]/g;

describe("BrowseIndex static markup", () => {
  const html = renderToStaticMarkup(<BrowseIndex isMobile={false} onItem={() => {}} />);

  it("renders exactly one h1", () => {
    expect(count(html, H1)).toBe(1);
  });

  it("every project/experience item with a slug links to its case-study shell path", () => {
    let checked = 0;
    for (const cat of CATS) {
      if (cat.key === "contact") continue;
      const prefix = cat.key === "experience" ? "/experience/" : "/work/";
      for (const item of cat.items) {
        if (!item.slug) continue;
        expect(html).toContain(`href="${prefix}${item.slug}/"`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("every contact item with a real link renders as an anchor to that link", () => {
    const contact = CATS.find((c) => c.key === "contact")!;
    let checked = 0;
    for (const item of contact.items) {
      if (item.link && item.link !== "#") {
        expect(html).toContain(`href="${item.link}"`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("the only anchor to / is the back control, never a slugless item falling back to the root", () => {
    const rootAnchors = html.match(/<a[^>]*\shref="\/"[^>]*>[\s\S]*?<\/a>/g) ?? [];
    expect(rootAnchors.length).toBe(1);
    expect(rootAnchors[0]).toContain(backLabel);
  });

  it("the build page renders as a full entry row: an anchor to /build/ carrying its title", () => {
    const anchor = html.match(/<a[^>]*href="\/build\/"[^>]*>[\s\S]*?<\/a>/);
    expect(anchor).not.toBeNull();
    expect(anchor![0]).toContain(buildEntryTitle);
    expect(anchor![0]).toContain(buildEntryMeta);
  });

  it("every target=_blank anchor also carries rel=noopener noreferrer", () => {
    const blankAnchors = html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
    expect(blankAnchors.length).toBeGreaterThan(0);
    for (const tag of blankAnchors) {
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });
});

describe("CaseStudyPage static markup", () => {
  for (const cat of CATS) {
    if (cat.key === "contact") continue;
    const ri = CATS.indexOf(cat);
    cat.items.forEach((item, si) => {
      if (!item.slug) return;
      const html = renderToStaticMarkup(<CaseStudyPage page={{ ri, si }} isMobile={false} onClose={() => {}} />);

      describe(item.slug!, () => {
        it("has zero h1 and exactly one h2 (CaseStudyPage stays a dialog, not <main>)", () => {
          expect(count(html, H1)).toBe(0);
          expect(count(html, H2)).toBe(1);
        });

        it("the outbound repo/announcement button, if present, is a real anchor with rel=noopener noreferrer", () => {
          const ext = item.repo ?? item.announcement?.url;
          if (!ext) return;
          expect(html).toContain(`href="${ext}"`);
          const tag = html.match(new RegExp(`<a\\b[^>]*href="${ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`));
          expect(tag).not.toBeNull();
          expect(tag![0]).toContain('target="_blank"');
          expect(tag![0]).toContain('rel="noopener noreferrer"');
        });

        it("every source, if any, is a real anchor with rel=noopener noreferrer", () => {
          for (const s of item.sources ?? []) {
            expect(html).toContain(`href="${s.url}"`);
          }
          const sourceAnchors = html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
          for (const tag of sourceAnchors) {
            expect(tag).toContain('rel="noopener noreferrer"');
          }
        });
      });
    });
  }
});

describe("BrowseIndex back control", () => {
  const html = renderToStaticMarkup(<BrowseIndex isMobile={false} onItem={() => {}} />);

  it("renders a real anchor back to the landing page carrying the back label", () => {
    const anchor = html.match(/<a[^>]*href="\/"[^>]*>[\s\S]*?<\/a>/);
    expect(anchor).not.toBeNull();
    expect(anchor![0]).toContain(backLabel);
  });
});
