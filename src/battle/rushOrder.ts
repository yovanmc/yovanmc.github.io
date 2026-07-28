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

/** Pinned boss-rush order (M6 plan §Cross-boss architecture). Fixed forever —
 * later PRs only ever read this, never reorder it. */
export const RUSH_ORDER: readonly string[] = [
  ALERT_STORM_ID,
  "cascade",
  "silent-failure",
  "imposter-syndrome",
];

/** Prefix of RUSH_ORDER actually shipped in running code (pass-2 G1 — the
 * live-crash guard). Kit derivation, FIGHT's next-boss row, and the `boss=`
 * capture-key whitelist all intersect with this so a boss beaten ahead of its
 * own PR never grants a kit entry / route with no module behind it. Extend
 * this array, never remove from it, as each subsequent PR ships a boss. */
export const IMPLEMENTED_BOSSES: readonly string[] = [ALERT_STORM_ID];
