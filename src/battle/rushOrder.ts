// Boss-rush constants, kept out of engine.ts so bootParams.ts (loaded eagerly
// by App.tsx) can import them without pulling the engine into the landing
// bundle: Rollup cannot tree-shake across the engine<->alertStorm cycle. This
// is a leaf module with no imports.

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

/** The prefix of RUSH_ORDER with a boss module behind it. Kit derivation,
 * FIGHT's rows and the `boss=` whitelist all intersect with it, so no id
 * grants a kit entry or route without a module. Append only. */
export const IMPLEMENTED_BOSSES: readonly string[] = [
  ALERT_STORM_ID,
  CASCADE_ID,
  SILENT_FAILURE_ID,
  IMPOSTER_ID,
];

/** FIGHT display names, for the full RUSH_ORDER. Here so App.tsx can read a
 * name without importing anything beyond this leaf module. */
export const BOSS_NAMES: Record<string, string> = {
  [ALERT_STORM_ID]: "Alert Storm",
  [CASCADE_ID]: "The Cascade",
  "silent-failure": "The Silent Failure",
  "imposter-syndrome": "Imposter Syndrome",
};
