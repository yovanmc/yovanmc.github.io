// The Silent Failure: single-entity vanish-cycle mechanics, pure.
//
// Swing/ambush damage to the hero goes through engine.ts's `takenDamage`.
// The targetability gate, the whiff rule (attack while vanished deals 0, no
// MP) and `forceBodyForDeath` are engine.ts call-site concerns:
// `damageSilentFailure` is a plain hp reduction.
import { takenDamage } from "../engine";

/** Defined in ../rushOrder so bootParams.ts can import it without pulling the
 * engine.ts<->silentFailure.ts cycle into the landing bundle. */
export { SILENT_FAILURE_ID } from "../rushOrder";

export interface SilentFailureBoss {
  kind: "silent-failure";
  hp: number;
  maxHp: number;
  /** Debug's mark, permanent for the fight (unlike Cascade's). */
  marked: boolean;
  phase: "embodied" | "vanished";
  phaseTurnsLeft: number;
  /** One CT extension per embodied window, max 3 turns total. */
  extendedThisWindow: boolean;
  /** Set by engine.ts when a DoT tick kills the boss while vanished, so the
   * death reel plays over the body, not empty armor. */
  forceBodyForDeath: boolean;
}

export const MAX_HP = 140;
const EMBODIED_SWING = 12;
const VANISHED_AMBUSH = 18;
const EMBODIED_WINDOW = 2;
const VANISHED_WINDOW = 2;

/** The boss itself: the target id and DoT anchor for this single entity. */
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

/** Targeted abilities are invalid while vanished; engine.ts exempts `attack`,
 * which whiffs. The armor stays selectable the whole fight; this only answers
 * whether an action is legal now. */
export function isTargetable(boss: SilentFailureBoss): boolean {
  return boss.phase === "embodied";
}

/** Unconditional hp reduction, clamped at 0; no-op on a dead boss. Callers
 * pick the amount (0 for the whiff). */
export function damageSilentFailure(boss: SilentFailureBoss, amount: number): SilentFailureBoss {
  if (boss.hp <= 0) return boss;
  return { ...boss, hp: Math.max(0, boss.hp - amount) };
}

export function markSilentFailure(boss: SilentFailureBoss): SilentFailureBoss {
  return { ...boss, marked: true };
}

export type SilentFailureTurnOutcome = "swing" | "ambush";

export interface SilentFailureTurnResult {
  boss: SilentFailureBoss;
  outcome: SilentFailureTurnOutcome;
  /** Damage the hero takes this boss turn, already CT/Conviction-adjusted. */
  heroDamage: number;
}

/** Deals the phase's damage (embodied swing 12, vanished ambush 18), then
 * decrements `phaseTurnsLeft`. At 0:
 *
 * - embodied, CT active (read before the engine's end-of-turn CT decrement)
 *   and not yet extended this window: extend by 1 turn (3 max). CT cast on
 *   the last vanish turn lands the extension; CT cast on the first has
 *   expired by the check.
 * - otherwise: flip phase with 2 turns. Vanished windows never extend. */
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
