// Viewport-aware panel height budget, computed against the worst-case actor
// set across ALL FOUR bosses plus the hero, not just the current boss: Alert
// Storm's swarm is the binding actor at most tight viewports. Fresh spawns
// per boss at their real stamp origins (`stampOrigin` is overridden only by
// imposter, everything else stamps at BOSS_AT), with imposter forced to its
// CLONES phase, its own worst case. The spawn helper mirrors layout.test.ts's
// `fresh` helper, duplicated here rather than importing across a .test.ts
// file.
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
// Fresh-spawn compositions are the per-boss worst cases: full occupancy
// (bats/clones die, bboxes only shrink), and formation slots are structural,
// not seed-driven (seed picks hidden identities, not positions), the same
// determinism the clip invariant already relies on. The property test in
// panelBudget.test.ts re-derives all of this independently; if a future boss
// breaks the assumption the test goes red, not the player's screen.
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
