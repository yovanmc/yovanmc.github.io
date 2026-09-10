// Scene-module registry: one entry per boss id. `sceneFor` falls back to Alert
// Storm rather than throwing, so an unknown id can never crash the deployed
// site; `IMPLEMENTED_BOSSES` already gates the `boss=` parameter upstream in
// bootParams.ts.
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
