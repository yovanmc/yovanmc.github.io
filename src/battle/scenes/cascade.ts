// The Cascade's scene module: arena art, boss composition, plate copy, banner
// text, victory/defeat copy. Mirrors scenes/alertStorm.ts's shape behind the
// same `BossSceneModule` interface (./types); `composeCascade`
// (./cascadeCompose) does the actual per-frame region composition.
import type { BattleState, BossState } from "../engine";
import type { CascadeBoss } from "../bosses/cascade";
import { CASCADE_ID } from "../bosses/cascade";
import { CAS_ATK, CAS_DIE, CAS_HIT, newG } from "../../generated/bossCascade";
import type { Grid, Reel } from "../../generated/bossCascade";
import { varCC } from "../../generated/battlefieldScene";
import { composeCascade } from "./cascadeCompose";
import { skipToWork } from "../../landingCopy";
import type { BossSceneModule, SceneFx } from "./types";

/** Storm telegraph banner, the Cascade's analog of CT making tells linger:
 * presentation-only, shown one boss turn EARLIER while CT is active. The
 * engine's `stormIn` counter is authoritative and this is purely a display
 * threshold over it, with no balance coupling. */
const STORM_BANNER = "THE CHAIN OVERLOADS · A STORM GATHERS";

function bannerFor(state: BattleState): string {
  if (state.status !== "active" || state.boss.kind !== CASCADE_ID) return "";
  const boss = state.boss as CascadeBoss;
  const telegraphTurns = state.ctTurns > 0 ? 2 : 1; // CT extra-turn telegraph rule
  return boss.stormIn > 0 && boss.stormIn <= telegraphTurns ? STORM_BANNER : "";
}

/** This module is never invoked with a non-cascade `boss` in practice, since
 * BattleScene.tsx selects the scene module by `boss.kind` (scenes/alertStorm.ts
 * guards its own composeBoss the same way); the empty-grid fallback is
 * defensive only. */
function composeBoss(boss: BossState, _screaming: boolean, flutter: number, _fx: SceneFx): Grid {
  return boss.kind === CASCADE_ID ? composeCascade(boss, flutter) : newG();
}

export const cascadeScene: BossSceneModule & { reels: { attack: Reel; hit: Reel; die: Reel } } = {
  id: CASCADE_ID,
  arena: [varCC(0), varCC(1)],
  composeBoss,
  plate: {
    label: "THE CASCADE",
    // Cascade never masks: its nodes always show real HP, so this string is
    // structural only and BattleScene.tsx's plate JSX never renders it.
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
