// Per-boss scene module interface. BattleScene.tsx is the shared shell (stage
// scaling, bars, floats, command menu, cursor, overlay chrome, input, blips);
// everything boss-flavored lives in a `BossSceneModule`. Type-only, so it
// never appears in coverage.

import type { BattleState, BossState } from "../engine";
import type { Grid } from "../../generated/heroBattle";

/** Renderer fx flags for this frame's boss composition. Alert Storm uses all
 * four; other modules read only what they need. */
export interface SceneFx {
  jitter?: boolean;
  ripple?: number;
  fall?: number;
  dither?: number;
}

export interface VictoryCopy {
  eyebrow: string;
  title: string;
  /** Shown only on the FIRST victory (a `forge` event fired this reduce). */
  forgeLines: string[];
  /** Shown on rematch victories (no forge event this reduce). */
  rematchLine: string;
  footer: string;
  cta: string;
}

export interface DefeatCopy {
  eyebrow: string;
  title: string;
  retryCta: string;
  leaveCta: string;
}

export interface ScenePlate {
  label: string;
  /** Shown instead of the HP bar while the boss's identity is still hidden. */
  hiddenLabel: string;
  footer(livingCount: number): string;
  /** Optional; falls back to `plate.label`. Silent Failure shows `VANISHED`
   * while hidden. */
  labelFor?(state: BattleState): string;
  /** Optional; falls back to `plate.footer(livingCount)`, which cannot express
   * a phase-dependent denominator (Imposter: 3 clone slots during CLONES, else
   * 1). That knowledge stays out of the shared shell. */
  footerFor?(state: BattleState): string;
}

/** One module per boss id. */
export interface BossSceneModule {
  id: string;
  /** Both flutter phases, built once. */
  arena: [Grid, Grid];
  /** Optional HP-linked arena (the Imposter's erosion stages); falls back to
   * `arena`. Called with the animation-lagged `shown.boss` so the death
   * animation shows the right stage. */
  arenaFor?(boss: BossState): [Grid, Grid];
  /** Optional stamp origin (default `BOSS_AT`), needed because `stampGrid`'s
   * clipping would eat the Imposter's leftward clone spread. A module that
   * implements it must compute its float and cursor anchors from this same
   * function, or the cursor targets art that isn't there. */
  stampOrigin?(boss: BossState): [number, number];
  /** Composes the boss's grid for this frame. Takes the whole `BossState`
   * because bosses need different state; each module narrows on `.kind`.
   * `screaming` is only ever true for Alert Storm. */
  composeBoss(boss: BossState, screaming: boolean, flutter: number, fx: SceneFx): Grid;
  plate: ScenePlate;
  /** "" when nothing to show this frame. */
  banner(state: BattleState): string;
  victoryCopy: VictoryCopy;
  defeatCopy: DefeatCopy;
}
