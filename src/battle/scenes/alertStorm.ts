// Alert Storm's scene module — arena art, boss composition, plate copy,
// banner text, victory/defeat copy (M6 plan §Scene generalization, PR-1a
// task 6). Moved verbatim from BattleScene.tsx's inline `composeSwarm` +
// JSX copy literals; no rendering behavior changed, only relocated behind
// the `BossSceneModule` interface (./types) so a future Cascade/Silent
// Failure/Imposter module can sit alongside it (./index is the registry).
import type { Bat, BattleState } from "../engine";
import { isScreamTurn } from "../engine";
import {
  SWARM, JIT, batFinal, batFinalPost, eOutline, eDitherAll, eOverlay,
  newG, screamRipple, EROWS, ECOLS,
} from "../../generated/bossAlertStorm";
import type { Grid } from "../../generated/heroBattle";
import { varAS } from "../../generated/battlefieldScene";
import { ALERT_STORM_ID } from "../rushOrder";
import type { BossSceneModule, SceneFx } from "./types";

const SCREAM_BANNER = "THE SWARM SCREAMS · ONE VOICE RUNS RED";

/** Plot the purple mark chevron above a marked bat — three cells, each
 * dropped only if it lands on the stage. Exported so the boundary guard
 * (unreachable through `composeBoss`'s own parameter space at today's fixed
 * SWARM/JIT formation — see the punctuation/coverage test file) is still
 * directly unit-testable. */
export function plotMarkChevron(out: Grid, mr: number, mc: number): void {
  for (const [pr, pc] of [[0, 0], [1, 1], [0, 2]] as const) {
    const rr = mr + pr;
    const cc = mc + pc;
    if (rr >= 0 && rr < EROWS && cc >= 0 && cc < ECOLS) out[rr][cc] = "k";
  }
}

/**
 * Compose the swarm grid from per-bat primitives against engine state (the
 * lab's monolithic reels cannot express per-bat death/marks — M5 plan F7).
 * Order matches the pre-M6 shape exactly: outline + per-bat post-draw +
 * marks, then dither (if any), then the scream ripple overlay (if any) —
 * moving the ripple application inside this function only changes WHERE the
 * step runs, not its order relative to dither.
 */
function composeBoss(bats: Bat[], screaming: boolean, flutter: number, fx: SceneFx): Grid {
  const g = newG();
  const living = bats.filter((b) => b.alive);
  const mouthOf = (b: Bat) => (screaming ? (b.real ? "red" : "hollow") : "stitched");
  const jitter = !!fx.jitter;
  const fallDr = fx.fall ?? 0;
  const ditherMod = fx.dither ?? 0;
  for (const b of living) {
    const [r, c, ph] = SWARM[b.pos];
    const jr = jitter ? JIT[b.pos][0] : 0;
    const jc = jitter ? JIT[b.pos][1] : 0;
    const dr = fallDr > 0 ? fallDr + (b.pos % 3) * 2 : 0;
    batFinal(g, r + jr + dr, c + jc, (flutter + ph) % 2, mouthOf(b));
  }
  let out = eOutline(g);
  for (const b of living) {
    const [r, c, ph] = SWARM[b.pos];
    const jr = jitter ? JIT[b.pos][0] : 0;
    const jc = jitter ? JIT[b.pos][1] : 0;
    const dr = fallDr > 0 ? fallDr + (b.pos % 3) * 2 : 0;
    batFinalPost(out, r + jr + dr, c + jc, (flutter + ph) % 2, mouthOf(b));
    if (b.marked) {
      // purple mark chevron above the bat — the memory tool made visible
      const mr = r + jr + dr - 2;
      const mc = c + jc + 6;
      plotMarkChevron(out, mr, mc);
    }
  }
  if (ditherMod > 0) out = eDitherAll(out, ditherMod);
  if (fx.ripple) out = eOverlay(out, screamRipple(fx.ripple));
  return out;
}

export const alertStormScene: BossSceneModule = {
  id: ALERT_STORM_ID,
  arena: [varAS(0), varAS(1)],
  composeBoss,
  plate: {
    label: "ALERT STORM",
    hiddenLabel: "?? · DEBUG THE SCREAMER",
    footer: (livingCount) => `${livingCount}/10 SIGNALS`,
  },
  banner: (state: BattleState) =>
    state.status === "active" && isScreamTurn(state) ? SCREAM_BANNER : "",
  victoryCopy: {
    eyebrow: "SIGNAL FOUND",
    title: "The Alert Storm breaks",
    forgeLines: ["⚔ FAN OUT · FORGED", "+10 MAX HP · +2 MAX MP"],
    rematchLine: "A VICTORY LAP · THE STORM REMEMBERS",
    footer: "Three more wait in the dark. More coming.",
    cta: "CONTINUE ⏎",
  },
  defeatCopy: {
    eyebrow: "DROWNED OUT",
    title: "The storm takes the sky",
    retryCta: "RETRY ⏎",
    leaveCta: "Leave · back to the gate",
  },
};
