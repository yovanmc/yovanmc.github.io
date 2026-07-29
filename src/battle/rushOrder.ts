// Pinned M6 boss-rush constants, split out from engine.ts so they can be
// imported WITHOUT dragging the battle engine's runtime (battleReduce,
// initBattle, and their circular value-dependency on bosses/alertStorm.ts)
// into whatever imports them. This matters because src/battle/bootParams.ts
// is imported eagerly by App.tsx (it parses dev capture keys before the
// lazy battle chunk loads) — "the battle chunk stays out of the landing
// bundle" is a standing spec invariant (see App.tsx's `lazy(() =>
// import("./battle/BattleScene"))`). Measured: importing RUSH_ORDER straight
// from engine.ts pulled the WHOLE engine+alertStorm module pair into the
// landing bundle (Rollup couldn't tree-shake across the cycle) for +4.95 kB;
// importing from this leaf module (no other imports, nothing to cycle with)
// keeps the landing bundle at its pre-M6 baseline.
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-1a task 5.

export const ALERT_STORM_ID = "alert-storm";
export const CASCADE_ID = "cascade";
/** M6 PR-2 task 3 (pass-2 J5): landed here, not task 4 — bosses/silentFailure.ts
 * re-exports this the way bosses/cascade.ts re-exports CASCADE_ID, so deferring
 * it to task 4 would fail task 3's own `npx tsc -b` gate on an unresolved
 * export. Only the IMPLEMENTED_BOSSES append stays in task 4. */
export const SILENT_FAILURE_ID = "silent-failure";

/** Pinned boss-rush order (M6 plan §Cross-boss architecture). Fixed forever —
 * later PRs only ever read this, never reorder it. */
export const RUSH_ORDER: readonly string[] = [
  ALERT_STORM_ID,
  CASCADE_ID,
  "silent-failure",
  "imposter-syndrome",
];

/** Prefix of RUSH_ORDER actually shipped in running code (pass-2 G1 — the
 * live-crash guard). Kit derivation, FIGHT's next-boss row, and the `boss=`
 * capture-key whitelist all intersect with this so a boss beaten ahead of its
 * own PR never grants a kit entry / route with no module behind it. Extend
 * this array, never remove from it, as each subsequent PR ships a boss.
 * M6 PR-1b task 3 grows it to include Cascade. */
export const IMPLEMENTED_BOSSES: readonly string[] = [ALERT_STORM_ID, CASCADE_ID, SILENT_FAILURE_ID];

/** Display names for the FIGHT submenu (M6 plan §App wiring, PR-1b task 5).
 * Pinned here rather than in src/battle/fight.ts so the chooser-row helper
 * stays a pure function of its inputs and App.tsx can read a name without
 * pulling in anything beyond this leaf module. Covers the full RUSH_ORDER,
 * not just IMPLEMENTED_BOSSES, ahead of PR-2/PR-3 needing the same names. */
export const BOSS_NAMES: Record<string, string> = {
  [ALERT_STORM_ID]: "Alert Storm",
  [CASCADE_ID]: "The Cascade",
  "silent-failure": "The Silent Failure",
  "imposter-syndrome": "Imposter Syndrome",
};
