// Pure stage/panel geometry for BattleScene.tsx, kept in a `.ts` module so
// the coverage globs (`src/battle/**/*.ts`) match it. Must stay behaviourally
// identical to the render path that consumes it.
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

/** Stage scale and on-screen stage rect for a viewport. `SC`/`SR` come from
 * the generated module BattleScene uses, so the two agree by construction
 * and survive a canon regeneration. */
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

/** Inclusive cell bounds of the painted cells in `grid`, or `null` when blank.
 * Ragged rows are safe: each row is indexed only up to its own length. */
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

/** Container-relative rect of the painted extent of `grid` stamped top-left
 * at `[originRow, originCol]`; `null` for a blank grid. */
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

/** Rect of the COMMAND panel. `panelHeight` and `containerHeight` are inputs
 * because neither derives from `vw`/`vh`: panel height depends on content and
 * font metrics, and the container height is measured (it equals `vh` at every
 * swept viewport). Real values live in __fixtures__/measuredLayout.ts. */
export function commandPanelRect(vw: number, containerHeight: number, isMobile: boolean, panelHeight: number): Rect {
  if (isMobile) {
    return { left: 10, top: containerHeight - 10 - panelHeight, width: vw - 20, height: panelHeight };
  }
  return { left: 38, top: containerHeight - 38 - panelHeight, width: 262, height: panelHeight };
}

/** AABB overlap. Edge-touching is clear, not intersecting: every comparison
 * is strict on purpose. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

/** Max panel height (CSS px) that cannot intersect any actor rect, capped at
 * MENU_PANEL_CEILING. For each actor overlapping the panel's x-band, the
 * panel top stays at or below the actor's bottom edge (touching is legal). */
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
