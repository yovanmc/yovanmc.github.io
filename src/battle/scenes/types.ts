// Per-boss scene module interface (M6 plan §Scene generalization,
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-1a task 6).
// BattleScene.tsx is the shared shell: stage scaling, bars, floats, command
// menu, target cursor, pause/victory/defeat overlay CHROME, input tables,
// blip wiring. Everything boss-flavored lives in a module implementing
// `BossSceneModule` below: arena art, boss composition, plate copy, banner
// text, and victory/defeat copy. Type-only file — no runtime code, so it
// never appears in the coverage report.

import type { Bat, BattleState } from "../engine";
import type { Grid } from "../../generated/heroBattle";

/** Renderer fx flags driving this frame's boss composition. Alert Storm uses
 * all four (per-bat jitter on a fake-hit reshuffle, victory fall+dither, the
 * scream ripple); future boss modules read only the fields their renderer
 * needs. */
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
}

/** One module per boss id (§Scene generalization). */
export interface BossSceneModule {
  id: string;
  /** Both flutter phases, built once. */
  arena: [Grid, Grid];
  /** Compose the boss's on-stage grid for this frame from engine + fx state. */
  composeBoss(bats: Bat[], screaming: boolean, flutter: number, fx: SceneFx): Grid;
  plate: ScenePlate;
  /** "" when nothing to show this frame. */
  banner(state: BattleState): string;
  victoryCopy: VictoryCopy;
  defeatCopy: DefeatCopy;
}
