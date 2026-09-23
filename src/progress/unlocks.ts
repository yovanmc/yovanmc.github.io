// Maps `defeatedBosses` to the project slugs the play path may open. Must not
// import content.ts: slugs are plain strings here, and unlocks.test.ts
// cross-checks them against CATS. battle/rushOrder is a leaf, so its
// BOSS_NAMES import is fine.
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

/** Only project items are ever gated; an undefined slug (contact items) never
 * is. */
export function isGateable(categoryKey: string, slug: string | undefined): boolean {
  return categoryKey === "projects" && slug !== undefined;
}

/** Reverse of UNLOCK_BY_BOSS, built once so the two maps can never drift. */
const BOSS_BY_SLUG: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(UNLOCK_BY_BOSS).map(([bossId, slug]) => [slug, bossId]),
);

/** The guarding boss's display name, or null when no boss gates the slug. */
export function guardingBoss(slug: string): string | null {
  const bossId = BOSS_BY_SLUG[slug];
  return bossId ? BOSS_NAMES[bossId] : null;
}
