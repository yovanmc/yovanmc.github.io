// Imposter Syndrome's scene module. Uses the two optional seams: `stampOrigin`
// (the clone spread overflows left of `BOSS_AT`) and `arenaFor` (the erosion
// arena is HP-linked).
import type { BattleState, BossState } from "../engine";
import {
  erosionStage as bossErosionStage,
  IMPOSTER_ID,
  isImposterDefeated,
  livingTargets,
  type ImposterBoss,
} from "../bosses/imposter";
import { deathFrame } from "./silentFailure";
import { GLITCH_A, GLITCH_B, IMP_ATK, IMP_DIE, IMP_IDLE } from "../../generated/bossImposter";
import { COLS, ROWS } from "../../generated/heroBattle";
import type { Grid } from "../../generated/heroBattle";
import { BOSS_AT, erosionStage as erosionStageGrid, varIS } from "../../generated/battlefieldScene";
import { skipToWork } from "../../landingCopy";
import type { BossSceneModule, SceneFx } from "./types";

/** Clone spacing: 48-wide sprites 20 cols apart overlap and overflow the boss
 * zone on purpose. Also the leftward origin shift during CLONES, so the middle
 * slot stands where a solo boss would. Art and cursor/float math both derive
 * from it. */
const CLONE_GAP = 20;
/** Cursor/float anchor relative to a stamp origin: just above the eyes (row
 * 10 in every IMP_* frame), centered on the 48-col sprite. */
const ANCHOR_ROW = 6;
const ANCHOR_COL = Math.floor(COLS / 2);

/** Horizontal mirror. The Imposter is the hero's own art stamped on the
 * left, so unmirrored it faces away from the hero. Baked overlay pixels move
 * with it: `eyes()` hardcodes columns 23/27, which the test uses to catch an
 * off-by-one reverse. */
export function mirrorOf(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse());
}

/** Clamps a 1-indexed fx.ripple step onto a reel's frame index. */
function reelFrame(reel: readonly [Grid, number][], step: number): Grid {
  return reel[Math.min(Math.max(step - 1, 0), reel.length - 1)][0];
}

/** Blank 60x48 grid for the non-imposter fallback. */
function blankGrid(): Grid {
  return IMP_IDLE[0].map((row) => row.map(() => null));
}

/** Stamps `src` onto `dst` at column `c0`, skipping nulls and clipping at
 * `dst`'s width. */
function stampInto(dst: Grid, src: Grid, c0: number): void {
  for (let r = 0; r < src.length && r < dst.length; r++) {
    const row = src[r];
    const dstRow = dst[r];
    for (let c = 0; c < row.length; c++) {
      const k = row[c];
      if (k === null || k === undefined) continue;
      const cc = c0 + c;
      if (cc >= 0 && cc < dstRow.length) dstRow[cc] = k;
    }
  }
}

/** Canvas column of clone slot 0/1/2 (0/20/40). `imposterBatAnchor` adds the
 * same value, so art and targeting cannot drift. */
function cloneLocalCol(slot: number): number {
  return slot * CLONE_GAP;
}

/** Glitch variant per slot, read only for non-real slots. Slots 0 and 2
 * share GLITCH_A: at most one of them is fake in any frame. */
const CLONE_VARIANTS: readonly Grid[] = [GLITCH_A, GLITCH_B, GLITCH_A];

/** CLONES: three silhouettes on one wide canvas, the real one an idle render
 * and the two fakes glitch variants. A pop has no persistent state, so all
 * three always show. Adjacent slots overlap; fakes draw first and the real
 * slot last so its pixels are never clobbered. The paint order does not leak
 * which slot is real: only edges between neighbors change. */
function composeClones(boss: ImposterBoss, flutter: number): Grid {
  const width = COLS + 2 * CLONE_GAP;
  const canvas: Grid = Array.from({ length: ROWS }, () => Array<string | null>(width).fill(null));
  for (let slot = 0; slot < 3; slot++) {
    if (slot === boss.realIndex) continue;
    stampInto(canvas, mirrorOf(CLONE_VARIANTS[slot]), cloneLocalCol(slot));
  }
  if (boss.realIndex !== null) {
    stampInto(canvas, mirrorOf(IMP_IDLE[flutter]), cloneLocalCol(boss.realIndex));
  }
  return canvas;
}

/** Stage origin of `composeBoss`'s grid: `BOSS_AT`, shifted left by
 * `CLONE_GAP` during CLONES. Art and every anchor key off this function,
 * never bare `BOSS_AT`. */
function stampOriginFor(boss: BossState): [number, number] {
  if (boss.kind !== IMPOSTER_ID) return BOSS_AT;
  return boss.phase === "clones" ? [BOSS_AT[0], BOSS_AT[1] - CLONE_GAP] : BOSS_AT;
}

/** Float anchor for target `id`: the clone slot's own column during CLONES,
 * the single entity (id 0) otherwise. */
export function imposterBatAnchor(boss: BossState, targetId: number): [number, number] {
  const [r0, c0] = stampOriginFor(boss);
  const localCol = boss.kind === IMPOSTER_ID && boss.phase === "clones" ? cloneLocalCol(targetId) : 0;
  return [r0 + ANCHOR_ROW, c0 + localCol + ANCHOR_COL];
}

/** Target-cursor arrow anchor: the usual -5 row / -2 col from the float
 * anchor. */
export function imposterCursorAnchor(boss: BossState, targetId: number): [number, number] {
  const [r, c] = imposterBatAnchor(boss, targetId);
  return [r - 5, c - 2];
}

/** `IMP_HIT` and the glitch-interrupt idle reel stay unused: there is no
 * shell fx signal for the hero's hit landing, and the idle reel needs a
 * scene-local timer. */
function composeBoss(bossState: BossState, _screaming: boolean, flutter: number, fx: SceneFx): Grid {
  if (bossState.kind !== IMPOSTER_ID) return blankGrid();
  const boss = bossState;
  // Checked first: `IMP_DIE` is a 7-frame linear reel driven by the shell's
  // non-merging `setSwarmFx` progression, like `SIL_DIE`.
  if (isImposterDefeated(boss)) return mirrorOf(IMP_DIE[deathFrame(fx)][0]);
  // Boss-volley windup for any phase.
  if (fx.ripple) return mirrorOf(reelFrame(IMP_ATK, fx.ripple));
  if (boss.phase === "clones") return composeClones(boss, flutter);
  return mirrorOf(IMP_IDLE[flutter]);
}

/** Every stage x flutter phase, built once. Stage 0 uses `varIS(ph)`, the
 * live variant: `erosionStage(0, ph)` drops its scanline and freezes the
 * glitch band. */
const EROSION_ARENA: readonly [Grid, Grid][] = [
  [varIS(0), varIS(1)],
  [erosionStageGrid(1, 0), erosionStageGrid(1, 1)],
  [erosionStageGrid(2, 0), erosionStageGrid(2, 1)],
  [erosionStageGrid(3, 0), erosionStageGrid(3, 1)],
];

/** Reads hp live: a mirrored heal back over a stage line re-corrupts the
 * station. BattleScene passes the animation-lagged `shown.boss`, so the
 * stage-3 pure station shows during the `IMP_DIE` finale. */
function arenaFor(bossState: BossState): [Grid, Grid] {
  if (bossState.kind !== IMPOSTER_ID) return EROSION_ARENA[0];
  return EROSION_ARENA[bossErosionStage(bossState)];
}

/** Slots that exist in this phase, alive or not (3 during CLONES, else 1).
 * The plate footer's denominator. */
function targetSlots(boss: ImposterBoss): number {
  return boss.phase === "clones" ? 3 : 1;
}

/** The mid-fight Conviction forge is this boss's only banner. `state.events`
 * holds only the last reduce's events, so this shows for exactly one
 * update. */
function bannerFor(state: BattleState): string {
  if (state.boss.kind !== IMPOSTER_ID) return "";
  if (state.status === "active" && state.events.some((e) => e.type === "forge" && e.ability === "conviction")) {
    return "CONVICTION FORGED · THE MASK CRACKS";
  }
  return "";
}

export const imposterScene: BossSceneModule = {
  id: IMPOSTER_ID,
  // Static default; `arenaFor` always supersedes it.
  arena: EROSION_ARENA[0],
  arenaFor,
  stampOrigin: stampOriginFor,
  composeBoss,
  plate: {
    label: "IMPOSTER SYNDROME",
    // Never rendered: revealBoss is always true for this boss.
    hiddenLabel: "?? · WHICH ONE IS REAL",
    // Superseded by `footerFor`.
    footer: (livingCount) => `${livingCount}/1 TARGET`,
    footerFor: (state) =>
      state.boss.kind === IMPOSTER_ID
        ? `${livingTargets(state.boss).length}/${targetSlots(state.boss)} TARGET`
        : `0/1 TARGET`,
  },
  banner: bannerFor,
  victoryCopy: {
    eyebrow: "UNMASKED",
    title: "The Imposter Syndrome breaks",
    // No ability is forged here (full clear). The overlay shows forgeLines
    // whenever any forge event landed, so a hit that crosses the forge
    // threshold and kills at once still reads correctly.
    forgeLines: ["THE IMPOSTER IS UNMASKED", "+10 MAX HP · +2 MAX MP"],
    rematchLine: "A VICTORY LAP · THE MASK STAYS OFF",
    footer: "Every silence answered. The Station holds.",
    cta: "CONTINUE ⏎",
  },
  defeatCopy: {
    eyebrow: "STILL WEARING THE MASK",
    title: "The mask closes back over",
    retryCta: "RETRY ⏎",
    leaveCta: skipToWork,
  },
};
