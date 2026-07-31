// Pure stage/panel geometry, extracted out of BattleScene.tsx (M7 plan
// §PR-B, docs/superpowers/specs/2026-07-29-m7-imposter-polish-plan.md,
// task B2). A `.ts` sibling to scenes/cascadeCompose.ts — the local idiom
// for pure geometry that needs the widened coverage gate (`src/battle/**/*.ts`,
// 95% branches) BattleScene.tsx itself never gets, since `.tsx` is not
// matched by vitest.config.ts's coverage globs. That gap is exactly why the
// clone/COMMAND-panel clip this milestone fixes shipped with zero test
// coverage on the math that produces it.
//
// Every formula below is a VERBATIM port — behaviour must stay identical to
// its BattleScene.tsx source line, cited per function. A port that changes
// behaviour is a bug in this file, not an improvement.
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

/** Verbatim port of BattleScene.tsx:194-201 (the `scale`/`stageW`/`stageH`/
 * `stageLeft`/`stageTop` `useMemo`+derived-const block). `SC`/`SR` (256x144,
 * ledger #16) are imported from the same generated module BattleScene.tsx
 * itself imports them from, not re-declared as local literals - this
 * module is now the sole positioning math for every sprite, damage float
 * and target cursor of all four bosses, so agreement with BattleScene must
 * be true by construction, not a coincidence a future canon regeneration
 * could silently break. */
export function stageMetrics(vw: number, vh: number, isMobile: boolean): StageMetrics {
  const fit = Math.min(vw / SC, (vh * 0.72) / SR);
  const scale = isMobile ? vw / SC : Math.max(2, Math.floor(fit * 2) / 2);
  const stageW = SC * scale;
  const stageH = SR * scale;
  const stageLeft = (vw - stageW) / 2;
  const stageTop = isMobile ? Math.max(12, (vh - stageH) * 0.32) : Math.max(8, (vh * 0.86 - stageH) / 2);
  return { scale, stageW, stageH, stageLeft, stageTop };
}

/** Verbatim port of `cellPx` (BattleScene.tsx:729-732), widened into a Rect
 * one cell wide/tall (a single stage cell is `scale` CSS px on a side). */
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
 * originCol]` (stampGrid semantics, ledger #17 — `const rr = r0 + r;`),
 * covering only its PAINTED extent (via `paintedBounds`). `null` for a
 * blank grid, propagated from `paintedBounds`. */
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

/** The COMMAND panel, from BattleScene.tsx:880. `panelHeight` and
 * `containerHeight` are INPUTS, not derivable: the panel's rendered height
 * depends on its own content and font metrics (number of command rows,
 * line-wrapping), and `containerHeight` is `[data-battle]`'s own rendered
 * height, which this session's B1 rig measured as equal to `vh` at every
 * swept viewport but is kept as an explicit parameter rather than assumed,
 * since no pure function can derive either from `vw`/`vh` alone. This is the
 * honest boundary of purity for this module — everything else here is a
 * closed-form function of its numeric inputs; this one function is not, and
 * says so via its inputs rather than hiding it behind a global read. Both
 * values come from tools/measure-battle-layout.mjs's output
 * (docs/battle-prototypes/m12-menu/measured.json /
 * src/battle/__fixtures__/measuredLayout.ts). */
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
 * legal). M12 plan PR-A Task A2. */
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
