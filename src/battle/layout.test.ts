// Pure stage/panel geometry. It lives in a `.ts` module because the coverage
// globs match `src/battle/**/*.ts`, not `.tsx`.
import { describe, expect, it } from "vitest";
import {
  cellRect,
  commandPanelRect,
  gridRect,
  MENU_PANEL_CEILING,
  paintedBounds,
  panelMaxHeight,
  rectsIntersect,
  stageMetrics,
} from "./layout";
import { menuPanelMaxHeight } from "./panelBudget";
import { MEASURED_LAYOUT } from "./__fixtures__/measuredLayout";
import { IDLE, type Grid } from "../generated/heroBattle";
import { BOSS_AT, HERO_AT } from "../generated/battlefieldScene";
import { spawnImposter, type ImposterBoss } from "./bosses/imposter";
import { spawnAlertStorm } from "./bosses/alertStorm";
import { spawnCascade } from "./bosses/cascade";
import { spawnSilentFailure } from "./bosses/silentFailure";
import { sceneFor } from "./scenes/index";
import type { BossState } from "./engine";

const identityDraw = (r: number) => r;

describe("stageMetrics", () => {
  // Hand-computed expectations, independent of the implementation. toBeCloseTo
  // because 1440x720's stageTop is 57.60000000000002 in IEEE doubles.
  it.each([
    { vw: 1440, vh: 900, isMobile: false, scale: 4.5, stageW: 1152, stageH: 648, stageLeft: 144, stageTop: 63 },
    { vw: 1440, vh: 720, isMobile: false, scale: 3.5, stageW: 896, stageH: 504, stageLeft: 272, stageTop: 57.6 },
    // Drives the Math.max(2, ...) scale clamp (raw floor(fit*2)/2 = 1.5).
    { vw: 1280, vh: 360, isMobile: false, scale: 2, stageW: 512, stageH: 288, stageLeft: 384, stageTop: 10.8 },
    // Drives the Math.max(8, ...) stageTop floor.
    { vw: 1280, vh: 340, isMobile: false, scale: 2, stageW: 512, stageH: 288, stageLeft: 384, stageTop: 8 },
    // Mobile arm of both ternaries.
    { vw: 759, vh: 900, isMobile: true, scale: 2.96484375, stageW: 759, stageH: 426.9375, stageLeft: 0, stageTop: 151.38 },
    { vw: 390, vh: 844, isMobile: true, scale: 1.5234375, stageW: 390, stageH: 219.375, stageLeft: 0, stageTop: 199.88 },
    { vw: 360, vh: 640, isMobile: true, scale: 1.40625, stageW: 360, stageH: 202.5, stageLeft: 0, stageTop: 140 },
  ])(
    "$vw x $vh (mobile=$isMobile) -> scale=$scale stageW=$stageW stageH=$stageH stageLeft=$stageLeft stageTop=$stageTop",
    ({ vw, vh, isMobile, scale, stageW, stageH, stageLeft, stageTop }) => {
      const m = stageMetrics(vw, vh, isMobile);
      expect(m.scale).toBeCloseTo(scale, 6);
      expect(m.stageW).toBeCloseTo(stageW, 6);
      expect(m.stageH).toBeCloseTo(stageH, 6);
      expect(m.stageLeft).toBeCloseTo(stageLeft, 6);
      expect(m.stageTop).toBeCloseTo(stageTop, 6);
    },
  );

  // DOM cross-check: proves only that this module and the live app agree.
  // ±0.5px because browser layout snaps to 1/64 CSS px (57.59375 measured
  // against the exact 57.6).
  it("agrees with real headless-Edge measurements at every measured viewport", () => {
    for (const row of MEASURED_LAYOUT) {
      const m = stageMetrics(row.vw, row.vh, row.isMobile);
      expect(m.stageLeft).toBeCloseTo(row.canvasRect.left, 0);
      expect(m.stageTop).toBeCloseTo(row.canvasRect.top, 0);
      expect(m.stageW).toBeCloseTo(row.canvasRect.width, 0);
      expect(m.stageH).toBeCloseTo(row.canvasRect.height, 0);
    }
  });
});

describe("paintedBounds", () => {
  it.each<{ name: string; grid: Grid; expected: ReturnType<typeof paintedBounds> }>([
    {
      name: "returns null for a blank grid (every cell null)",
      grid: [
        [null, null],
        [null, null],
      ],
      expected: null,
    },
    { name: "returns null for a zero-row grid", grid: [], expected: null },
    {
      name: "returns the same cell's index four times for a single painted cell",
      grid: [
        [null, null, null],
        [null, "X", null],
      ],
      expected: { top: 1, left: 1, bottom: 1, right: 1 },
    },
    {
      name: "handles a ragged grid (rows of differing length) without an index error",
      grid: [["X"], [null, null, "Y"]],
      expected: { top: 0, left: 0, bottom: 1, right: 2 },
    },
  ])("$name", ({ grid, expected }) => {
    expect(() => paintedBounds(grid)).not.toThrow();
    expect(paintedBounds(grid)).toEqual(expected);
  });
});

describe("gridRect", () => {
  const m = stageMetrics(1440, 900, false); // scale 4.5, stageLeft 144, stageTop 63

  it("returns null for a blank grid", () => {
    const blank: Grid = [
      [null, null],
      [null, null],
    ];
    expect(gridRect(m, 0, 0, blank)).toBeNull();
  });

  it("returns the painted cell's rect offset by the stamp origin ([r0,c0] is TOP-LEFT)", () => {
    // Painted cell at local (row 1, col 0); stamp origin [5, 10].
    const grid: Grid = [
      [null, null],
      ["X", null],
    ];
    const rect = gridRect(m, 5, 10, grid);
    expect(rect).toEqual(cellRect(m, 5 + 1, 10 + 0));
  });
});

describe("rectsIntersect", () => {
  // Each of the four AABB conjuncts must evaluate false at least once (branch
  // coverage), plus one true overlap. `a` is fixed unless noted.
  const a = { left: 0, top: 0, width: 10, height: 10 };

  it.each([
    { name: "false: b entirely right of a (with a gap)", a, b: { left: 20, top: 0, width: 10, height: 10 }, expected: false },
    { name: "false: b entirely left of a", a: { left: 20, top: 0, width: 10, height: 10 }, b: { left: 0, top: 0, width: 10, height: 10 }, expected: false },
    { name: "false: b entirely above a", a: { left: 0, top: 20, width: 10, height: 10 }, b: { left: 0, top: 0, width: 10, height: 10 }, expected: false },
    { name: "false: b entirely below a (with a gap)", a, b: { left: 0, top: 20, width: 10, height: 10 }, expected: false },
    { name: "true: a genuine overlap", a, b: { left: 5, top: 5, width: 10, height: 10 }, expected: true },
    { name: "edge-touching is NOT intersecting (a.right === b.left)", a, b: { left: 10, top: 0, width: 10, height: 10 }, expected: false },
  ])("$name", ({ a: ra, b, expected }) => {
    expect(rectsIntersect(ra, b)).toBe(expected);
  });
});

describe("clip invariant: hero vs COMMAND panel", () => {
  // At every swept viewport, the hero's painted rect (`IDLE[0]` at `HERO_AT`; the
  // panel can clip his legs at 360x640) may not intersect the COMMAND panel. It
  // comes from the real public seams, never hardcoded numbers. The clones are
  // checked by the per-boss clip invariant.
  //
  // One case per viewport, not one looping test, so every bad viewport is
  // reported, not just the first.
  const heroGrid: Grid = IDLE[0];

  it.each(MEASURED_LAYOUT)(
    "$vw x $vh — hero does not overlap the COMMAND panel",
    (row) => {
      const m = stageMetrics(row.vw, row.vh, row.isMobile);
      const hero = gridRect(m, HERO_AT[0], HERO_AT[1], heroGrid)!;
      const panel = commandPanelRect(row.vw, row.containerHeight, row.isMobile, row.panelHeight);
      const overlapX = Math.min(hero.left + hero.width, panel.left + panel.width) - Math.max(hero.left, panel.left);
      const overlapY = Math.min(hero.top + hero.height, panel.top + panel.height) - Math.max(hero.top, panel.top);
      expect(
        rectsIntersect(hero, panel),
        `${row.vw}x${row.vh}: overlap x=${overlapX.toFixed(2)}px y=${overlapY.toFixed(2)}px (negative = clear on that axis)`,
      ).toBe(false);
    },
  );
});

describe("panelMaxHeight unit cases", () => {
  // Desktop probe: commandPanelRect(vw, containerHeight, false, 1) -> left 38,
  // width 262, top = containerHeight - 38 - 1. bottomOffset is always 38 on
  // this arm (the probe-then-subtract trick).
  it.each([
    {
      // The panel x-band is [38, 300) at 1440x900; this actor sits right of it.
      name: "an actor entirely clear of the panel's x-band is ignored (ceiling wins)",
      actors: [{ left: 500, top: 0, width: 50, height: 900 }],
      expected: MENU_PANEL_CEILING,
    },
    { name: "an empty actor list returns the ceiling", actors: [], expected: MENU_PANEL_CEILING },
    {
      // Spans the whole x-band down to the container bottom: the tightest squeeze.
      name: "result is never negative even when an actor overlaps the panel's whole x-band down to the floor",
      actors: [{ left: 0, top: 0, width: 1440, height: 900 }],
      expected: 0,
    },
    {
      // Bottom at y=700, so budget = 900 - 38 - 700 = 162.
      name: "an overlapping actor above the panel constrains the budget below the ceiling",
      actors: [{ left: 38, top: 650, width: 262, height: 50 }],
      expected: 162,
    },
  ])("$name", ({ actors, expected }) => {
    expect(panelMaxHeight(1440, 900, false, actors)).toBe(expected);
  });
});

describe("commandPanelRect", () => {
  it.each([
    {
      name: "desktop arm: left 38, width 262, top derived from containerHeight/panelHeight",
      vw: 1440,
      containerHeight: 900,
      isMobile: false,
      panelHeight: 200,
      expected: { left: 38, top: 900 - 38 - 200, width: 262, height: 200 },
    },
    {
      name: "mobile arm: left 10, width vw-20 (right:10 + width:auto), top derived the same way",
      vw: 390,
      containerHeight: 844,
      isMobile: true,
      panelHeight: 220,
      expected: { left: 10, top: 844 - 10 - 220, width: 390 - 20, height: 220 },
    },
  ])("$name", ({ vw, containerHeight, isMobile, panelHeight, expected }) => {
    expect(commandPanelRect(vw, containerHeight, isMobile, panelHeight)).toEqual(expected);
  });
});

// The fixture's per-level heights are the max over every cursor position:
// the footer shows the active row's description, and long ones wrap.
describe("rendered panel height honored at every measured viewport", () => {
  // ±0.5 for the 1/64-px browser snap.
  it.each(MEASURED_LAYOUT)("$vw x $vh — panelHeight (max over levels) <= menuPanelMaxHeight + 0.5", (row) => {
    const budget = menuPanelMaxHeight(row.vw, row.vh, row.containerHeight, row.isMobile);
    expect(row.panelHeight, `${row.vw}x${row.vh}: panelHeight=${row.panelHeight} budget=${budget}`).toBeLessThanOrEqual(
      budget + 0.5,
    );
  });
});

describe("scroll acceptance", () => {
  // Both directions matter: "nothing else scrolls" is what catches a
  // compaction regression, so this stays an exact-set check.
  it("the scrollable set is EXACTLY {(800x600,top), (800x600,skills), (800x600,spells)}", () => {
    const actual = new Set<string>();
    for (const row of MEASURED_LAYOUT) {
      for (const level of ["top", "skills", "spells"] as const) {
        if (row.levels[level].scrollable) actual.add(`${row.vw}x${row.vh}/${level}`);
      }
    }
    const expected = new Set(["800x600/top", "800x600/skills", "800x600/spells"]);
    expect([...actual].sort()).toEqual([...expected].sort());
  });
});

describe("per-boss clip invariant", () => {
  // Re-derived rather than imported from panelBudget.ts's WORST_BOSSES, so the
  // check goes through the public seams, not panelBudget's internals.
  const ALL_ACTORS: { label: string; boss: BossState }[] = [
    { label: "alertStorm", boss: spawnAlertStorm(0, identityDraw).boss },
    { label: "cascade", boss: spawnCascade() },
    { label: "silentFailure", boss: spawnSilentFailure() },
    { label: "imposter (clones)", boss: { ...spawnImposter(0, identityDraw).boss, phase: "clones" } as ImposterBoss },
  ];

  for (const { label, boss } of ALL_ACTORS) {
    it.each(MEASURED_LAYOUT)(`$vw x $vh — ${label} does not overlap the COMMAND panel (fixture panelHeight)`, (row) => {
      const m = stageMetrics(row.vw, row.vh, row.isMobile);
      const scene = sceneFor(boss.kind);
      const grid = scene.composeBoss(boss, false, 0, {});
      const [r0, c0] = scene.stampOrigin?.(boss) ?? BOSS_AT;
      const actorRect = gridRect(m, r0, c0, grid)!;
      const panel = commandPanelRect(row.vw, row.containerHeight, row.isMobile, row.panelHeight);
      expect(
        rectsIntersect(actorRect, panel),
        `${row.vw}x${row.vh}: ${label} overlaps the COMMAND panel at fixture panelHeight=${row.panelHeight}`,
      ).toBe(false);
    });
  }
});
