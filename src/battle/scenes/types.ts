// Per-boss scene module interface. BattleScene.tsx is the shared shell: stage
// scaling, bars, floats, command menu, target cursor, pause/victory/defeat
// overlay CHROME, input tables, blip wiring. Everything boss-flavored lives in
// a module implementing `BossSceneModule` below: arena art, boss composition,
// plate copy, banner text, and victory/defeat copy. Type-only file, no runtime
// code, so it never appears in the coverage report.

import type { BattleState, BossState } from "../engine";
import type { Grid } from "../../generated/heroBattle";

/** Renderer fx flags driving this frame's boss composition. Alert Storm uses
 * all four (per-bat jitter on a fake-hit reshuffle, victory fall+dither, the
 * scream ripple); other boss modules read only the fields their renderer
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
  /** OPTIONAL, additive. `BattleScene` renders
   * `plate.labelFor?.(state) ?? plate.label`. Alert Storm and Cascade do not
   * implement it and keep the static `plate.label`. Silent Failure implements
   * it (name while embodied, `VANISHED` while hidden) since its plate label
   * changes with phase while the HP bar itself stays visible throughout
   * (`revealBoss` is always true for that boss, so there is no label/HP
   * coupling to decouple). */
  labelFor?(state: BattleState): string;
  /** OPTIONAL, additive. `BattleScene` renders
   * `plate.footerFor?.(state) ?? plate.footer(livingCount)`. The static
   * `footer(livingCount)` signature can't express a phase-dependent
   * DENOMINATOR (the Imposter has 3 targetable clone slots during CLONES and
   * 1 in every other phase), and the denominator is scene knowledge that must
   * not leak into the shared shell. Alert Storm, Cascade and Silent Failure do
   * not implement it and keep the static footer. */
  footerFor?(state: BattleState): string;
}

/** One module per boss id. */
export interface BossSceneModule {
  id: string;
  /** Both flutter phases, built once. */
  arena: [Grid, Grid];
  /** OPTIONAL, additive. The static `arena` property can't express an HP-linked
   * arena (the Imposter's erosion stages), so `BattleScene` renders
   * `(scene.arenaFor?.(shown.boss) ?? scene.arena)[flutter]` instead, keyed on
   * `shown.boss` rather than the live `state.boss` so the death-animation
   * window (which keeps composing off `shown`, see sceneGate.ts's
   * `shouldComposeBoss`) shows the correct stage throughout. Modules that don't
   * implement it keep the static arena. */
  arenaFor?(boss: BossState): [Grid, Grid];
  /** OPTIONAL, additive. `composeBoss`'s Grid is stamped TOP-LEFT at this
   * origin instead of the bare `BOSS_AT` constant when present (default
   * `BOSS_AT`), which the Imposter's leftward clone spread needs because
   * `stampGrid`'s stage-bounds clipping would otherwise silently eat it. The
   * shared-origin contract: a module implementing this MUST have its own
   * `batCell`/`cursorCell`/float-anchor arms compute from this SAME function,
   * never the bare `BOSS_AT` constant, or the cursor targets art that isn't
   * there. Modules that don't implement it stamp at `BOSS_AT`. */
  stampOrigin?(boss: BossState): [number, number];
  /** Compose the boss's on-stage grid for this frame from engine + fx state.
   * Takes the whole `BossState` rather than something Alert-Storm-specific like
   * `bats: Bat[]`, so a boss whose per-frame composition needs other state
   * (Cascade reads `nodes`/`carrier`/`lastHop`, not bats) can implement the
   * same interface. Each module narrows on `.kind` internally; `screaming`
   * stays a plain boolean since it is meaningless outside Alert Storm (always
   * `false` there, see BattleScene.tsx). */
  composeBoss(boss: BossState, screaming: boolean, flutter: number, fx: SceneFx): Grid;
  plate: ScenePlate;
  /** "" when nothing to show this frame. */
  banner(state: BattleState): string;
  victoryCopy: VictoryCopy;
  defeatCopy: DefeatCopy;
}
