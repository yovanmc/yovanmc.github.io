// The Silent Failure's scene module: arena art, boss composition, plate copy
// (including the phase-aware labelFor), banner text, victory/defeat copy.
// Mirrors scenes/alertStorm.ts's and scenes/cascade.ts's shape behind the same
// `BossSceneModule` interface (./types). Single entity with no per-entity
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

/** Same palette key Alert Storm's mark chevron uses (scenes/alertStorm.ts's
 * `plotMarkChevron`): `PAL["k"] = "#9d6bc4"`, a light purple. */
const MOTE_KEY = "k";

/** Purple motes betraying the marked boss's position while vanished, built the
 * way scenes/alertStorm.ts builds its mark chevron (visual only, grants nothing
 * mechanically) but expressed as an `eOverlay` `Pts` array since
 * bossSilentFailure.js already exports `eOverlay` for exactly this, so no
 * mutate-in-place helper is needed. Anchored on `PIECES[0]` (the helmet box on
 * `SIL_EMPTY[0]`) so the motes read as hovering roughly where the head would
 * be, rather than at arbitrary coordinates. */
function moteOverlay(): Pts {
  // Helmet box on SIL_EMPTY[0] is [0, 11, 28, 38]: its top edge already sits
  // at row 0, so "above the head" isn't in-bounds. The motes instead drift
  // just outside its left/right edges, clamped so a future PIECES change
  // can't silently push them off-canvas, since eOverlay drops out-of-bounds
  // points with no error.
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
 * Maps the shell's victory-fx progression onto a monotonically advancing
 * `SIL_DIE` frame index.
 *
 * `BattleScene.tsx`'s victory sequence calls `setSwarmFx` with a WHOLE NEW
 * OBJECT at each step, never merging with the previous one:
 *   `{ripple: 1}`             early dissolve
 *   `{ripple: 3}`             more dissolved
 *   `{fall: 4, dither: 2}`    pieces separating (no `ripple` key at all)
 *   `{fall: 10, dither: 3}`   pieces landed/fading (no `ripple` key)
 * so indexing `SIL_DIE` off `fx.ripple` alone dead-ends on `SIL_DIE`'s sparse
 * TERMINAL frame for the entire `fx.fall` back half of the sequence, which
 * reads as a blank arena for roughly the second half of the ~1250ms
 * death-animation window, on both the embodied-kill and the vanished-DoT-kill
 * paths.
 *
 * Per-frame density (`nonNullCells` out of a 60x64 grid, 7 total `SIL_DIE`
 * frames):
 *   0:744  1:737  2:613  3:416  4:416  5:122  6:66
 * Frame 6 (66 cells) is a near-empty fade-out by design (the death reel's
 * final "faded to nothing" heap), correct only for the true last instant and
 * not for half the window. This mapping keeps a SUBSTANTIAL frame (>=400
 * cells) on screen through every fx step except the very last, and reserves
 * frame 6 for `{fall: 10, ...}` alone: the victory overlay covers the arena
 * immediately after that step anyway, so a near-empty pose there is the
 * correct final beat rather than a premature one. The `fall`/`ripple`
 * thresholds (`>= 10`, `>= 3`) are comparisons rather than exact-equality
 * checks against the specific values the victory sequence uses today, so this
 * stays correct if those constants ever shift slightly.
 */
export function deathFrame(fx: SceneFx): number {
  if (fx.fall !== undefined) return fx.fall >= 10 ? 6 : 4;
  if (fx.ripple !== undefined) return fx.ripple >= 3 ? 3 : 1;
  return 0;
}

/**
 * Compose the Silent Failure's on-stage grid from engine + fx state.
 * `SIL_BODY`/`SIL_EMPTY` are selected by `phase`: body while embodied, empty
 * (untargetable silhouette) while vanished, with the purple mote overlay added
 * on top when marked. `SIL_DIE` is selected unconditionally once
 * `isSilentFailureDefeated`, checked FIRST, before the phase branch below,
 * which is what the boss's `forceBodyForDeath` flag describes: a vanished-phase
 * kill still resolves through this SAME unconditional SIL_DIE branch and never
 * falls through to an empty-armor frame. composeBoss therefore never has to
 * branch on `forceBodyForDeath` itself, since hp<=0 already implies it. See
 * `deathFrame` for how the frame WITHIN that branch is chosen.
 *
 * `SIL_ATK` plays on the vanished-phase ambush, keyed off `fx.ripple`, the SAME
 * generic field the shell already sets during ANY boss's own attack-on-hero
 * animation (`commit()`'s boss-volley steps in BattleScene.tsx). `fx.ripple`
 * does also drop to `undefined` partway through that boss-volley sequence (the
 * identical non-merging `setSwarmFx` pattern `deathFrame` works around for
 * `SIL_DIE`), but that needs no equivalent handling here: the fallback is
 * `SIL_EMPTY` (417 non-null cells), which is cell-density-consistent with the
 * `SIL_ATK` frames `reelFrame` actually reaches (ripple 1/2/3 -> indices 0/1/2,
 * 417/416/399 cells) rather than a jarring drop to a near-empty frame, so the
 * reel simply truncates to its windup frames and settles back to a complete,
 * correct-looking idle pose instead of dead-ending on something that reads as
 * broken.
 *
 * `SIL_HIT` and `SIL_FADE` stay exported from bossSilentFailure.js and unused
 * here, like Cascade's dormant `reels` field. `SIL_FADE` is a phase-flip tween
 * that needs a scene-local timer this module does not have, and the shell has
 * no generic "the hero's own hit just landed on the boss" fx signal for
 * `SIL_HIT` to key off (Alert Storm's own hit reaction is baked into per-bat
 * state, not an fx-driven reel).
 *
 * Takes the whole `BossState`. This module is never invoked with a
 * non-silent-failure `boss` in practice, since BattleScene.tsx selects the
 * scene module by `boss.kind` (the other modules guard the same way); the
 * blank-grid fallback is defensive only.
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
    // Structural only, never rendered: BattleScene.tsx's plate JSX gates the
    // HP-bar-vs-hiddenLabel swap on `revealBoss`, which is always true for
    // this boss.
    hiddenLabel: "?? · IT IS ALREADY HERE",
    // Single-entity case: livingCount is 0 or 1 (BattleScene.tsx derives it),
    // never the boss's own HP, hence "TARGET" rather than "HP".
    footer: (livingCount) => `${livingCount}/1 TARGET`,
    // Additive and phase-aware; Alert Storm and Cascade don't implement it.
    labelFor: (state: BattleState) => {
      if (state.boss.kind !== SILENT_FAILURE_ID) return "THE SILENT FAILURE";
      return state.boss.phase === "vanished" ? "VANISHED" : "THE SILENT FAILURE";
    },
  },
  // No telegraph/banner mechanic on this boss, unlike Cascade's storm
  // telegraph, so this returns the empty string for any state.
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
