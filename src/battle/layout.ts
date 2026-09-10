// Pure stage/panel geometry for BattleScene.tsx. It lives in a `.ts` module,
// like scenes/cascadeCompose.ts, so it is matched by the coverage globs in
// vitest.config.ts (`src/battle/**/*.ts`, 95% branches); `.tsx` files are not.
//
// These formulas must stay behaviourally identical to the render path in
// BattleScene.tsx that consumes them.
import type { Grid } from "../generated/heroBattle";
import { SC, SR } from "../generated/battlefieldScene";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StageMetrics {
  scale: number;
  stageW: number;
  stageH: number;
  stageLeft: number;
  stageTop: number;
}

/** Stage scale and on-screen stage rect for a viewport. `SC`/`SR` (the
 * 256x144 stage size) are imported from the same generated module
 * BattleScene.tsx imports them from rather than re-declared as local
 * literals: this module is the sole positioning math for every sprite,
 * damage float and target cursor, so it has to agree with BattleScene by
 * construction and survive a canon regeneration. */
export function stageMetrics(vw: number, vh: number, isMobile: boolean): StageMetrics {
  const fit = Math.min(vw / SC, (vh * 0.72) / SR);
  const scale = isMobile ? vw / SC : Math.max(2, Math.floor(fit * 2) / 2);
  const stageW = SC * scale;
  const stageH = SR * scale;
  const stageLeft = (vw - stageW) / 2;
  const stageTop = isMobile ? Math.max(12, (vh - stageH) * 0.32) : Math.max(8, (vh * 0.86 - stageH) / 2);
  return { scale, stageW, stageH, stageLeft, stageTop };
}

/** Rect of a single stage cell, which is `scale` CSS px on a side. */
export function cellRect(m: StageMetrics, r: number, c: number): Rect {
  return {
    left: m.stageLeft + c * m.scale,
    top: m.stageTop + r * m.scale,
    width: m.scale,
    height: m.scale,
  };
}

/** Inclusive [top,left,bottom,right] cell-index bounds of the painted
 * (non-null) cells in `grid`, or `null` for a blank grid (every cell `null`,
 * or zero rows). Ragged rows (rows of differing length — `Grid` allows it)
 * are handled without an index error: each row is only ever indexed up to
 * its own length. */
export function paintedBounds(grid: Grid): { top: number; left: number; bottom: number; right: number } | null {
  let top = Infinity;
  let left = Infinity;
  let bottom = -Infinity;
  let right = -Infinity;
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === null) continue;
      if (r < top) top = r;
      if (r > bottom) bottom = r;
      if (c < left) left = c;
      if (c > right) right = c;
    }
  }
  if (bottom < top) return null;
  return { top, left, bottom, right };
}

/** Container-relative rect of `grid` stamped TOP-LEFT at `[originRow,
 * originCol]` (stampGrid semantics: row `r` of the grid lands on stage row
 * `originRow + r`), covering only its PAINTED extent (via `paintedBounds`).
 * `null` for a blank grid, propagated from `paintedBounds`. */
export function gridRect(m: StageMetrics, originRow: number, originCol: number, grid: Grid): Rect | null {
  const bounds = paintedBounds(grid);
  if (bounds === null) return null;
  const topLeft = cellRect(m, originRow + bounds.top, originCol + bounds.left);
  const rows = bounds.bottom - bounds.top + 1;
  const cols = bounds.right - bounds.left + 1;
  return {
    left: topLeft.left,
    top: topLeft.top,
    width: cols * m.scale,
    height: rows * m.scale,
  };
}

/** Rect of the COMMAND panel. `panelHeight` and `containerHeight` are INPUTS
 * because neither can be derived from `vw`/`vh`: the panel's rendered height
 * depends on its own content and font metrics (number of command rows,
 * line-wrapping), and `containerHeight` is `[data-battle]`'s own rendered
 * height, which measures equal to `vh` at every swept viewport but is passed
 * explicitly rather than assumed. Everything else in this module is a
 * closed-form function of its numeric inputs; this one takes the two measured
 * values as parameters instead of reading them from a global. Real-world
 * values for both live in src/battle/__fixtures__/measuredLayout.ts. */
export function commandPanelRect(vw: number, containerHeight: number, isMobile: boolean, panelHeight: number): Rect {
  if (isMobile) {
    return { left: 10, top: containerHeight - 10 - panelHeight, width: vw - 20, height: panelHeight };
  }
  return { left: 38, top: containerHeight - 38 - panelHeight, width: 262, height: panelHeight };
}

/** Standard AABB overlap test. Edge-touching is NOT intersecting
 * (`a.right === b.left` counts as clear, not overlapping) — every operand
 * uses a strict inequality on purpose. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

/** Max panel height (CSS px) that cannot intersect any actor rect, capped at
 * MENU_PANEL_CEILING. Analytic inverse of the clip invariant: for each actor
 * whose x-band overlaps the panel's x-band, the panel top must stay at or
 * below the actor's bottom edge (rectsIntersect is strict, so touching is
 * legal). */
export const MENU_PANEL_CEILING = 320;
export function panelMaxHeight(
  vw: number,
  containerHeight: number,
  isMobile: boolean,
  actors: Rect[],
): number {
  const probe = commandPanelRect(vw, containerHeight, isMobile, 1);
  const bottomOffset = containerHeight - (probe.top + probe.height);
  let max = MENU_PANEL_CEILING;
  for (const a of actors) {
    const xOverlap = a.left < probe.left + probe.width && probe.left < a.left + a.width;
    if (!xOverlap) continue;
    max = Math.min(max, containerHeight - bottomOffset - (a.top + a.height));
  }
  return Math.max(0, max);
}
