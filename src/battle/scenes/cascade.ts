// The Cascade's scene module; `composeCascade` (./cascadeCompose) does the
// per-frame region composition.
import type { BattleState, BossState } from "../engine";
import type { CascadeBoss } from "../bosses/cascade";
import { CASCADE_ID } from "../bosses/cascade";
import { CAS_ATK, CAS_DIE, CAS_HIT, newG } from "../../generated/bossCascade";
import type { Grid, Reel } from "../../generated/bossCascade";
import { varCC } from "../../generated/battlefieldScene";
import { composeCascade } from "./cascadeCompose";
import { skipToWork } from "../../landingCopy";
import type { BossSceneModule, SceneFx } from "./types";

/** Storm telegraph: shown one boss turn earlier while CT is active. A display
 * threshold over the engine's authoritative `stormIn`. */
const STORM_BANNER = "THE CHAIN OVERLOADS · A STORM GATHERS";

function bannerFor(state: BattleState): string {
  if (state.status !== "active" || state.boss.kind !== CASCADE_ID) return "";
  const boss = state.boss as CascadeBoss;
  const telegraphTurns = state.ctTurns > 0 ? 2 : 1; // CT extra-turn telegraph rule
  return boss.stormIn > 0 && boss.stormIn <= telegraphTurns ? STORM_BANNER : "";
}

function composeBoss(boss: BossState, _screaming: boolean, flutter: number, _fx: SceneFx): Grid {
  return boss.kind === CASCADE_ID ? composeCascade(boss, flutter) : newG();
}

export const cascadeScene: BossSceneModule & { reels: { attack: Reel; hit: Reel; die: Reel } } = {
  id: CASCADE_ID,
  arena: [varCC(0), varCC(1)],
  composeBoss,
  plate: {
    label: "THE CASCADE",
    // Never rendered: Cascade nodes always show real HP.
    hiddenLabel: "SIX NODES · REAL HP",
    footer: (livingCount) => `${livingCount}/6 NODES`,
  },
  banner: bannerFor,
  reels: { attack: CAS_ATK, hit: CAS_HIT, die: CAS_DIE },
  victoryCopy: {
    eyebrow: "CHAIN BROKEN",
    title: "The Cascade goes dark",
    forgeLines: ["⚙ ROLLBACK · FORGED", "+10 MAX HP · +2 MAX MP"],
    rematchLine: "A VICTORY LAP · THE CHAIN STAYS QUIET",
    footer: "Two more wait in the dark. More coming.",
    cta: "CONTINUE ⏎",
  },
  defeatCopy: {
    eyebrow: "OVERLOADED",
    title: "The storm rolls through",
    retryCta: "RETRY ⏎",
    leaveCta: skipToWork,
  },
};
