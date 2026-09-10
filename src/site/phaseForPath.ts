/**
 * The two PATH-ONLY phase decisions in App.tsx - decideBoot's initial-path
 * check and popstate's path arm - both
 * resolve a bare pathname to "browse" | "build" | null the same way. Pulled
 * out once so /build/ routes exactly like /work/ in both places without a
 * second hand-written copy of the path table to drift.
 *
 * Scope: path-only. It does NOT cover popstate's *resolved-page* branch
 * (statePhase === "play" ? "play" : "browse") - that one decides between
 * play/browse origin for a restored case-study page, not a phase from a bare
 * path, and stays untouched (pageForPath always resolves those, never this
 * function: deep links are always browse-origin).
 */
export function phaseForPath(path: string): "browse" | "build" | null {
  if (path === "/work" || path === "/work/") return "browse";
  if (path === "/browse" || path === "/browse/") return "browse"; // legacy path the index used to live at, old links still land on it
  if (path === "/build" || path === "/build/") return "build";
  return null;
}
