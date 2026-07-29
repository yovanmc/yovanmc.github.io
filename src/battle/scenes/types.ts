// Per-boss scene module interface (M6 plan §Scene generalization,
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-1a task 6).
// BattleScene.tsx is the shared shell: stage scaling, bars, floats, command
// menu, target cursor, pause/victory/defeat overlay CHROME, input tables,
// blip wiring. Everything boss-flavored lives in a module implementing
// `BossSceneModule` below: arena art, boss composition, plate copy, banner
// text, and victory/defeat copy. Type-only file — no runtime code, so it
// never appears in the coverage report.

import type { BattleState, BossState } from "../engine";
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
  /** M6 PR-2 task 6 (D3) — OPTIONAL, additive. `BattleScene` renders
   * `plate.labelFor?.(state) ?? plate.label`. Alert Storm and Cascade do not
   * implement this, so their rendered output and existing `plate.label`
   * property-access tests (`alertStorm.test.ts:99`, `punctuation.test.ts`)
   * stay byte-identical. Silent Failure implements it (name while embodied,
   * `VANISHED` while hidden) since its plate label changes with phase while
   * the HP bar itself stays visible throughout (`revealBoss` is always true
   * for this boss — there is no label/HP coupling to decouple, per D3). */
  labelFor?(state: BattleState): string;
  /** M7 task A2 — OPTIONAL, additive (the D3/E4/E9 pattern). `BattleScene`
   * renders `plate.footerFor?.(state) ?? plate.footer(livingCount)`. The
   * static `footer(livingCount)` signature can't express a phase-dependent
   * DENOMINATOR (the Imposter has 3 targetable clone slots during CLONES and
   * 1 in every other phase), and the denominator is scene knowledge that must
   * not leak into the shared shell. Alert Storm, Cascade and Silent Failure do
   * not implement this, so their rendered output and all four existing
   * `plate.footer(n)` tests stay byte-identical. */
  footerFor?(state: BattleState): string;
}

/** One module per boss id (§Scene generalization). */
export interface BossSceneModule {
  id: string;
  /** Both flutter phases, built once. */
  arena: [Grid, Grid];
  /** M6 PR-3 task 6 (E9) — OPTIONAL, additive (D3/E4 pattern). The static
   * `arena` property can't express an HP-linked arena (the Imposter's
   * erosion stages), so `BattleScene` renders
   * `(scene.arenaFor?.(shown.boss) ?? scene.arena)[flutter]` instead —
   * `shown.boss`, not the live `state.boss`, so the death-animation window
   * (which keeps composing off `shown`, sceneGate.ts's `shouldComposeBoss`)
   * shows the correct stage throughout. Shipped modules don't implement
   * this, so their output stays byte-identical. */
  arenaFor?(boss: BossState): [Grid, Grid];
  /** M6 PR-3 task 6 (E4) — OPTIONAL, additive. `composeBoss`'s Grid is
   * stamped TOP-LEFT at this origin instead of the bare `BOSS_AT` constant
   * when present (default `BOSS_AT`) — needed for the Imposter's leftward
   * clone spread, which `stampGrid`'s stage-bounds clipping would otherwise
   * silently eat. The shared-origin contract (dissect pass 1, the J4
   * invisible-cursor class): a module implementing this MUST have its own
   * `batCell`/`cursorCell`/float-anchor arms compute from this SAME
   * function, never the bare `BOSS_AT` constant, or the cursor targets art
   * that isn't there. Shipped modules don't implement this, so their output
   * stays byte-identical. */
  stampOrigin?(boss: BossState): [number, number];
  /** Compose the boss's on-stage grid for this frame from engine + fx state.
   * Takes the whole `BossState` (not e.g. `Bat[]`) — M6 PR-1b widened this
   * from Alert-Storm-specific `bats: Bat[]` so a second boss (Cascade, whose
   * per-frame composition needs `nodes`/`carrier`/`lastHop`, not bats) can
   * implement the same interface. Each module narrows on `.kind` internally;
   * `screaming` stays a plain boolean since it is meaningless outside Alert
   * Storm (always `false` there — see BattleScene.tsx). */
  composeBoss(boss: BossState, screaming: boolean, flutter: number, fx: SceneFx): Grid;
  plate: ScenePlate;
  /** "" when nothing to show this frame. */
  banner(state: BattleState): string;
  victoryCopy: VictoryCopy;
  defeatCopy: DefeatCopy;
}
