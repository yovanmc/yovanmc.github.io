// Pure stage/panel geometry — M7 PR-B task B2
// (docs/superpowers/specs/2026-07-29-m7-imposter-polish-plan.md). Every
// formula in layout.ts is a verbatim port of BattleScene.tsx's inline
// geometry; this file is the coverage this math has never had (`.tsx` is
// not matched by vitest.config.ts's `src/battle/**/*.ts` coverage globs,
// ledger #10).
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
import { imposterScene } from "./scenes/imposter";
import { sceneFor } from "./scenes/index";
import type { BossState } from "./engine";

const identityDraw = (r: number) => r;

/** Same idiom as scenes/imposter.test.ts's own `fresh` (ledger #29) —
 * duplicated here rather than importing a .test.ts file across modules. */
function fresh(overrides: Partial<ImposterBoss> = {}): ImposterBoss {
  return { ...spawnImposter(0, identityDraw).boss, ...overrides };
}

describe("stageMetrics", () => {
  // 1a — the real oracle: hand-computed from the verbatim formula this
  // session (BattleScene.tsx:194-201), independent of the port and of the
  // DOM. toBeCloseTo, not toBe: 1440x720's stageTop evaluates to
  // 57.60000000000002 in IEEE doubles.
  it.each([
    { vw: 1440, vh: 900, isMobile: false, scale: 4.5, stageW: 1152, stageH: 648, stageLeft: 144, stageTop: 63 },
    { vw: 1440, vh: 720, isMobile: false, scale: 3.5, stageW: 896, stageH: 504, stageLeft: 272, stageTop: 57.6 },
    // Drives the Math.max(2, ...) scale clamp (raw floor(fit*2)/2 = 1.5) —
    // a correctness case; per the plan, Math.max is a function call, not an
    // instrumented branch, so this contributes zero to the branch count.
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

  // 1b — a DOM cross-check, separate from 1a on purpose: this only proves
  // the port and the live app agree (transcription), not that either is
  // correct — 1a is the actual correctness oracle. ±0.5px tolerance:
  // browser layout snaps to 1/64 CSS px (measured directly: 1440x720's
  // container-relative canvas left measured 57.59375 against the exact
  // 57.6 arithmetic value — a real subpixel-snap, not test flakiness).
  it("agrees with real headless-Edge measurements (transcription check only, not a correctness oracle)", () => {
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
  it("returns null for a blank grid (every cell null)", () => {
    const blank: Grid = [
      [null, null],
      [null, null],
    ];
    expect(paintedBounds(blank)).toBeNull();
  });

  it("returns null for a zero-row grid", () => {
    expect(paintedBounds([])).toBeNull();
  });

  it("returns the same cell's index four times for a single painted cell", () => {
    const grid: Grid = [
      [null, null, null],
      [null, "X", null],
    ];
    expect(paintedBounds(grid)).toEqual({ top: 1, left: 1, bottom: 1, right: 1 });
  });

  it("handles a ragged grid (rows of differing length) without an index error", () => {
    const ragged: Grid = [["X"], [null, null, "Y"]];
    expect(() => paintedBounds(ragged)).not.toThrow();
    expect(paintedBounds(ragged)).toEqual({ top: 0, left: 0, bottom: 1, right: 2 });
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

  it("returns the painted cell's rect offset by the stamp origin ([r0,c0] is TOP-LEFT, ledger #17)", () => {
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
  // Full truth table: each of the four AABB conjuncts must independently
  // evaluate false at least once (v8 branch coverage), plus one true
  // overlap. a is fixed at {0,0,10,10} throughout except where noted.
  const a = { left: 0, top: 0, width: 10, height: 10 };

  it("false: b entirely right of a (with a gap)", () => {
    const b = { left: 20, top: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it("false: b entirely left of a", () => {
    const shifted = { left: 20, top: 0, width: 10, height: 10 };
    const b = { left: 0, top: 0, width: 10, height: 10 };
    expect(rectsIntersect(shifted, b)).toBe(false);
  });

  it("false: b entirely above a", () => {
    const shifted = { left: 0, top: 20, width: 10, height: 10 };
    const b = { left: 0, top: 0, width: 10, height: 10 };
    expect(rectsIntersect(shifted, b)).toBe(false);
  });

  it("false: b entirely below a (with a gap)", () => {
    const b = { left: 0, top: 20, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it("true: a genuine overlap", () => {
    const b = { left: 5, top: 5, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it("edge-touching is NOT intersecting (a.right === b.left)", () => {
    const b = { left: 10, top: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });
});

describe("M7 clip invariant — leftmost clone AND hero vs COMMAND panel", () => {
  // Task B2 test 4, the red step: for every sweep viewport, the leftmost
  // clone's painted rect must not intersect the COMMAND panel rect. Derived
  // through the REAL public seams (stampOrigin/composeBoss), never
  // hardcoded numbers, so a fix in either candidate direction (B4) is
  // picked up automatically.
  //
  // Task B5 (owner-ruled Option C, flat `maxHeight: 150` on the COMMAND
  // panel): the invariant below was skipped after B2 observed it failing,
  // and is now re-enabled (parameterized `it`, one case per row) now that
  // `measured.json`/`measuredLayout.ts` have been regenerated post-fix
  // (panelHeight 150 at every viewport, was 362). Passes at all 12 swept
  // viewports — see the builder report for the full table.
  //
  // Also guards the PLAYER hero (dispatch follow-up to the original plan:
  // the visual judge at the B4 gate found the panel clips the hero's legs
  // at 360x640 too, not just the clones). `IDLE[0]` is the same real public
  // seam BattleScene.tsx itself reads for the hero's idle pose
  // (`IDLE[flutter]`, BattleScene.tsx `heroBase`), stamped at the real
  // `HERO_AT` anchor — never a hardcoded rect.
  //
  // A parameterized case per row (not one test looping all 12 rows): a
  // single test with an internal loop only ever reports the FIRST failing
  // row per run (the assertion throws and stops the loop). A row-per-case
  // run reports every failing viewport at once, not just the first.
  //
  // boss/stampOrigin/grid/heroGrid are viewport-independent (CLONES-phase
  // composition and the hero's idle pose don't vary by viewport), so
  // they're computed once here rather than per-row — still through the
  // same real public seams.
  const boss = fresh({ phase: "clones" });
  const [r0, c0] = imposterScene.stampOrigin!(boss);
  const grid = imposterScene.composeBoss(boss, false, 0, {});
  const heroGrid: Grid = IDLE[0];

  it.each(MEASURED_LAYOUT)(
    "$vw x $vh — leftmost clone does not overlap the COMMAND panel",
    (row) => {
      const m = stageMetrics(row.vw, row.vh, row.isMobile);
      const clone = gridRect(m, r0, c0, grid)!;
      const panel = commandPanelRect(row.vw, row.containerHeight, row.isMobile, row.panelHeight);
      // AABB overlap depth on each axis, independent of rectsIntersect's
      // strict-inequality convention — reported in the failure message
      // (via expect's message argument) without loosening the assertion
      // itself, which still asserts the boolean, not the overlap amount.
      const overlapX = Math.min(clone.left + clone.width, panel.left + panel.width) - Math.max(clone.left, panel.left);
      const overlapY = Math.min(clone.top + clone.height, panel.top + panel.height) - Math.max(clone.top, panel.top);
      expect(
        rectsIntersect(clone, panel),
        `${row.vw}x${row.vh}: overlap x=${overlapX.toFixed(2)}px y=${overlapY.toFixed(2)}px (negative = clear on that axis)`,
      ).toBe(false);
    },
  );

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

describe("panelMaxHeight — unit cases (M12 plan PR-A Task A2, test 3)", () => {
  // Desktop probe: commandPanelRect(vw, containerHeight, false, 1) -> left 38,
  // width 262, top = containerHeight - 38 - 1. bottomOffset is always 38 on
  // this arm regardless of panelHeight (the probe-then-subtract trick).
  it("an actor entirely clear of the panel's x-band is ignored (ceiling wins)", () => {
    // Panel x-band is [38, 300) at 1440x900 desktop. This actor sits to the
    // right of it entirely (left 500), so it must not constrain the budget.
    const clearActor = { left: 500, top: 0, width: 50, height: 900 };
    expect(panelMaxHeight(1440, 900, false, [clearActor])).toBe(MENU_PANEL_CEILING);
  });

  it("an empty actor list returns the ceiling", () => {
    expect(panelMaxHeight(1440, 900, false, [])).toBe(MENU_PANEL_CEILING);
  });

  it("result is never negative even when an actor overlaps the panel's whole x-band down to the floor", () => {
    // Actor spans the full panel x-band and reaches all the way to the
    // container's bottom edge — the tightest possible squeeze.
    const floorActor = { left: 0, top: 0, width: 1440, height: 900 };
    expect(panelMaxHeight(1440, 900, false, [floorActor])).toBe(0);
  });

  it("an overlapping actor above the panel constrains the budget below the ceiling", () => {
    // Actor bottom edge at y=700, well above the container's bottom (900) —
    // budget = containerHeight - bottomOffset(38) - actorBottom(700) = 162.
    const actor = { left: 38, top: 650, width: 262, height: 50 };
    expect(panelMaxHeight(1440, 900, false, [actor])).toBe(162);
  });
});

describe("commandPanelRect", () => {
  it("desktop arm: left 38, width 262, top derived from containerHeight/panelHeight", () => {
    expect(commandPanelRect(1440, 900, false, 200)).toEqual({ left: 38, top: 900 - 38 - 200, width: 262, height: 200 });
  });

  it("mobile arm: left 10, width vw-20 (right:10 + width:auto), top derived the same way", () => {
    expect(commandPanelRect(390, 844, true, 220)).toEqual({ left: 10, top: 844 - 10 - 220, width: 390 - 20, height: 220 });
  });
});

// M12 plan PR-B task B2 (docs/superpowers/specs/2026-07-30-m12-command-menu-plan.md).
// The generated fixture now carries a per-level `levels.{top,skills,spells}`
// breakdown (walked across every cursor position within each level, max kept
// — owner-ruled amendment, 2026-07-30 build session: panel height is
// cursor-dependent since the footer renders the active row's description and
// long ones wrap a second line).
describe("B2 item 4: rendered cap honored (per row, MEASURED_LAYOUT)", () => {
  // ±0.5 for the known 1/64-px browser snap (same tolerance layout.ts's own
  // doc comment and the M7 stageMetrics DOM cross-check use).
  it.each(MEASURED_LAYOUT)("$vw x $vh — panelHeight (max over levels) <= menuPanelMaxHeight + 0.5", (row) => {
    const budget = menuPanelMaxHeight(row.vw, row.vh, row.containerHeight, row.isMobile);
    expect(row.panelHeight, `${row.vw}x${row.vh}: panelHeight=${row.panelHeight} budget=${budget}`).toBeLessThanOrEqual(
      budget + 0.5,
    );
  });
});

describe("B2 item 4: scroll acceptance (ruling 3 AS AMENDED, 2026-07-30)", () => {
  // Both directions are load-bearing (plan's explicit instruction): the
  // "nothing else scrolls anywhere" half is what would catch a compaction
  // regression leaking scroll onto a real viewport, so this is NOT weakened
  // to a one-directional check.
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

describe("B2 item 4: per-boss clip invariant (lens-#127 institutionalized)", () => {
  // Independently re-derived here (not imported from panelBudget.ts's own
  // WORST_BOSSES), same idiom as panelBudget.test.ts's ALL_ACTORS — the test
  // proves the fixture's panelHeight against the SAME real public seams
  // panelBudget.ts uses, rather than trusting its internals.
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
