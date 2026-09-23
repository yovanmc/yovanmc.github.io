// The Silent Failure's scene module. A single entity with no per-entity
// state, so monolithic reels are correct here.
import type { BattleState, BossState } from "../engine";
import {
  isSilentFailureDefeated,
  SILENT_FAILURE_ID,
} from "../bosses/silentFailure";
import {
  eOverlay,
  newG,
  PIECES,
  SIL_ATK,
  SIL_BODY,
  SIL_DIE,
  SIL_EMPTY,
} from "../../generated/bossSilentFailure";
import type { Grid, Pts } from "../../generated/bossSilentFailure";
import { varSF } from "../../generated/battlefieldScene";
import { skipToWork } from "../../landingCopy";
import type { BossSceneModule, SceneFx } from "./types";

/** Alert Storm's mark-chevron palette key (a light purple). */
const MOTE_KEY = "k";

/** Purple motes betraying the marked boss's position while vanished (visual
 * only). Built as an `eOverlay` point list anchored on `PIECES[0]`, the
 * helmet box, so they hover near the head. */
function moteOverlay(): Pts {
  // The helmet's top edge is row 0, so "above the head" is out of bounds.
  // The motes drift just outside its left/right edges instead, clamped
  // because eOverlay silently drops out-of-bounds points.
  const [r1, r2, c1, c2] = PIECES[0];
  const topR = Math.max(0, r1 - 2);
  return [
    [topR, Math.max(0, c1 - 4), MOTE_KEY],
    [r1 + 2, c2 + 4, MOTE_KEY],
    [r2 - 2, Math.max(0, c1 - 6), MOTE_KEY],
  ];
}

/** Clamp a 1-indexed fx.ripple step onto a reel's frame index. */
function reelFrame(reel: readonly [Grid, number][], step: number): Grid {
  return reel[Math.min(Math.max(step - 1, 0), reel.length - 1)][0];
}

/**
 * Maps the victory-fx progression onto a monotonically advancing `SIL_DIE`
 * frame. BattleScene's victory sequence replaces the fx object at each step
 * rather than merging:
 *   `{ripple: 1}` -> `{ripple: 3}` -> `{fall: 4, dither: 2}` -> `{fall: 10, dither: 3}`
 * so indexing off `fx.ripple` alone would show the near-empty terminal frame
 * (blank arena) for the whole `fall` half of the death animation.
 *
 * Non-null cells per frame (of 60x64): 0:744 1:737 2:613 3:416 4:416 5:122
 * 6:66. Every step but the last keeps a frame of >=400 cells; frame 6 is
 * reserved for `{fall: 10}`, right before the victory overlay covers the
 * arena. Thresholds use `>=` so small changes to the sequence's values still
 * work.
 */
export function deathFrame(fx: SceneFx): number {
  if (fx.fall !== undefined) return fx.fall >= 10 ? 6 : 4;
  if (fx.ripple !== undefined) return fx.ripple >= 3 ? 3 : 1;
  return 0;
}

/**
 * `SIL_BODY` while embodied, `SIL_EMPTY` (plus motes when marked) while
 * vanished. `SIL_DIE` is checked first, so a vanished-phase kill never falls
 * through to empty armor (what `forceBodyForDeath` describes); hp<=0 already
 * implies it.
 *
 * `SIL_ATK` plays on the ambush, keyed off `fx.ripple`, which the shell sets
 * during any boss's attack. `ripple` drops out partway through that sequence,
 * but the fallback `SIL_EMPTY` has about the same cell density as the
 * reachable `SIL_ATK` frames, so the reel just settles back to idle.
 *
 * `SIL_HIT` and `SIL_FADE` stay unused: there is no shell fx signal for the
 * hero's hit landing, and the fade needs a scene-local timer.
 */
function composeBoss(boss: BossState, _screaming: boolean, flutter: number, fx: SceneFx): Grid {
  if (boss.kind !== SILENT_FAILURE_ID) return newG();
  if (isSilentFailureDefeated(boss)) {
    return SIL_DIE[deathFrame(fx)][0];
  }
  if (boss.phase === "vanished") {
    if (fx.ripple) return reelFrame(SIL_ATK, fx.ripple);
    const empty = SIL_EMPTY[flutter];
    return boss.marked ? eOverlay(empty, moteOverlay()) : empty;
  }
  return SIL_BODY[flutter];
}

export const silentFailureScene: BossSceneModule = {
  id: SILENT_FAILURE_ID,
  arena: [varSF(0), varSF(1)],
  composeBoss,
  plate: {
    label: "THE SILENT FAILURE",
    // Never rendered: revealBoss is always true for this boss.
    hiddenLabel: "?? · IT IS ALREADY HERE",
    // livingCount is 0 or 1, never HP, hence "TARGET".
    footer: (livingCount) => `${livingCount}/1 TARGET`,
    // Phase-aware; Alert Storm and Cascade don't implement it.
    labelFor: (state: BattleState) => {
      if (state.boss.kind !== SILENT_FAILURE_ID) return "THE SILENT FAILURE";
      return state.boss.phase === "vanished" ? "VANISHED" : "THE SILENT FAILURE";
    },
  },
  // No telegraph on this boss.
  banner: (_state: BattleState) => "",
  victoryCopy: {
    eyebrow: "TRACED",
    title: "The Silent Failure surfaces",
    forgeLines: ["◈ ROOT CAUSE · FORGED", "+10 MAX HP · +2 MAX MP"],
    rematchLine: "A VICTORY LAP · IT STAYS FOUND",
    footer: "One more waits in the dark. More coming.",
    cta: "CONTINUE ⏎",
  },
  defeatCopy: {
    eyebrow: "LOST IN THE DARK",
    title: "It slips back into the walls",
    retryCta: "RETRY ⏎",
    leaveCta: skipToWork,
  },
};
