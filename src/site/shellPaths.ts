import { CATS } from "../content";

/**
 * Every path share-shells (vite.config.ts) writes an index.html shell for:
 * each project/experience slug plus /work/ and /build/. The single list the
 * build-facts `shareShells` count and sitemapUrls() read, so neither drifts
 * from what the plugin writes.
 *
 * Its own module because tools/build-facts.ts imports it, and importing it
 * through vite.config.ts (which imports build-facts) would be circular.
 * vite.config.ts re-exports it for tests.
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
