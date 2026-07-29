// Scene-module registry (M6 plan §Scene generalization, PR-1a task 6). One
// entry per boss id; later PRs add cascade/silentFailure/imposter alongside
// alertStorm here. `sceneFor` falls back to Alert Storm rather than throwing
// — matches the rest of M6's "never a crash path on the auto-deploy site"
// posture (pass-2 G1), and today it's the only boss id that can ever be
// requested (`IMPLEMENTED_BOSSES` gates `boss=` upstream in bootParams.ts).
import { alertStormScene } from "./alertStorm";
import { cascadeScene } from "./cascade";
import { silentFailureScene } from "./silentFailure";
import { imposterScene } from "./imposter";
import type { BossSceneModule } from "./types";

export const SCENE_MODULES: Record<string, BossSceneModule> = {
  [alertStormScene.id]: alertStormScene,
  [cascadeScene.id]: cascadeScene,
  [silentFailureScene.id]: silentFailureScene,
  [imposterScene.id]: imposterScene,
};

export function sceneFor(bossId: string): BossSceneModule {
  return SCENE_MODULES[bossId] ?? alertStormScene;
}

export type { BossSceneModule, DefeatCopy, SceneFx, ScenePlate, VictoryCopy } from "./types";
