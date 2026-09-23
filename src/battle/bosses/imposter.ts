// Imposter Syndrome: phase and mirror mechanics, pure.
//
// Boss-to-hero damage uses the local `composedTaken`: the mirror-CT multiplier
// must compose with the CT/Conviction taken multiplier before a single
// rounding, which engine.ts's two-argument `takenDamage` cannot do.
//
// Clone slots are a targeting/rendering overlay only: damage, mark and DoTs
// all resolve to the one boss entity (no per-clone HP). `resolveImposterHit`
// gates direct hits; `damageImposter` is phase-agnostic, so a DoT keeps
// ticking into and out of CLONES.
import type { AbilityId } from "../engine";
import { takenMultiplier } from "../engine";

export { IMPOSTER_ID } from "../rushOrder";

export type ImposterPhase = "clones" | "pulse" | "vanish" | "mirror";

export interface ImposterBoss {
  kind: "imposter-syndrome";
  hp: number;
  maxHp: number;
  phase: ImposterPhase;
  phaseTurnsLeft: number;
  /** Set at the boundary after the forge fires, never mid-phase. */
  degenerate: boolean;
  /** The <=50% crossing. Fires once, on the crossing hit, independently of
   * `degenerate`. */
  forgeFired: boolean;
  /** Which of the 3 clone ids is real. Seeded once at spawn, never reseeds.
   * Nothing here produces null; the type allows it for defensive callers. */
  realIndex: number | null;
  /** Debug's mark. Persists until a pulse-break consumes it. */
  marked: boolean;
  /** Armed after PULSE's charge turn; breakPulse clears it to fizzle the fire. */
  pulseCharged: boolean;
  /** The hero's last-cast special (never "attack"). `null` until one is cast. */
  lastSpecial: AbilityId | null;
  /** Mirrored-CT buff: refresh, not stack. Decremented on every boss turn
   * except the one that granted it. */
  mirrorCtTurns: number;
}

export const MAX_HP = 180;

/** Rotation numbers above the 50% HP crossing. */
const SLASH = 14;
const AMBUSH = 16;
const PULSE_FIRE = 26;
const CLONES_TURNS = 2;
const CLONES_TURNS_DEGENERATE = 1;
const PULSE_TURNS = 2;
const VANISH_TURNS = 2;
const MIRROR_TURNS = 1;

const MIRROR_CT_TURNS = 2;
const MIRROR_CT_DEALT_MULT = 1.25;

/** A mirrored special deals half the hero ability's base (all exact halves).
 * Hardcoded: engine.ts does not export the hero-side bases. */
const MIRROR_PT = 14;
const MIRROR_FO = 4;
const MIRROR_DEBUG = 3;
export const MIRROR_DEBUG_DOT_TICK = 2;
export const MIRROR_DEBUG_DOT_TICKS = 3;
const MIRROR_RB_HEAL = 15;
/** 22/2. Without an explicit `rc` arm a mirrored Root Cause would fall
 * through to the 14 slash. */
const MIRROR_RC = 11;

/** Copy of engine.ts's private round-half-up, for the single rounding in
 * `composedTaken`. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** `round(base × mirrorMult × takenMultiplier(ct, conviction))`, rounded once.
 * `mirrorMult` is 1 outside the mirrorCtTurns window and for the MIRROR
 * phase's own damage. */
function composedTaken(base: number, mirrorMult: number, ct: boolean, conviction: boolean): number {
  return roundHalfUp(base * mirrorMult * takenMultiplier(ct, conviction));
}

/** Opens in CLONES, so there is no free direct-target opener. `realIndex`
 * never reseeds: the boss leaves CLONES and returns with the same slot
 * real, so a mark set earlier still reveals it. */
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

/** 0/1/2 during clones, else `[0]`; `[]` once dead. */
export function livingTargets(boss: ImposterBoss): number[] {
  if (boss.hp <= 0) return [];
  return boss.phase === "clones" ? [0, 1, 2] : [0];
}

/** Phase-agnostic hp reduction, clamped at 0. Detects the <=50% forge
 * crossing on the hit that crosses it, whatever the source. No-op against a
 * dead boss. */
export function damageImposter(boss: ImposterBoss, amount: number): ImposterBoss {
  if (boss.hp <= 0) return boss;
  const hp = Math.max(0, boss.hp - amount);
  const forgeFired = boss.forgeFired || (boss.hp * 2 > boss.maxHp && hp * 2 <= boss.maxHp);
  return { ...boss, hp, forgeFired };
}

/** Heal capped at maxHp (mirrored Rollback is the only boss heal). Erosion is
 * derived from hp, so a heal back over a line reverts the station. */
export function healImposter(boss: ImposterBoss, amount: number): ImposterBoss {
  return { ...boss, hp: Math.min(boss.maxHp, boss.hp + amount) };
}

export interface ImposterHitResult {
  boss: ImposterBoss;
  /** Amount actually applied to boss hp (0 on a popped clone). */
  dealt: number;
}

/** The CLONES overlay gate. Outside clones the one target resolves for real;
 * during clones any slot but `realIndex` pops and applies nothing, not even
 * the forge check. */
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

/** Idempotent. Persists until breakPulse consumes it. */
export function markImposter(boss: ImposterBoss): ImposterBoss {
  return { ...boss, marked: true };
}

/** Debug after the PULSE charge and before the fire breaks it: the fire
 * fizzles to the plain slash and the mark is consumed. No-op outside that
 * window. */
export function breakPulse(boss: ImposterBoss): ImposterBoss {
  if (boss.phase !== "pulse" || !boss.pulseCharged) return boss;
  return { ...boss, pulseCharged: false, marked: false };
}

/** Root Cause's rip-back: ends VANISH this hero turn. Uses the normal
 * phase-advance path, so it counts as a completed phase for the degenerate
 * boundary. Only the phase transition; the caller applies damage. No-op
 * outside vanish. */
export function ripBackVanish(boss: ImposterBoss): ImposterBoss {
  if (boss.phase !== "vanish") return boss;
  return advancePhase(boss);
}

/** Records the hero's last-cast special. "attack" is not a special and
 * leaves the tracker untouched. */
export function trackSpecial(boss: ImposterBoss, ability: AbilityId): ImposterBoss {
  if (ability === "attack") return boss;
  return { ...boss, lastSpecial: ability };
}

export function isImposterDefeated(boss: ImposterBoss): boolean {
  return boss.hp <= 0;
}

export type ErosionStage = 0 | 1 | 2 | 3;

/** Integer-exact and gap-free at any maxHp. No stored high-water mark, so
 * healing back across a line reverts the stage. */
export function erosionStage(boss: ImposterBoss): ErosionStage {
  if (boss.hp <= 0) return 3;
  if (boss.hp * 3 > boss.maxHp * 2) return 0;
  if (boss.hp * 3 > boss.maxHp) return 1;
  return 2;
}

/** Integer-exact (no division). Takes generic hp/maxHp because engine.ts
 * applies it to the hero; it lives here as this boss's signature unlock. */
export function convictionCastable(hp: number, maxHp: number): boolean {
  return hp * 4 <= maxHp;
}

function turnsFor(phase: ImposterPhase, degenerate: boolean): number {
  if (phase === "clones") return degenerate ? CLONES_TURNS_DEGENERATE : CLONES_TURNS;
  if (phase === "mirror") return MIRROR_TURNS;
  return phase === "pulse" ? PULSE_TURNS : VANISH_TURNS;
}

/** Full cycle: CLONES -> PULSE -> VANISH -> MIRROR -> CLONES. Once
 * degenerate, PULSE and VANISH drop out: CLONES goes to MIRROR, anything
 * else to CLONES. */
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

/** The one boundary-crossing path, for a countdown reaching 0 and for
 * ripBackVanish. `degenerate` flips at the first boundary after
 * `forgeFired`. `pulseCharged` resets on every phase change. */
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

function tickPhase(boss: ImposterBoss): ImposterBoss {
  const phaseTurnsLeft = boss.phaseTurnsLeft - 1;
  if (phaseTurnsLeft > 0) return { ...boss, phaseTurnsLeft };
  return advancePhase(boss);
}

interface MirrorResolution {
  /** Raw base damage to the hero (0 for ct/rb, which deal no direct damage). */
  base: number;
  /** Debug arm only: the caller applies the hero mark and pushes a hero DoT
   * (hero-side state lives on BattleState). */
  mirroredDebug: boolean;
  /** ct arm only: (re)grants mirrorCtTurns and skips this turn's decrement,
   * so a refresh does not consume itself. */
  refreshMirrorCt: boolean;
  /** rb arm only; healImposter caps it. */
  healAmount: number;
}

/** A diagnostic default instead of assertNever: "attack" and `null` (no
 * special yet) legitimately reach it and resolve to the glitch slash. Every
 * other AbilityId has an explicit arm; `conv` swings because belief cannot
 * be mirrored. */
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
    case "rc":
      return { base: MIRROR_RC, mirroredDebug: false, refreshMirrorCt: false, healAmount: 0 };
    case "conv":
      return { base: SLASH, mirroredDebug: false, refreshMirrorCt: false, healAmount: 0 };
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
   * adjusted, so apply as-is. */
  heroDamage: number;
  /** See MirrorResolution.mirroredDebug. */
  mirroredDebug: boolean;
}

/** One boss turn. The mirror-CT multiplier applies to slash/ambush/pulse,
 * never to the mirror phase's own damage. */
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
    // Spawn is instant at phase entry, not a turn action, so both CLONES
    // boss turns deal the basic glitch slash.
    outcome = "slash";
    heroDamage = composedTaken(SLASH, mirrorMult, ct, conviction);
    next = tickPhase(boss);
  } else if (boss.phase === "pulse") {
    if (boss.phaseTurnsLeft === PULSE_TURNS) {
      // Pulse turn 1: charge/telegraph, no damage.
      outcome = "pulseCharge";
      heroDamage = 0;
      next = { ...boss, pulseCharged: true, phaseTurnsLeft: boss.phaseTurnsLeft - 1 };
    } else if (boss.pulseCharged) {
      // Pulse turn 2, unbroken: fires.
      outcome = "pulseFire";
      heroDamage = composedTaken(PULSE_FIRE, mirrorMult, ct, conviction);
      next = tickPhase(boss);
    } else {
      // Pulse turn 2, broken by breakPulse: fizzles to the plain slash instead.
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
    // Never mirror-CT-boosted; only slash/ambush/pulse are.
    heroDamage = composedTaken(mirrored.base, 1, ct, conviction);
    mirroredDebug = mirrored.mirroredDebug;
    refreshMirrorCt = mirrored.refreshMirrorCt;
    const healed = mirrored.healAmount > 0 ? healImposter(boss, mirrored.healAmount) : boss;
    next = advancePhase(healed);
  }

  const mirrorCtTurns = refreshMirrorCt ? MIRROR_CT_TURNS : Math.max(0, next.mirrorCtTurns - 1);
  return { boss: { ...next, mirrorCtTurns }, outcome, heroDamage, mirroredDebug };
}
