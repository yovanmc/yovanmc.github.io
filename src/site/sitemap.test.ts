// sitemap.xml must match the shells the build writes: sitemapUrls() is the
// one list the plugin and this test read, /build/ included.
import { describe, expect, it } from "vitest";
import { sitemapUrls, shellPaths } from "../../vite.config";
import { CATS } from "../content";

describe("sitemap urls", () => {
  it("lists the root and browse shells", () => {
    const urls = sitemapUrls();
    expect(urls).toContain("https://yovanmc.github.io/");
    expect(urls).toContain("https://yovanmc.github.io/work/");
  });

  it("lists the build shell", () => {
    const urls = sitemapUrls();
    expect(urls).toContain("https://yovanmc.github.io/build/");
  });

  it("lists every project/experience slug's shell", () => {
    const urls = sitemapUrls();
    let checked = 0;
    for (const cat of CATS) {
      if (cat.key === "contact") continue;
      const prefix = cat.key === "experience" ? "experience" : "work";
      for (const item of cat.items) {
        if (!item.slug) continue;
        expect(urls).toContain(`https://yovanmc.github.io/${prefix}/${item.slug}/`);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("never lists a contact item (contact has no shells)", () => {
    const urls = sitemapUrls();
    const contactCat = CATS.find((c) => c.key === "contact");
    expect(contactCat).toBeDefined();
    for (const item of contactCat!.items) {
      expect(urls.some((u) => item.slug && u.includes(`/${item.slug}/`))).toBe(false);
    }
  });
});

// Pure: asserts on the same list computeBuildFacts's shareShells count reads.
describe("shellPaths", () => {
  it("includes /build/ and /work/", () => {
    const paths = shellPaths();
    expect(paths).toContain("/build/");
    expect(paths).toContain("/work/");
  });

  it("has one entry per project/experience slug plus browse and build", () => {
    let slugCount = 0;
    for (const cat of CATS) {
      if (cat.key === "contact") continue;
      for (const item of cat.items) if (item.slug) slugCount++;
    }
    expect(shellPaths()).toHaveLength(slugCount + 2);
  });
});
