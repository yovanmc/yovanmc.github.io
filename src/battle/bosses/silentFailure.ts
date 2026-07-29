// The Silent Failure — boss 3's single-entity vanish-cycle state and
// mechanics, behind the per-boss interface bosses/cascade.ts established (M6
// plan PR-2 task 3, docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md).
// This module is pure mechanics only: initBattle boot wiring (task 5),
// IMPLEMENTED_BOSSES growth (task 4), and the D2 targetability GATE that
// decides whether pt/debug/fo are legal (also task 4, in engine.ts's
// pre-validate block) all live outside this file — the exported functions
// below are unit-tested directly against synthetic SilentFailureBoss states,
// not yet reached through battleReduce.
//
// Swing/ambush damage (boss -> hero) routes through engine.ts's
// `takenDamage` (CT/Conviction-aware), per §Multipliers — same as Cascade's
// jolt/storm.
//
// D2's whiff rule (attack while vanished deals 0, no MP gain) and the signed
// DoT-kill ruling (forceBodyForDeath) are both engine.ts call-site concerns
// (task 4), not this module's: `damageSilentFailure` is a plain, unconditional
// hp-reduction — callers decide what amount to pass in and what to do with a
// killing blow that lands while vanished.
import { takenDamage } from "../engine";

/** Canonical definition lives in ../rushOrder (same pattern as cascade.ts's
 * CASCADE_ID re-export — bootParams.ts needs it without pulling the
 * engine.ts<->silentFailure.ts cycle into the eagerly loaded landing
 * bundle). Landed in rushOrder.ts by THIS task (pass-2 J5), not task 4. */
export { SILENT_FAILURE_ID } from "../rushOrder";

export interface SilentFailureBoss {
  kind: "silent-failure";
  hp: number;
  maxHp: number;
  /** Debug's mark — permanent for this fight once set (verbatim intent);
   * unlike Cascade's mark, nothing in this module ever clears it. */
  marked: boolean;
  phase: "embodied" | "vanished";
  phaseTurnsLeft: number;
  /** One CT extension per embodied window, max 3 turns total (D4). */
  extendedThisWindow: boolean;
  /** Set by engine.ts's DoT-tick call site (task 4) when a tick kills it
   * while vanished — the scene forces the body frame family for SIL_DIE so
   * the death beat never plays over an empty-armor frame (signed DoT-kill
   * ruling). Never touched by this module's own functions. */
  forceBodyForDeath: boolean;
}

export const MAX_HP = 140;
const EMBODIED_SWING = 12;
const VANISHED_AMBUSH = 18;
const EMBODIED_WINDOW = 2;
const VANISHED_WINDOW = 2;

/** Target id 0 is the boss itself (the engine's batId/targetId channel and
 * the DoT anchor both key off it) — the single-entity degenerate case of
 * Alert Storm's bats[]/Cascade's nodes[]. */
export const SF_TARGET_ID = 0;

export function spawnSilentFailure(): SilentFailureBoss {
  return {
    kind: "silent-failure",
    hp: MAX_HP,
    maxHp: MAX_HP,
    marked: false,
    phase: "embodied",
    phaseTurnsLeft: EMBODIED_WINDOW,
    extendedThisWindow: false,
    forceBodyForDeath: false,
  };
}

/** `[0]` while alive, `[]` once dead. */
export function livingTargets(boss: SilentFailureBoss): number[] {
  return boss.hp > 0 ? [SF_TARGET_ID] : [];
}

/** D2: untargetable while vanished — targeted abilities (pt/debug/fo) are
 * invalid; `attack` is exempted from this check at the engine.ts call site
 * and resolves as a whiff instead. The armor itself stays SELECTABLE for the
 * whole fight (the cursor never loses its home); this function only answers
 * whether an action against it is legal right now. */
export function isTargetable(boss: SilentFailureBoss): boolean {
  return boss.phase === "embodied";
}

/** Unconditional hp reduction, clamped at 0. A no-op against an already-dead
 * boss (same contract as Cascade's damageNode against a dead node). Callers
 * decide the amount (e.g. 0 for D2's vanished-attack whiff) — this function
 * has no phase-awareness of its own. */
export function damageSilentFailure(boss: SilentFailureBoss, amount: number): SilentFailureBoss {
  if (boss.hp <= 0) return boss;
  return { ...boss, hp: Math.max(0, boss.hp - amount) };
}

/** Debug's mark — permanent for this fight. */
export function markSilentFailure(boss: SilentFailureBoss): SilentFailureBoss {
  return { ...boss, marked: true };
}

export type SilentFailureTurnOutcome = "swing" | "ambush";

export interface SilentFailureTurnResult {
  boss: SilentFailureBoss;
  outcome: SilentFailureTurnOutcome;
  /** Damage the HERO takes this boss turn. Already CT/Conviction-adjusted via
   * `takenDamage` — apply as-is. */
  heroDamage: number;
}

/** Resolves one boss turn (D4's pinned cycle resolution). Deals the phase's
 * damage (embodied 12 = swing, vanished 18 = ambush, both via `takenDamage`),
 * THEN decrements `phaseTurnsLeft`. When it reaches 0:
 *
 * - embodied AND `ct` is active (read here, in the boss phase, BEFORE the
 *   engine's end-of-turn `ctTurns` decrement) AND not yet extended this
 *   window -> extend: `phaseTurnsLeft = 1`, `extendedThisWindow = true`
 *   (window becomes 3 turns total, capped — CT cast on the LAST vanish turn
 *   covers both base embodied turns and lands the extension; CT cast on the
 *   FIRST vanish turn has already expired by the time this check runs on the
 *   second embodied turn, so it extends nothing — it just buffed the two
 *   swings it was still up for).
 * - otherwise -> flip phase, `phaseTurnsLeft = 2`, `extendedThisWindow =
 *   false`. Vanished windows are always exactly 2 and never extend,
 *   regardless of `ct`. */
export function resolveSilentFailureBossTurn(
  boss: SilentFailureBoss,
  ct: boolean,
  conviction: boolean,
): SilentFailureTurnResult {
  const outcome: SilentFailureTurnOutcome = boss.phase === "embodied" ? "swing" : "ambush";
  const base = boss.phase === "embodied" ? EMBODIED_SWING : VANISHED_AMBUSH;
  const heroDamage = takenDamage(base, ct, conviction);

  const phaseTurnsLeft = boss.phaseTurnsLeft - 1;
  if (phaseTurnsLeft > 0) {
    return { boss: { ...boss, phaseTurnsLeft }, outcome, heroDamage };
  }

  if (boss.phase === "embodied" && ct && !boss.extendedThisWindow) {
    return {
      boss: { ...boss, phaseTurnsLeft: 1, extendedThisWindow: true },
      outcome,
      heroDamage,
    };
  }

  const phase = boss.phase === "embodied" ? "vanished" : "embodied";
  const nextWindow = phase === "embodied" ? EMBODIED_WINDOW : VANISHED_WINDOW;
  return {
    boss: { ...boss, phase, phaseTurnsLeft: nextWindow, extendedThisWindow: false },
    outcome,
    heroDamage,
  };
}

/** Victory: hp at or below 0. */
export function isSilentFailureDefeated(boss: SilentFailureBoss): boolean {
  return boss.hp <= 0;
}
