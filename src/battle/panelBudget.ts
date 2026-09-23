// Panel height budget against the worst-case actors across all four bosses
// plus the hero, not just the current boss (Alert Storm's swarm binds at
// most tight viewports). Fresh spawns at their real stamp origins, with the
// Imposter forced into CLONES, its widest phase.
import { gridRect, panelMaxHeight, stageMetrics, type Rect } from "./layout";
import { IDLE } from "../generated/heroBattle";
import { HERO_AT, BOSS_AT } from "../generated/battlefieldScene";
import { spawnImposter, type ImposterBoss } from "./bosses/imposter";
import { spawnAlertStorm } from "./bosses/alertStorm";
import { spawnCascade } from "./bosses/cascade";
import { spawnSilentFailure } from "./bosses/silentFailure";
import { sceneFor } from "./scenes/index";
import type { BossState } from "./engine";

const identityDraw = (r: number) => r;
// Fresh spawns are the worst case: actors only die, so bboxes only shrink,
// and formation slots do not depend on the seed. panelBudget.test.ts
// re-derives this independently, so a boss that breaks the assumption fails
// the test, not the player's screen.
const imposterClones: ImposterBoss = { ...spawnImposter(0, identityDraw).boss, phase: "clones" };
const WORST_BOSSES: BossState[] = [
  spawnAlertStorm(0, identityDraw).boss,
  spawnCascade(),
  spawnSilentFailure(),
  imposterClones,
] as BossState[];

export function menuPanelMaxHeight(vw: number, vh: number, containerHeight: number, isMobile: boolean): number {
  const m = stageMetrics(vw, vh, isMobile);
  const actors: Rect[] = [gridRect(m, HERO_AT[0], HERO_AT[1], IDLE[0])].filter((r): r is Rect => r !== null);
  for (const boss of WORST_BOSSES) {
    const scene = sceneFor(boss.kind);
    const grid = scene.composeBoss(boss, false, 0, {});
    const [r0, c0] = scene.stampOrigin?.(boss) ?? BOSS_AT;
    const rect = gridRect(m, r0, c0, grid);
    if (rect) actors.push(rect);
  }
  return panelMaxHeight(vw, containerHeight, isMobile, actors);
}
