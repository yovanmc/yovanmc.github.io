// Imposter Syndrome's scene module: arena art, boss composition, plate copy,
// banner text, victory/defeat copy. Mirrors scenes/silentFailure.ts's shape
// behind the same `BossSceneModule` interface (./types), plus the two OPTIONAL
// seams this boss is the first to need: `stampOrigin`, because the clone spread
// overflows leftward past `BOSS_AT`, and `arenaFor`, because the erosion arena
// is HP-linked and the static `arena` property can't express that.
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

/** ±20-col clone spread: the 60x48 sprites at ±20-col offsets overflow the
 * 60x64 boss zone deliberately. Also the leftward shift `stampOriginFor`
 * applies during CLONES so the combined 3-silhouette canvas's MIDDLE slot still
 * lands where a solo boss would stand. The shared-origin contract below is
 * built entirely off this one constant so the art and the cursor/float math can
 * never drift apart. */
const CLONE_GAP = 20;
/** Cursor/float anchor, in cells relative to a stamp origin: a bit above the
 * eyes (row 10 in every IMP_* frame) and horizontally centered on the
 * hero-shaped (48-col) sprite. Same "anchor above the sprite, centered"
 * convention scenes/alertStorm.ts and scenes/silentFailure.ts use against
 * their own art. */
const ANCHOR_ROW = 6;
const ANCHOR_COL = Math.floor(COLS / 2);

/** Renderer-owned per-row reverse, applied AFTER `remapOf`, which already ran
 * at generation time (every IMP_* export is a fully baked frame, see
 * bossImposter.js). The Imposter IS the hero's own art stamped at `BOSS_AT`
 * (left side), so unmirrored it faces away from the hero, and no mirror/flip
 * helper exists anywhere else in the pipeline. A plain per-cell row reverse
 * also carries any already-baked overlay pixel with it: `eyes()` hardcodes
 * columns 23/27 in every reel, so the unit test for this asserts one of those
 * exact cells lands at its mirrored column rather than just that SOME cell
 * moved (a naive off-by-one reverse would misplace the eyes by one column and
 * still pass a cell-count-only check). */
export function mirrorOf(grid: Grid): Grid {
  return grid.map((row) => [...row].reverse());
}

/** Clamp a 1-indexed fx.ripple step onto a reel's frame index. Same local
 * helper scenes/silentFailure.ts keeps privately for its own SIL_ATK read;
 * it isn't exported there, so it is duplicated here rather than reaching into
 * another module's private helper. */
function reelFrame(reel: readonly [Grid, number][], step: number): Grid {
  return reel[Math.min(Math.max(step - 1, 0), reel.length - 1)][0];
}

/** A blank hero-shaped (60x48) grid, this module's `newG()` equivalent. Used
 * only for the defensive non-imposter fallback, which is never reached in
 * practice since BattleScene.tsx selects this module by `boss.kind`. */
function blankGrid(): Grid {
  return IMP_IDLE[0].map((row) => row.map(() => null));
}

/** Stamp `src` onto `dst` at local column `c0`, skipping nulls and clipping
 * at `dst`'s own width (same contract as BattleScene.tsx's `stampGrid`, but
 * scoped to this module's own clone-spread canvas rather than the stage). */
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

/** Local (canvas-relative) column start for clone slot 0/1/2's own 48-wide
 * sprite inside `composeClones`'s combined canvas: 0/20/40. Every cursor/float
 * anchor for a clone slot (`imposterBatAnchor` below) adds this SAME value on
 * top of `stampOriginFor`, so the art and the targeting math can never
 * independently drift. */
function cloneLocalCol(slot: number): number {
  return slot * CLONE_GAP;
}

/** Two glitch variants for the two non-real slots, indexed by slot 0/1/2 and
 * only ever read for the slot that ISN'T `realIndex` this frame. Slots 0 and 2
 * share GLITCH_A deliberately: only one of them is ever a "fake" slot on any
 * given battle, since the real slot rotates the assignment, not the canvas
 * position. */
const CLONE_VARIANTS: readonly Grid[] = [GLITCH_A, GLITCH_B, GLITCH_A];

/** CLONES-phase composition: three imposter silhouettes side by side on one
 * wide canvas, the real one a full idle render and the other two pre-baked
 * glitch variants. Hitting a clone pops it harmlessly and there is no
 * persistent per-slot pop state to render, so every CLONES-phase frame always
 * shows all three, matching the engine's own stateless `resolveImposterHit`
 * where the spent turn/MP IS the whole effect.
 *
 * The `CLONE_GAP` (20) spacing on 48-wide frames means adjacent slots overlap
 * by design, spreading the silhouettes across the disc. Fakes draw FIRST
 * (ascending slot order) and the REAL slot draws LAST, so its own non-null
 * pixels are never clobbered by a neighbor bleeding in from an adjacent slot.
 * That paint order doesn't leak which slot is real: both fakes keep their own
 * distinct glitch look regardless of it, and only the shared-edge pixels are
 * affected, between two ALREADY-fake neighbors when the real slot is
 * elsewhere. */
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

/** The absolute on-stage origin `composeBoss`'s Grid is stamped at: `BOSS_AT`
 * outside CLONES, the same as every other boss, and during CLONES shifted LEFT
 * by `CLONE_GAP` so the combined 3-silhouette canvas's middle slot (local
 * column `CLONE_GAP`) lands exactly where a solo boss would stand.
 * `composeClones` and every anchor below both key off this SAME function, never
 * the bare `BOSS_AT` constant, or the cursor would point at art that isn't
 * there. */
function stampOriginFor(boss: BossState): [number, number] {
  if (boss.kind !== IMPOSTER_ID) return BOSS_AT;
  return boss.phase === "clones" ? [BOSS_AT[0], BOSS_AT[1] - CLONE_GAP] : BOSS_AT;
}

/** Absolute on-stage anchor (float/damage-number position) for target `id`.
 * During CLONES, `id` is the clone slot (0/1/2) and gets its own local column
 * added on top of the shifted origin, giving three real homes, one per slot.
 * Outside CLONES there is only the single entity (`id` is always 0) and the
 * local column contributes nothing, matching `stampOriginFor`'s own unshifted
 * fallback. */
export function imposterBatAnchor(boss: BossState, targetId: number): [number, number] {
  const [r0, c0] = stampOriginFor(boss);
  const localCol = boss.kind === IMPOSTER_ID && boss.phase === "clones" ? cloneLocalCol(targetId) : 0;
  return [r0 + ANCHOR_ROW, c0 + localCol + ANCHOR_COL];
}

/** Target-cursor arrow anchor: the same "-5 row / -2 col" offset from the float
 * anchor every other boss's `cursorCell` arm uses against its own `batCell`
 * position. */
export function imposterCursorAnchor(boss: BossState, targetId: number): [number, number] {
  const [r, c] = imposterBatAnchor(boss, targetId);
  return [r - 5, c - 2];
}

/** This module is never invoked with a non-imposter `boss` in practice, since
 * BattleScene.tsx selects the scene module by `boss.kind` (every other module
 * guards the same way); the blank-grid fallback is defensive only. `IMP_HIT` and
 * `IMP_REEL`'s glitch-interrupt idle loop stay exported from bossImposter.js and
 * unused here, for the same reasons scenes/silentFailure.ts gives for
 * `SIL_HIT`/`SIL_FADE`: no generic shell fx signal exists for "the hero's own
 * hit just landed on the boss", and the glitch-interrupt reel needs a
 * scene-local timer this module does not have. */
function composeBoss(bossState: BossState, _screaming: boolean, flutter: number, fx: SceneFx): Grid {
  if (bossState.kind !== IMPOSTER_ID) return blankGrid();
  const boss = bossState;
  // Checked FIRST, the same order scenes/silentFailure.ts's composeBoss uses,
  // and reusing its `deathFrame`: `IMP_DIE` is a 7-frame linear reel (same
  // shape as `SIL_DIE`) indexed by the shell's own non-merging `setSwarmFx`
  // progression, so without it the reel would dead-end early the same way.
  if (isImposterDefeated(boss)) return mirrorOf(IMP_DIE[deathFrame(fx)][0]);
  // Generic boss-volley windup (any phase's own attack funnels through the
  // shell's shared `fx.ripple` sequence, same mechanism SF's SIL_ATK reads).
  if (fx.ripple) return mirrorOf(reelFrame(IMP_ATK, fx.ripple));
  if (boss.phase === "clones") return composeClones(boss, flutter);
  return mirrorOf(IMP_IDLE[flutter]);
}

/** The erosion arena, all 4 stages x 2 flutter phases memoized once at module
 * load. Stage 0 uses `varIS(ph)`, the LIVE variant, because plain
 * `erosionStage(0, ph)` drops its scanline and freezes its glitch-band flutter;
 * stages 1-3 use `erosionStage(t, ph)`. */
const EROSION_ARENA: readonly [Grid, Grid][] = [
  [varIS(0), varIS(1)],
  [erosionStageGrid(1, 0), erosionStageGrid(1, 1)],
  [erosionStageGrid(2, 0), erosionStageGrid(2, 1)],
  [erosionStageGrid(3, 0), erosionStageGrid(3, 1)],
];

/** Reads `boss.hp` LIVE and reversibly: a mirrored heal that crosses back over
 * a stage line is meant to visibly re-corrupt the station, not be clamped by a
 * stored high-water mark. Consumed by BattleScene.tsx as
 * `(scene.arenaFor?.(shown.boss) ?? scene.arena)[flutter]` against `shown.boss`
 * specifically (the animation-lagged copy), so the stage-3 PURE station is
 * what's on screen during the `IMP_DIE` finale. */
function arenaFor(bossState: BossState): [Grid, Grid] {
  if (bossState.kind !== IMPOSTER_ID) return EROSION_ARENA[0];
  return EROSION_ARENA[bossErosionStage(bossState)];
}

/** Slots that EXIST in this phase, alive or not: the clone spread shows three
 * targetable positions during CLONES, one entity in every other phase. The
 * plate footer's denominator. */
function targetSlots(boss: ImposterBoss): number {
  return boss.phase === "clones" ? 3 : 1;
}

/** Defensive against non-imposter states, since a caller can hand any boss
 * state to any registered module's `banner`. The mid-fight Conviction forge is
 * the only banner moment this boss has; no telegraph mechanic like Cascade's
 * storm banner exists here. `state.events` carries the LAST reduce's events
 * (cleared each action), so this reads as true for exactly the one `shown`
 * update the forge event landed on. */
function bannerFor(state: BattleState): string {
  if (state.boss.kind !== IMPOSTER_ID) return "";
  if (state.status === "active" && state.events.some((e) => e.type === "forge" && e.ability === "conviction")) {
    return "CONVICTION FORGED · THE MASK CRACKS";
  }
  return "";
}

export const imposterScene: BossSceneModule = {
  id: IMPOSTER_ID,
  // Never actually read at runtime, since arenaFor is defined below and always
  // returns a value; set to the stage-0/live look as the static default, the
  // same additive pattern as every other optional seam.
  arena: EROSION_ARENA[0],
  arenaFor,
  stampOrigin: stampOriginFor,
  composeBoss,
  plate: {
    label: "IMPOSTER SYNDROME",
    // Structural only, never rendered: revealBoss is always true for this
    // boss, so its real HP shows throughout. The puzzle is its phases, not
    // its HP.
    hiddenLabel: "?? · WHICH ONE IS REAL",
    // Never read at runtime once `footerFor` below is defined; structural
    // only, like `arena` and `hiddenLabel` above.
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
    // No new ability is forged here: this is the full clear, and
    // `forgeAbility` stays undefined for this boss. The line still reads
    // correctly as a first-clear message even in the rare case where a single
    // hit crosses BOTH the forge-conviction threshold and the kill at once,
    // since the shell's victory overlay shows forgeLines whenever ANY forge
    // event landed this reduce, not only an ability-unlock one.
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
