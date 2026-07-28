// The Cascade's scene module — arena art, boss composition, plate copy,
// banner text, victory/defeat copy (M6 plan §Scene generalization / §Renderer
// strategy Cascade, docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md,
// PR-1b task 4). Mirrors scenes/alertStorm.ts's shape behind the same
// `BossSceneModule` interface (./types); `composeCascade` (./cascadeCompose)
// does the actual per-frame region composition.
//
// This registers the module (./index) so it exists and type-checks, but
// wiring it into a user-reachable path (FIGHT submenu, `boss=` capture key,
// App.tsx) is PR-1b task 5 — not this commit's job.
import type { BattleState, BossState } from "../engine";
import type { CascadeBoss } from "../bosses/cascade";
import { CASCADE_ID } from "../bosses/cascade";
import { CAS_ATK, CAS_DIE, CAS_HIT, newG } from "../../generated/bossCascade";
import type { Grid, Reel } from "../../generated/bossCascade";
import { varCC } from "../../generated/battlefieldScene";
import { composeCascade } from "./cascadeCompose";
import type { BossSceneModule, SceneFx } from "./types";

/** Storm telegraph banner. CT's "tells linger" analog (plan §Boss 2 table):
 * presentation-only, shows one boss turn EARLIER while CT is active — the
 * engine's `stormIn` counter is authoritative and this is purely a display
 * threshold over it, no balance coupling. */
const STORM_BANNER = "THE CHAIN OVERLOADS · A STORM GATHERS";

function bannerFor(state: BattleState): string {
  if (state.status !== "active" || state.boss.kind !== CASCADE_ID) return "";
  const boss = state.boss as CascadeBoss;
  const telegraphTurns = state.ctTurns > 0 ? 2 : 1; // CT extra-turn telegraph rule
  return boss.stormIn > 0 && boss.stormIn <= telegraphTurns ? STORM_BANNER : "";
}

/** This module is never invoked with a non-cascade `boss` in practice
 * (BattleScene.tsx selects the scene module by `boss.kind` — see
 * scenes/alertStorm.ts's own composeBoss for the same defensive pattern);
 * the empty-grid fallback is defensive only. */
function composeBoss(boss: BossState, _screaming: boolean, flutter: number, _fx: SceneFx): Grid {
  return boss.kind === CASCADE_ID ? composeCascade(boss, flutter) : newG();
}

export const cascadeScene: BossSceneModule & { reels: { attack: Reel; hit: Reel; die: Reel } } = {
  id: CASCADE_ID,
  arena: [varCC(0), varCC(1)],
  composeBoss,
  plate: {
    label: "THE CASCADE",
    // Cascade never masks — nodes show real HP always (plan §Boss 2
    // "Targeting" row) — this string is structural only, never shown by
    // today's shell (BattleScene.tsx's plate JSX is still Alert-Storm-only;
    // per-node HP readouts are a later task's rendering work).
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
    leaveCta: "Leave · back to the gate",
  },
};
