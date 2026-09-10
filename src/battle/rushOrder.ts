// Pinned boss-rush constants, kept out of engine.ts so they can be imported
// WITHOUT dragging the battle engine's runtime (battleReduce, initBattle, and
// their circular value-dependency on bosses/alertStorm.ts) along with them.
// This matters because src/battle/bootParams.ts is imported eagerly by
// App.tsx (it parses dev capture keys before the lazy battle chunk loads) and
// the battle chunk has to stay out of the landing bundle (see App.tsx's
// `lazy(() => import("./battle/BattleScene"))`). Measured: importing
// RUSH_ORDER straight from engine.ts pulled the whole engine+alertStorm module
// pair into the landing bundle (Rollup cannot tree-shake across the cycle) for
// +4.95 kB; importing from this leaf module (no imports of its own, nothing to
// cycle with) leaves the landing bundle at its baseline.

export const ALERT_STORM_ID = "alert-storm";
export const CASCADE_ID = "cascade";
export const SILENT_FAILURE_ID = "silent-failure";
export const IMPOSTER_ID = "imposter-syndrome";

/** Pinned boss-rush order. Read-only: nothing reorders it. */
export const RUSH_ORDER: readonly string[] = [
  ALERT_STORM_ID,
  CASCADE_ID,
  "silent-failure",
  "imposter-syndrome",
];

/** Prefix of RUSH_ORDER that has a boss module behind it. Kit derivation,
 * FIGHT's next-boss row, and the `boss=` capture-key whitelist all intersect
 * with this, so a boss id can never grant a kit entry or a route with no
 * module to load. Append to this array as each boss lands, never remove. */
export const IMPLEMENTED_BOSSES: readonly string[] = [
  ALERT_STORM_ID,
  CASCADE_ID,
  SILENT_FAILURE_ID,
  IMPOSTER_ID,
];

/** Display names for the FIGHT submenu. They live here rather than in
 * src/battle/fight.ts so the chooser-row helper stays a pure function of its
 * inputs and App.tsx can read a name without pulling in anything beyond this
 * leaf module. Covers the full RUSH_ORDER, not just IMPLEMENTED_BOSSES. */
export const BOSS_NAMES: Record<string, string> = {
  [ALERT_STORM_ID]: "Alert Storm",
  [CASCADE_ID]: "The Cascade",
  "silent-failure": "The Silent Failure",
  "imposter-syndrome": "Imposter Syndrome",
};
