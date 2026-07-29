// Imposter Syndrome — boss 4's recap-phase state and mirror mechanics, behind
// the per-boss interface bosses/silentFailure.ts established (M6 plan PR-3
// task 3, docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md). This
// module is pure mechanics only: initBattle boot wiring, IMPLEMENTED_BOSSES
// growth, AbilityId's `rc`/`conv` additions, KIT_UNLOCKS, and the 11 E1
// engine.ts dispatch sites all live outside this file (task 4/5) — the
// exported functions below are unit-tested directly against synthetic
// ImposterBoss states, not yet reached through battleReduce.
//
// Boss-turn damage (boss -> hero) routes through this module's own
// `composedTaken` (a local copy of engine.ts's round-half-up composed with
// engine.ts's exported `takenMultiplier`, per the N8 mirror-CT dealt
// multiplier that has to compose with the CT/Conviction taken multiplier
// BEFORE a single rounding — a third factor engine.ts's own two-argument
// `takenDamage` doesn't carry, so it can't be reused as-is here).
//
// E8's clone slots are a TARGETING/RENDERING OVERLAY ONLY: all damage, mark,
// and DoT anchoring resolve to this single boss entity (`hp`/`maxHp` are the
// only HP state that exists — there is no per-clone HP). `resolveImposterHit`
// is the overlay gate for direct hits; `damageImposter` is the unconditional,
// phase-agnostic hp-reducer DoT ticks (and `resolveImposterHit`'s real-slot
// case) route through, so a DoT anchored before a CLONES phase keeps ticking
// through it and one anchored during CLONES keeps ticking after it ends —
// the same way Silent Failure's `damageSilentFailure` doesn't care about
// phase either.
import type { AbilityId } from "../engine";
import { takenMultiplier } from "../engine";

/** Canonical definition lives in ../rushOrder (same pattern as
 * silentFailure.ts's SILENT_FAILURE_ID re-export). Landed in rushOrder.ts by
 * THIS task, not task 5. */
export { IMPOSTER_ID } from "../rushOrder";

export type ImposterPhase = "clones" | "pulse" | "vanish" | "mirror";

export interface ImposterBoss {
  kind: "imposter-syndrome";
  hp: number;
  maxHp: number;
  phase: ImposterPhase;
  phaseTurnsLeft: number;
  /** Set at the N5 boundary (never before) — the rotation only degenerates
   * to alternating CLONES(1)/MIRROR(1) once the CURRENT phase completes. */
  degenerate: boolean;
  /** The <=50% crossing event; fires once, immediately on the crossing hit,
   * independently of `degenerate` (N5: the event and the rotation change are
   * two different moments). */
  forgeFired: boolean;
  /** Clones: which of the 3 targetable ids (0/1/2) is the real boss (seeded
   * once at spawn — see spawnImposter's doc comment for why this never
   * reseeds). Populated at spawn and never nulled in this module's own
   * functions; the E8 draft's `| null` is preserved in the type for a future
   * caller's defensive handling, but no function here produces null. */
  realIndex: number | null;
  /** Debug's mark on the boss — persists through everything except a
   * pulse-break (breakPulse consumes it; see the plan's Mark-semantics row). */
  marked: boolean;
  /** N4: true once the PULSE phase's turn-1 charge/telegraph has resolved
   * (armed to fire next boss turn); breakPulse flips it back to false to
   * signal the fizzle instead of the fire. */
  pulseCharged: boolean;
  /** MIRROR's tracker: the hero's last-cast SPECIAL (never "attack" — see
   * trackSpecial). `null` before any special has been cast this fight. */
  lastSpecial: AbilityId | null;
  /** N8: the boss's own mirrored-CT buff, refresh-not-stack, decremented on
   * every boss turn except the one that (re)granted it. */
  mirrorCtTurns: number;
}

export const MAX_HP = 180;

/** Rotation-script numbers (Boss 4 table, above 50%). */
const SLASH = 14;
const AMBUSH = 16;
const PULSE_FIRE = 26;
const CLONES_TURNS = 2;
const CLONES_TURNS_DEGENERATE = 1;
const PULSE_TURNS = 2;
const VANISH_TURNS = 2;
const MIRROR_TURNS = 1;

/** N8: the boss's own mirrored-CT buff. */
const MIRROR_CT_TURNS = 2;
const MIRROR_CT_DEALT_MULT = 1.25;

/** MIRROR row: "half the CURRENT signed base, round half up" — each of these
 * happens to be an exact half already (28/2, 8/2, 6/2, 30/2, 22/2), so no
 * rounding edge case exists among them. Hardcoded here (not imported from
 * engine.ts, which doesn't export the hero-side base constants) same as
 * every other boss module hardcodes its own signed numbers. */
const MIRROR_PT = 14;
const MIRROR_FO = 4;
const MIRROR_DEBUG = 3;
export const MIRROR_DEBUG_DOT_TICK = 2;
export const MIRROR_DEBUG_DOT_TICKS = 3;
const MIRROR_RB_HEAL = 15;
/** Root Cause (rc) and Conviction (conv) don't exist in AbilityId yet — task
 * 4 adds `MIRROR_RC = 11` and the Conviction arm (-> glitch slash) to
 * `resolveMirror`'s switch when it grows AbilityId. */

/** Local copy of engine.ts's private round-half-up (not exported there).
 * Needed here because N8's mirror-CT dealt multiplier must compose with the
 * CT/Conviction taken multiplier BEFORE a single rounding (the pinned
 * "roundHalfUp applied once, after everything" rule) — a three-factor
 * composition engine.ts's own two-argument `takenDamage` doesn't offer. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** `round(base × mirrorMult × takenMultiplier(ct, conviction))`, rounded once
 * at the end (N7/N8). `mirrorMult` is 1 outside the mirrorCtTurns window and
 * for the MIRROR phase's own damage (the pin lists only slash/ambush/pulse
 * as boosted, never the mirror-cast turn itself). */
function composedTaken(base: number, mirrorMult: number, ct: boolean, conviction: boolean): number {
  return roundHalfUp(base * mirrorMult * takenMultiplier(ct, conviction));
}

/** Spawn opens the battle already IN clones (N2) — no free direct-target
 * opener. `realIndex` is seeded once here (one rng draw, mirroring
 * alertStorm.ts's spawnAlertStorm) and never reseeds for the rest of the
 * fight: the fastest-line derivation has the boss leave CLONES (into MIRROR)
 * and return to CLONES later, with the SAME slot still being real — a mark
 * set before the excursion still "reveals the real one" after it, which only
 * holds if the real identity never changes mid-fight. */
export function spawnImposter(
  rng: number,
  draw: (r: number) => number,
): { boss: ImposterBoss; rng: number } {
  const advanced = draw(rng);
  const realIndex = advanced % 3;
  const boss: ImposterBoss = {
    kind: "imposter-syndrome",
    hp: MAX_HP,
    maxHp: MAX_HP,
    phase: "clones",
    phaseTurnsLeft: CLONES_TURNS,
    degenerate: false,
    forgeFired: false,
    realIndex,
    marked: false,
    pulseCharged: false,
    lastSpecial: null,
    mirrorCtTurns: 0,
  };
  return { boss, rng: advanced };
}

/** Targetable ids: 0/1/2 during clones (all three positions), else just the
 * single entity's `[0]`; `[]` once dead. */
export function livingTargets(boss: ImposterBoss): number[] {
  if (boss.hp <= 0) return [];
  return boss.phase === "clones" ? [0, 1, 2] : [0];
}

/** Unconditional hp reduction, clamped at 0 — phase-agnostic (E8: DoT
 * anchoring resolves to the single boss entity, never a clone slot, so a
 * tick keeps applying whichever phase is current). Also where the <=50%
 * forge crossing is detected (N5: fires IMMEDIATELY on the crossing hit,
 * exactly once, regardless of the source of the hp drop). A no-op against an
 * already-dead boss, same contract as every other boss module's damage fn. */
export function damageImposter(boss: ImposterBoss, amount: number): ImposterBoss {
  if (boss.hp <= 0) return boss;
  const hp = Math.max(0, boss.hp - amount);
  const forgeFired = boss.forgeFired || (boss.hp * 2 > boss.maxHp && hp * 2 <= boss.maxHp);
  return { ...boss, hp, forgeFired };
}

/** Heal, capped at maxHp (N13: the boss's own heal — mirrored Rollback is the
 * only source in the game). Erosion is derived live from hp at every read
 * (erosionStage below) so a heal crossing back over a stage line visibly
 * reverts the station — signed as correct, not a bug. */
export function healImposter(boss: ImposterBoss, amount: number): ImposterBoss {
  return { ...boss, hp: Math.min(boss.maxHp, boss.hp + amount) };
}

export interface ImposterHitResult {
  boss: ImposterBoss;
  /** Amount actually applied to boss hp (0 on a popped clone). */
  dealt: number;
}

/** The CLONES overlay gate (E8): outside clones there is only one target and
 * it always resolves for real; during clones, hitting anything but
 * `realIndex` pops the clone and applies NOTHING (no damage, no forge check,
 * no side effect at all — the spent turn/MP is the whole cost, per the
 * signed table). */
export function resolveImposterHit(
  boss: ImposterBoss,
  targetId: number,
  amount: number,
): ImposterHitResult {
  const isReal = boss.phase !== "clones" || targetId === boss.realIndex;
  if (!isReal) return { boss, dealt: 0 };
  const before = boss.hp;
  const next = damageImposter(boss, amount);
  return { boss: next, dealt: before - next.hp };
}

/** Debug's mark on the boss — persists through everything except a
 * pulse-break (see breakPulse). Idempotent, same as Silent Failure's own
 * re-mark. */
export function markImposter(boss: ImposterBoss): ImposterBoss {
  return { ...boss, marked: true };
}

/** N4: casting Debug on the boss any time after the PULSE charge completes
 * and before it fires breaks the discharge — the remaining pulse turn
 * fizzles to the plain slash instead of firing, and the mark is consumed
 * (mark-semantics row: breaking the pulse is what costs the clone tracker).
 * A no-op outside that exact window (not pulse-phase, or not yet charged). */
export function breakPulse(boss: ImposterBoss): ImposterBoss {
  if (boss.phase !== "pulse" || !boss.pulseCharged) return boss;
  return { ...boss, pulseCharged: false, marked: false };
}

/** Root Cause's rip-back: forces VANISH to end THIS hero turn instead of
 * waiting out its boss-turn countdown (N5: an early end still counts as a
 * completed phase for the degenerate-boundary check — it uses the exact same
 * phase-advance path a natural countdown-to-zero would). Damage application
 * is the caller's concern (task 4; RC's own hit amount is an engine.ts/kit
 * concern) — this function only resolves the phase transition. A no-op
 * outside the vanish phase. */
export function ripBackVanish(boss: ImposterBoss): ImposterBoss {
  if (boss.phase !== "vanish") return boss;
  return advancePhase(boss);
}

/** MIRROR's tracker: records the hero's last-cast SPECIAL. "attack" never
 * updates it (attack is not a special) — a no-op in that case, leaving
 * whatever special was tracked before untouched. */
export function trackSpecial(boss: ImposterBoss, ability: AbilityId): ImposterBoss {
  if (ability === "attack") return boss;
  return { ...boss, lastSpecial: ability };
}

export function isImposterDefeated(boss: ImposterBoss): boolean {
  return boss.hp <= 0;
}

export type ErosionStage = 0 | 1 | 2 | 3;

/** N9/erosion-stages row: integer-exact, gap-free at any maxHp (180 in
 * practice). N13 SIGNED LIVE/REVERSIBLE: derived fresh from hp on every call
 * — there is deliberately no stored high-water field, so healing the boss
 * back across a line reverts the stage. */
export function erosionStage(boss: ImposterBoss): ErosionStage {
  if (boss.hp <= 0) return 3;
  if (boss.hp * 3 > boss.maxHp * 2) return 0;
  if (boss.hp * 3 > boss.maxHp) return 1;
  return 2;
}

/** Conviction's activation gate (Boss 4 table row): integer-exact, no
 * floating-point division. Operates on generic hp/maxHp so engine.ts (task
 * 4) can call it against the HERO's stats (`hero.hp`, `hero.maxHp`) — the
 * gate itself has nothing to do with boss state, it just lives here because
 * Conviction is this boss's signature unlock. */
export function convictionCastable(hp: number, maxHp: number): boolean {
  return hp * 4 <= maxHp;
}

function turnsFor(phase: ImposterPhase, degenerate: boolean): number {
  if (phase === "clones") return degenerate ? CLONES_TURNS_DEGENERATE : CLONES_TURNS;
  if (phase === "mirror") return MIRROR_TURNS;
  return phase === "pulse" ? PULSE_TURNS : VANISH_TURNS;
}

/** N5's rotation table: normal full cycle CLONES -> PULSE -> VANISH -> MIRROR
 * -> CLONES; once degenerate, PULSE/VANISH drop out of the cycle entirely —
 * leaving anything other than CLONES resets to CLONES, leaving CLONES goes
 * to MIRROR (derived from the fastest-line hand-run: a VANISH ripped back
 * while degenerating lands on CLONES(1) next, not MIRROR). */
function nextPhase(current: ImposterPhase, degenerate: boolean): ImposterPhase {
  if (degenerate) {
    if (current === "clones") return "mirror";
    return "clones";
  }
  if (current === "clones") return "pulse";
  if (current === "pulse") return "vanish";
  if (current === "vanish") return "mirror";
  return "clones"; // current === "mirror"
}

/** The single phase-boundary-crossing path — used both by a phase's own
 * countdown reaching 0 and by ripBackVanish's forced early end (N5: both
 * count as "the phase completed"). Degenerate flips here (never mid-phase)
 * the first time a boundary is crossed after `forgeFired`; every boundary
 * after that reads as already degenerate. `pulseCharged` always resets on
 * any phase change (dead outside pulse anyway). */
function advancePhase(boss: ImposterBoss): ImposterBoss {
  const degenerate = boss.degenerate || boss.forgeFired;
  const phase = nextPhase(boss.phase, degenerate);
  return {
    ...boss,
    phase,
    phaseTurnsLeft: turnsFor(phase, degenerate),
    degenerate,
    pulseCharged: false,
  };
}

/** A phase's normal countdown: decrement, and cross the boundary via
 * advancePhase once it hits 0. */
function tickPhase(boss: ImposterBoss): ImposterBoss {
  const phaseTurnsLeft = boss.phaseTurnsLeft - 1;
  if (phaseTurnsLeft > 0) return { ...boss, phaseTurnsLeft };
  return advancePhase(boss);
}

interface MirrorResolution {
  /** Raw base damage to the hero this turn (0 for the ct/rb arms, which have
   * no direct-damage component). */
  base: number;
  /** True only for the Debug arm — signals the caller (task 4; hero-side
   * mark/DoT state lives on BattleState per E6/E8, not here) to also apply
   * the hero mark and push a hero DoT (MIRROR_DEBUG_DOT_TICK per tick,
   * MIRROR_DEBUG_DOT_TICKS ticks). */
  mirroredDebug: boolean;
  /** True only for the ct arm — (re)grants the mirrorCtTurns buff this turn,
   * which also means this turn's decrement is skipped (a refresh must not
   * immediately consume itself down to 1 remaining turn of boost). */
  refreshMirrorCt: boolean;
  /** Boss self-heal amount (rb arm only), capped at maxHp by healImposter. */
  healAmount: number;
}

/** MIRROR row: exhaustive over AbilityId's CURRENT variants (attack/ct/pt/
 * debug/fo/rb) with a diagnostic default — never a thrown assertNever, since
 * "attack" (excluded by trackSpecial) and `null` (no special cast yet) both
 * legitimately reach here and both resolve to the plain glitch slash, same
 * as the table's "no special used yet -> glitch slash" row. Task 4 adds `rc`
 * (-> 11) and `conv` (-> glitch slash, "the imposter cannot mirror belief")
 * arms once AbilityId grows to include them — this switch is deliberately
 * left open to that extension, not closed with assertNever. */
function resolveMirror(boss: ImposterBoss): MirrorResolution {
  switch (boss.lastSpecial) {
    case "ct":
      return { base: 0, mirroredDebug: false, refreshMirrorCt: true, healAmount: 0 };
    case "pt":
      return { base: MIRROR_PT, mirroredDebug: false, refreshMirrorCt: false, healAmount: 0 };
    case "fo":
      return { base: MIRROR_FO, mirroredDebug: false, refreshMirrorCt: false, healAmount: 0 };
    case "debug":
      return { base: MIRROR_DEBUG, mirroredDebug: true, refreshMirrorCt: false, healAmount: 0 };
    case "rb":
      return { base: 0, mirroredDebug: false, refreshMirrorCt: false, healAmount: MIRROR_RB_HEAL };
    default:
      return { base: SLASH, mirroredDebug: false, refreshMirrorCt: false, healAmount: 0 };
  }
}

export type ImposterOutcome =
  | "slash"
  | "ambush"
  | "pulseCharge"
  | "pulseFire"
  | "pulseFizzle"
  | "mirror";

export interface ImposterTurnResult {
  boss: ImposterBoss;
  outcome: ImposterOutcome;
  /** Damage the HERO takes this boss turn. Already CT/Conviction/mirror-CT
   * adjusted — apply as-is. */
  heroDamage: number;
  /** True only on a "mirror" outcome that mirrored Debug — see
   * MirrorResolution.mirroredDebug. */
  mirroredDebug: boolean;
}

/** Resolves one boss turn: dispatches on phase (N3/N4/N5's rotation script),
 * applies the N8 mirror-CT dealt multiplier to slash/ambush/pulse (never to
 * the mirror phase's own damage), and bookkeeps mirrorCtTurns (refresh, not
 * stack; decrements on every boss turn except the one that just granted it). */
export function resolveImposterBossTurn(
  boss: ImposterBoss,
  ct: boolean,
  conviction: boolean,
): ImposterTurnResult {
  const mirrorMult = boss.mirrorCtTurns > 0 ? MIRROR_CT_DEALT_MULT : 1;

  let next: ImposterBoss;
  let outcome: ImposterOutcome;
  let heroDamage: number;
  let mirroredDebug = false;
  let refreshMirrorCt = false;

  if (boss.phase === "clones") {
    // N3: spawn is instant at phase entry, not a turn action — both CLONES
    // boss turns deal the basic glitch slash.
    outcome = "slash";
    heroDamage = composedTaken(SLASH, mirrorMult, ct, conviction);
    next = tickPhase(boss);
  } else if (boss.phase === "pulse") {
    if (boss.phaseTurnsLeft === PULSE_TURNS) {
      // N4 turn 1: charge/telegraph, no damage.
      outcome = "pulseCharge";
      heroDamage = 0;
      next = { ...boss, pulseCharged: true, phaseTurnsLeft: boss.phaseTurnsLeft - 1 };
    } else if (boss.pulseCharged) {
      // N4 turn 2, unbroken: fires.
      outcome = "pulseFire";
      heroDamage = composedTaken(PULSE_FIRE, mirrorMult, ct, conviction);
      next = tickPhase(boss);
    } else {
      // N4 turn 2, broken by breakPulse: fizzles to the plain slash instead.
      outcome = "pulseFizzle";
      heroDamage = composedTaken(SLASH, mirrorMult, ct, conviction);
      next = tickPhase(boss);
    }
  } else if (boss.phase === "vanish") {
    outcome = "ambush";
    heroDamage = composedTaken(AMBUSH, mirrorMult, ct, conviction);
    next = tickPhase(boss);
  } else {
    const mirrored = resolveMirror(boss);
    outcome = "mirror";
    // Never mirror-CT-boosted (the pin lists only slash/ambush/pulse).
    heroDamage = composedTaken(mirrored.base, 1, ct, conviction);
    mirroredDebug = mirrored.mirroredDebug;
    refreshMirrorCt = mirrored.refreshMirrorCt;
    const healed = mirrored.healAmount > 0 ? healImposter(boss, mirrored.healAmount) : boss;
    next = advancePhase(healed);
  }

  const mirrorCtTurns = refreshMirrorCt ? MIRROR_CT_TURNS : Math.max(0, next.mirrorCtTurns - 1);
  return { boss: { ...next, mirrorCtTurns }, outcome, heroDamage, mirroredDebug };
}
