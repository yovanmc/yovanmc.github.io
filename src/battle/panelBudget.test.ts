// Coverage for the viewport-aware panel height budget. The worst-case actor
// set spans all four bosses' fresh compositions plus imposter's CLONES phase
// plus the hero, not just the boss currently on screen.
import { describe, expect, it } from "vitest";
import { menuPanelMaxHeight } from "./panelBudget";
import { commandPanelRect, gridRect, MENU_PANEL_CEILING, rectsIntersect, stageMetrics } from "./layout";
import { MEASURED_LAYOUT } from "./__fixtures__/measuredLayout";
import { IDLE, type Grid } from "../generated/heroBattle";
import { HERO_AT, BOSS_AT } from "../generated/battlefieldScene";
import { spawnImposter, type ImposterBoss } from "./bosses/imposter";
import { spawnAlertStorm } from "./bosses/alertStorm";
import { spawnCascade } from "./bosses/cascade";
import { spawnSilentFailure } from "./bosses/silentFailure";
import { sceneFor } from "./scenes/index";
import type { BossState } from "./engine";

const identityDraw = (r: number) => r;

// Re-derived, not imported from panelBudget.ts's WORST_BOSSES, so the
// property test checks it through the public seams.
const ALL_ACTORS: { label: string; boss: BossState }[] = [
  { label: "alertStorm", boss: spawnAlertStorm(0, identityDraw).boss },
  { label: "cascade", boss: spawnCascade() },
  { label: "silentFailure", boss: spawnSilentFailure() },
  { label: "imposter (clones)", boss: { ...spawnImposter(0, identityDraw).boss, phase: "clones" } as ImposterBoss },
];

function actorRect(m: ReturnType<typeof stageMetrics>, boss: BossState): { left: number; top: number; width: number; height: number } | null {
  const scene = sceneFor(boss.kind);
  const grid = scene.composeBoss(boss, false, 0, {});
  const [r0, c0] = scene.stampOrigin?.(boss) ?? BOSS_AT;
  return gridRect(m, r0, c0, grid);
}

describe("menuPanelMaxHeight: the budget never intersects any actor, and is tight", () => {
  for (const row of MEASURED_LAYOUT) {
    for (const { label, boss } of ALL_ACTORS) {
      it(`${row.vw}x${row.vh} vs ${label}: budget height does not intersect`, () => {
        const m = stageMetrics(row.vw, row.vh, row.isMobile);
        const budget = menuPanelMaxHeight(row.vw, row.vh, row.containerHeight, row.isMobile);
        const panel = commandPanelRect(row.vw, row.containerHeight, row.isMobile, budget);
        const rect = actorRect(m, boss);
        if (rect) expect(rectsIntersect(panel, rect)).toBe(false);
      });

      it(`${row.vw}x${row.vh} vs ${label}: hero does not intersect at budget height`, () => {
        const m = stageMetrics(row.vw, row.vh, row.isMobile);
        const budget = menuPanelMaxHeight(row.vw, row.vh, row.containerHeight, row.isMobile);
        const panel = commandPanelRect(row.vw, row.containerHeight, row.isMobile, budget);
        const heroRect = gridRect(m, HERO_AT[0], HERO_AT[1], IDLE[0] as Grid);
        if (heroRect) expect(rectsIntersect(panel, heroRect)).toBe(false);
      });
    }

    it(`${row.vw}x${row.vh}: budget is TIGHT (height+1 intersects at least one actor) when below the ceiling`, () => {
      const m = stageMetrics(row.vw, row.vh, row.isMobile);
      const budget = menuPanelMaxHeight(row.vw, row.vh, row.containerHeight, row.isMobile);
      if (budget >= MENU_PANEL_CEILING) return; // unbounded viewport, tightness doesn't apply
      const widerPanel = commandPanelRect(row.vw, row.containerHeight, row.isMobile, budget + 1);
      const rects = [
        gridRect(m, HERO_AT[0], HERO_AT[1], IDLE[0] as Grid),
        ...ALL_ACTORS.map(({ boss }) => actorRect(m, boss)),
      ].filter((r): r is NonNullable<typeof r> => r !== null);
      const anyIntersects = rects.some((r) => rectsIntersect(widerPanel, r));
      expect(anyIntersects).toBe(true);
    });
  }
});

describe("menuPanelMaxHeight: pinned values (tolerance +/-1)", () => {
  // containerHeight = vh at every swept viewport (measured).
  it.each([
    [800, 600, false, 148],
    [1280, 800, false, 210],
    [1024, 768, false, 217],
    [1440, 900, false, 245],
    [360, 640, true, 315],
    [1920, 1080, false, 320],
  ] as const)("%ix%i (mobile=%s) -> %i", (vw, vh, isMobile, expected) => {
    const budget = menuPanelMaxHeight(vw, vh, vh, isMobile);
    expect(Math.abs(budget - expected)).toBeLessThanOrEqual(1);
  });
});
