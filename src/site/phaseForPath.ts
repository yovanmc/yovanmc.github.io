/**
 * Resolves a bare pathname to "browse" | "build" | null for both path-only
 * decisions in App.tsx (decideBoot and popstate's path arm), so /build/
 * routes like /work/ without a second path table. Does not cover restored
 * case-study pages: pageForPath resolves those, always browse-origin.
 */
export function phaseForPath(path: string): "browse" | "build" | null {
  if (path === "/work" || path === "/work/") return "browse";
  if (path === "/browse" || path === "/browse/") return "browse"; // the index's old path, still linked
  if (path === "/build" || path === "/build/") return "build";
  return null;
}

/** Address-bar path for a restored deep link: the old /browse/ path becomes
 * /work/, everything else is kept. */
export function canonicalPath(path: string): string {
  if (path === "/browse" || path === "/browse/") return "/work/";
  return path;
}
