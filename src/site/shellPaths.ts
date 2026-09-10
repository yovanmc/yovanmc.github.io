import { CATS } from "../content";

/**
 * Every path share-shells (vite.config.ts) writes a duplicate index.html
 * shell for: every project/experience slug, plus
 * /work/ and /build/. The single list computeBuildFacts's `shareShells`
 * count and sitemapUrls() both read from, so a slug or a route added to
 * CATS/the phase list can never drift between what the plugin actually
 * writes and the numbers/urls that claim to describe it.
 *
 * Deliberately NOT imported by vite.config.ts's own shareShells() plugin
 * loop, which still writes per-item content (title/meta) it needs beyond a
 * bare path - vite.config.ts re-exports this function so tests can reach it
 * at `vite.config.ts`'s own module surface (same pattern as sitemapUrls()),
 * and does not need vite.config.ts itself to satisfy tools/build-facts.ts's
 * import, which would be circular (vite.config.ts already imports
 * tools/build-facts.ts).
 */
export function shellPaths(): string[] {
  const paths: string[] = [];
  for (const cat of CATS) {
    if (cat.key === "contact") continue;
    const prefix = cat.key === "experience" ? "experience" : "work";
    for (const item of cat.items) {
      if (!item.slug) continue;
      paths.push(`/${prefix}/${item.slug}/`);
    }
  }
  paths.push("/work/", "/build/");
  return paths;
}
