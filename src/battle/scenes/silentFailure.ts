// The Silent Failure's scene module — arena art, boss composition, plate
// copy (incl. D3's phase-aware labelFor), banner text, victory/defeat copy
// (M6 plan §Scene generalization / §Renderer strategy Silent Failure,
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-2 task 6).
// Mirrors scenes/alertStorm.ts's/scenes/cascade.ts's shape behind the same
// `BossSceneModule` interface (./types). Single entity, no per-entity
// state — monolithic reels are correct here (plan §Renderer strategy).
import type { BattleState, BossState } from "../engine";
import {
  isSilentFailureDefeated,
  SILENT_FAILURE_ID,
} from "../bosses/silentFailure";
import {
  eOverlay,
  newG,
  PIECES,
  SIL_ATK,
  SIL_BODY,
  SIL_DIE,
  SIL_EMPTY,
} from "../../generated/bossSilentFailure";
import type { Grid, Pts } from "../../generated/bossSilentFailure";
import { varSF } from "../../generated/battlefieldScene";
import type { BossSceneModule, SceneFx } from "./types";

/** Same palette key Alert Storm's mark chevron uses (scenes/alertStorm.ts's
 * `plotMarkChevron`) — `PAL["k"] = "#9d6bc4"`, a light purple, matching the
 * plan's "purple mote overlay" language exactly. */
const MOTE_KEY = "k";

/** Purple motes betraying the marked boss's position while vanished —
 * built the way scenes/alertStorm.ts builds its mark chevron (visual only,
 * grants nothing mechanically, M5 mark-chevron precedent), but expressed as
 * an `eOverlay` `Pts` array since bossSilentFailure.js already exports
 * `eOverlay` for exactly this (no need for a mutate-in-place helper).
 * Anchored on `PIECES[0]` (the helmet box on `SIL_EMPTY[0]`) so the motes
 * read as hovering roughly where the head would be, rather than arbitrary
 * coordinates. */
function moteOverlay(): Pts {
  // Helmet box on SIL_EMPTY[0] is [0, 11, 28, 38] — its top edge already
  // sits at row 0, so "above the head" isn't in-bounds; the motes instead
  // drift just outside its left/right edges, clamped so a future PIECES
  // change can't silently push them off-canvas (eOverlay drops out-of-bounds
  // points with no error, which is exactly how a first draft of this
  // function went unnoticed until the unit test below caught it).
  const [r1, r2, c1, c2] = PIECES[0];
  const topR = Math.max(0, r1 - 2);
  return [
    [topR, Math.max(0, c1 - 4), MOTE_KEY],
    [r1 + 2, c2 + 4, MOTE_KEY],
    [r2 - 2, Math.max(0, c1 - 6), MOTE_KEY],
  ];
}

/** Clamp a 1-indexed fx.ripple step onto a reel's frame index. */
function reelFrame(reel: readonly [Grid, number][], step: number): Grid {
  return reel[Math.min(Math.max(step - 1, 0), reel.length - 1)][0];
}

/**
 * Compose the Silent Failure's on-stage grid from engine + fx state.
 * `SIL_BODY`/`SIL_EMPTY` selected by `phase` — body while embodied, empty
 * (untargetable silhouette) while vanished, with the purple mote overlay
 * added on top when marked. `SIL_DIE` is selected unconditionally once
 * `isSilentFailureDefeated` (checked FIRST, before the phase branch below),
 * which is what the signed DoT-kill ruling's `forceBodyForDeath` flag
 * documents: a vanished-phase kill still resolves through this SAME
 * unconditional SIL_DIE branch, never falling through to an empty-armor
 * frame, by construction of this check order (composeBoss doesn't need to
 * branch separately on `forceBodyForDeath`'s value — hp<=0 already implies
 * it correctly, and this is the flag's own doc comment's first and only
 * reader). `SIL_ATK` plays on the vanished-phase ambush, keyed off
 * `fx.ripple` — the SAME generic field the shell already sets during ANY
 * boss's own attack-on-hero animation (`commit()`'s boss-volley steps in
 * BattleScene.tsx), so this branch is live-reachable through real play,
 * unlike SIL_DIE (see this module's own comment below and the task-6
 * report for why the shell has no victory-state render hook at all today).
 * `SIL_HIT` and `SIL_FADE` are deliberately NOT wired this PR — `SIL_FADE`
 * per the plan's own instruction (a phase-flip tween needs a scene-local
 * timer this PR isn't adding, the inert-rider precedent), and `SIL_HIT`
 * because the shell has no equivalent generic "the hero's own hit just
 * landed on the boss" fx signal to key off (Alert Storm's own hit reaction
 * is baked into per-bat state, not an fx-driven reel, so there's no
 * existing precedent to reuse without inventing one) — both stay exported
 * from bossSilentFailure.js and unused here, same as Cascade's dormant
 * `reels` field, rather than guessing a mapping.
 *
 * Takes the whole `BossState` (this module is never invoked with a
 * non-silent-failure `boss` in practice — BattleScene.tsx selects the scene
 * module by `boss.kind`, same defensive pattern as the other two modules);
 * the blank-grid fallback is defensive only.
 */
function composeBoss(boss: BossState, _screaming: boolean, flutter: number, fx: SceneFx): Grid {
  if (boss.kind !== SILENT_FAILURE_ID) return newG();
  if (isSilentFailureDefeated(boss)) {
    return fx.ripple ? reelFrame(SIL_DIE, fx.ripple) : SIL_DIE[SIL_DIE.length - 1][0];
  }
  if (boss.phase === "vanished") {
    if (fx.ripple) return reelFrame(SIL_ATK, fx.ripple);
    const empty = SIL_EMPTY[flutter];
    return boss.marked ? eOverlay(empty, moteOverlay()) : empty;
  }
  return SIL_BODY[flutter];
}

export const silentFailureScene: BossSceneModule = {
  id: SILENT_FAILURE_ID,
  arena: [varSF(0), varSF(1)],
  composeBoss,
  plate: {
    label: "THE SILENT FAILURE",
    // Never shown by today's shell (BattleScene.tsx's plate JSX gates the
    // HP-bar-vs-hiddenLabel swap on `revealBoss`, which is always true for
    // this boss — structural only, matching Cascade's own hiddenLabel note).
    hiddenLabel: "?? · IT IS ALREADY HERE",
    // Single-entity case: livingCount is 0 or 1 (BattleScene.tsx's stopgap
    // derivation, task 4), never the boss's own HP — "TARGET", not "HP".
    footer: (livingCount) => `${livingCount}/1 TARGET`,
    // D3: additive, phase-aware. Alert Storm/Cascade don't implement this,
    // so their output and existing label-property tests stay untouched.
    labelFor: (state: BattleState) => {
      if (state.boss.kind !== SILENT_FAILURE_ID) return "THE SILENT FAILURE";
      return state.boss.phase === "vanished" ? "VANISHED" : "THE SILENT FAILURE";
    },
  },
  // No telegraph/banner mechanic on this boss (unlike Cascade's storm
  // telegraph) — defensively checks boss.kind since punctuation.test.ts
  // calls every registered module's banner against an ALERT-STORM state.
  banner: (_state: BattleState) => "",
  victoryCopy: {
    eyebrow: "TRACED",
    title: "The Silent Failure surfaces",
    forgeLines: ["◈ ROOT CAUSE · FORGED", "+10 MAX HP · +2 MAX MP"],
    rematchLine: "A VICTORY LAP · IT STAYS FOUND",
    footer: "One more waits in the dark. More coming.",
    cta: "CONTINUE ⏎",
  },
  defeatCopy: {
    eyebrow: "LOST IN THE DARK",
    title: "It slips back into the walls",
    retryCta: "RETRY ⏎",
    leaveCta: "Leave · back to the gate",
  },
};
