// Unlock map. Turns `defeatedBosses` into "which project slugs may the play
// path open". A leaf module: no content.ts import here, so unlocks.ts is keyed
// by slug strings and checked against real content only by the test file. See
// unlocks.test.ts for the CATS cross-check.
//
// BOSS_NAMES comes from battle/rushOrder for guardingBoss's display-name
// lookup. That module is a leaf too (no content.ts, no battle engine
// runtime): the "no content.ts import" rule above is specifically about
// content.ts, not a blanket ban on every other import.
import { BOSS_NAMES } from "../battle/rushOrder";

/** Slugs visible in the play path before any boss is beaten. */
export const SEED_UNLOCKED: readonly string[] = ["mia", "backend-harness"];

/** Boss id -> the project slug beating it reveals. */
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

/** True when this item is gated at all. Non-project items never are: the 2
 * experience items and 3 contact items are never locked in either
 * path. An undefined slug (contact items have none) is never gateable. */
export function isGateable(categoryKey: string, slug: string | undefined): boolean {
  return categoryKey === "projects" && slug !== undefined;
}

/** Reverse of UNLOCK_BY_BOSS, built once so the two maps can never drift. */
const BOSS_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(UNLOCK_BY_BOSS).map(([bossId, slug]) => [slug, bossId]),
);

/** The display name of the boss guarding this slug, or null when the slug
 * isn't gated by any boss (a seed-unlocked project, a non-project item, or
 * an unrecognized slug). Powers the sealed line's boss interpolation
 * everywhere a locked item's detail is shown. */
export function guardingBoss(slug: string): string | null {
  const bossId = BOSS_BY_SLUG[slug];
  return bossId ? BOSS_NAMES[bossId] : null;
}
