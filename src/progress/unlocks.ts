// Unlock map (M4 task B1). Turns `defeatedBosses` into "which project slugs
// may the play path open" (D6, D8). A leaf module: no content.ts import here
// so content.ts (the owner-voice surface) stays untouched by this milestone
// — unlocks.ts is keyed by slug strings, checked against real content only
// by the test file. See unlocks.test.ts for the CATS cross-check.

/** Slugs visible in the play path before any boss is beaten (D4/D8). */
export const SEED_UNLOCKED: readonly string[] = ["mia", "backend-harness"];

/** Boss id -> the project slug beating it reveals (D8, owner-overridable). */
export const UNLOCK_BY_BOSS: Readonly<Record<string, string>> = {
  "alert-storm": "observability-by-default",
  cascade: "notification-dispatch",
  "silent-failure": "the-failure-that-left-no-logs",
  "imposter-syndrome": "curio",
};

/** Every slug the play path may open, given progression. */
export function unlockedSlugs(defeated: string[]): Set<string> {
  const set = new Set<string>(SEED_UNLOCKED);
  for (const bossId of defeated) {
    const slug = UNLOCK_BY_BOSS[bossId];
    if (slug) set.add(slug);
  }
  return set;
}

/** True when this item is gated at all. Non-project items never are (D3):
 * the 2 experience items and 3 contact items are never locked in either
 * path. An undefined slug (contact items have none) is never gateable. */
export function isGateable(categoryKey: string, slug: string | undefined): boolean {
  return categoryKey === "projects" && slug !== undefined;
}
