// Pure, deterministic, turn-discrete battle reducer. No DOM, no Date, no
// Math.random: all randomness flows from state.rngState. Per-boss mechanics
// live in bosses/<boss>.ts.

import type { AlertStormBoss, Bat } from "./bosses/alertStorm";
import {
  ALERT_STORM_ID,
  damageBat,
  fanOutHit,
  isBossDefeated,
  isScreamTurn,
  rawVolley,
  reshuffle,
  spawnAlertStorm,
} from "./bosses/alertStorm";
import type { CascadeBoss } from "./bosses/cascade";
import {
  CASCADE_ID,
  damageNode,
  fallForwardIfCarrierDied,
  fanOutNodes,
  isCascadeDefeated,
  markNode,
  resolveCascadeBossTurn,
  spawnCascade,
} from "./bosses/cascade";
import type { SilentFailureBoss } from "./bosses/silentFailure";
import {
  damageSilentFailure,
  isSilentFailureDefeated,
  isTargetable,
  markSilentFailure,
  resolveSilentFailureBossTurn,
  SF_TARGET_ID,
  SILENT_FAILURE_ID,
  spawnSilentFailure,
} from "./bosses/silentFailure";
import type { ImposterBoss } from "./bosses/imposter";
import {
  breakPulse,
  convictionCastable,
  damageImposter,
  IMPOSTER_ID,
  isImposterDefeated,
  livingTargets as imposterLivingTargets,
  markImposter,
  MIRROR_DEBUG_DOT_TICK,
  MIRROR_DEBUG_DOT_TICKS,
  resolveImposterBossTurn,
  resolveImposterHit,
  ripBackVanish,
  spawnImposter,
  trackSpecial,
} from "./bosses/imposter";
import { IMPLEMENTED_BOSSES, RUSH_ORDER } from "./rushOrder";
export type { Bat };
export { isScreamTurn };
// Defined in ./rushOrder so bootParams.ts can import them without pulling
// the engine<->alertStorm cycle into the landing bundle.
export { IMPLEMENTED_BOSSES, RUSH_ORDER };

/** Discriminated on `.kind`. */
export type BossState = AlertStormBoss | CascadeBoss | SilentFailureBoss | ImposterBoss;

/** Exhaustive-dispatch guard for every per-boss branch here and in
 * BattleScene.tsx: a boss kind added to the union without its branch fails
 * to compile instead of mis-routing. */
export function assertNever(x: never): never {
  throw new Error(`unhandled boss kind: ${JSON.stringify(x)}`);
}

export interface Hero {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export type BattleStatus = "active" | "victory" | "defeat";

export type BattleEvent =
  // `wasPop` (Imposter only): a CLONES-phase hit on a non-real slot, which
  // does nothing else. Derived from boss state at the call site, never from
  // `amount === 0`.
  | { type: "damage"; batId: number; amount: number; wasPop?: boolean }
  | { type: "heroDamage"; amount: number }
  | { type: "dot"; batId: number; amount: number }
  | { type: "mark"; batId: number }
  | { type: "reshuffle"; reason: "fakeHit" | "screamEnd" }
  | { type: "batDown"; batId: number }
  | { type: "victory" }
  | { type: "defeat" }
  | { type: "forge"; ability: "fan-out" | "rollback" | "root-cause" | "conviction" }
  | { type: "rider"; maxHp: number; maxMp: number }
  | { type: "unlock"; id: string }
  | { type: "firstCast"; ability: AbilityId }
  | { type: "invalid"; reason: string };

export type AbilityId = "attack" | "ct" | "pt" | "debug" | "fo" | "rb" | "rc" | "conv";

export type BattleAction =
  | { type: "attack"; target: number }
  | { type: "ct" }
  | { type: "pt"; target: number }
  | { type: "debug"; target: number }
  | { type: "fo" }
  | { type: "rb" }
  | { type: "rc"; target: number }
  | { type: "conv" };

export interface BattleState {
  seed: number;
  attempt: number;
  /** Hero turn counter, 1-based. Turn order is hero → boss. */
  turn: number;
  hero: Hero;
  boss: BossState;
  /** Critical Thinking turns remaining (0 = inactive). */
  ctTurns: number;
  /** Set by `conv`; nothing in a fight clears it. */
  conviction: boolean;
  /** Debug DoTs: batId → ticks remaining. `tick` is stamped at cast (4, or 8
   * under conviction), so a DoT started before Conviction keeps ticking 4. */
  dots: { batId: number; ticksLeft: number; tick: number }[];
  /** Mark left by the Imposter's mirrored Debug: a DoT anchor, cosmetic only. */
  heroMarked: boolean;
  /** DoTs on the hero (mirrored Debug is the only source). Fixed
   * `MIRROR_DEBUG_DOT_TICK`, so no per-DoT `tick` is stored. */
  heroDots: { ticksLeft: number }[];
  status: BattleStatus;
  /** Events emitted by the last reduce (renderer input). Cleared each action. */
  events: BattleEvent[];
  /** Park–Miller stream state; every random draw advances it. */
  rngState: number;
  /** Abilities cast at least once this run (first-cast unlock channel). */
  cast: AbilityId[];
  defeatedBosses: string[];
}

export interface InitOptions {
  seed: number;
  attempt?: number;
  defeatedBosses?: string[];
  /** `boss=` capture key / FIGHT selection. An unimplemented or garbage id
   * falls back to `alert-storm` instead of throwing. */
  boss?: string;
}

const MOD = 2147483647; // Park–Miller modulus, same family as src/lib/rng.ts

/** Advances the Park–Miller stream; the new state is also the draw. */
export function nextRng(state: number): number {
  return (state * 16807) % MOD;
}

/** Fold seed+attempt into a valid non-zero stream state. */
function seedStream(seed: number, attempt: number): number {
  let s = (Math.abs(seed) + attempt * 0x9e3779b9) % MOD;
  if (s === 0) s = 1; // Park–Miller streams must be non-zero
  // burn a few draws so tiny seeds decorrelate
  s = nextRng(s);
  s = nextRng(s);
  return s;
}

export function initBattle(opts: InitOptions): BattleState {
  const attempt = opts.attempt ?? 1;
  const seeded = seedStream(opts.seed, attempt);
  const requestedBoss =
    opts.boss && IMPLEMENTED_BOSSES.includes(opts.boss) ? opts.boss : ALERT_STORM_ID;
  let boss: BossState;
  let rng: number;
  if (requestedBoss === CASCADE_ID) {
    boss = spawnCascade(); // no rng draw — the pulse always starts on node 0
    rng = seeded;
  } else if (requestedBoss === SILENT_FAILURE_ID) {
    boss = spawnSilentFailure(); // no rng draw — the boss starts embodied, deterministic
    rng = seeded;
  } else if (requestedBoss === IMPOSTER_ID) {
    // Opens in CLONES with realIndex seeded (one rng draw).
    ({ boss, rng } = spawnImposter(seeded, nextRng));
  } else {
    // Fallback for any unknown id. Dispatch is on a `string`, so it can never
    // narrow to `never`; engine.test.ts's "not-a-real-boss" case asserts it.
    // Add new bosses as `else if` arms ahead of it.
    ({ boss, rng } = spawnAlertStorm(seeded, nextRng));
  }
  const defeatedBosses = opts.defeatedBosses ?? [];
  // Derived from defeatedBosses every init, so a rematch starts at the hero's
  // current post-rider stats. Battles always start full.
  const maxHp = 100 + RIDER_HP * defeatedBosses.length;
  const maxMp = 10 + RIDER_MP * defeatedBosses.length;
  return {
    seed: opts.seed,
    attempt,
    turn: 1,
    hero: { hp: maxHp, maxHp, mp: maxMp, maxMp },
    boss,
    ctTurns: 0,
    conviction: false,
    dots: [],
    heroMarked: false,
    heroDots: [],
    status: "active",
    events: [],
    rngState: rng,
    cast: [],
    defeatedBosses,
  };
}

/** Damage, cost and duration constants. */
const ATTACK_DMG = 12;
const PT_DMG = 28;
const DEBUG_DMG = 6;
export const FAN_OUT_DMG = 8; // shared by every boss's Fan Out
const DOT_TICK = 4;
const DOT_TICKS = 3;
const CT_DURATION = 3;
const ROLLBACK_HEAL = 30;
// Root Cause: +50% vs a marked target on every boss kind. Its
// vanish-ignoring rip-back is Imposter-specific.
const ROOT_CAUSE_DMG = 22;
const ROOT_CAUSE_MARKED_DMG = 33;
const MP_COST: Record<AbilityId, number> = {
  attack: 0,
  ct: 2,
  pt: 3,
  debug: 2,
  fo: 3,
  rb: 3,
  rc: 4,
  conv: 5,
};
const RIDER_HP = 10;
const RIDER_MP = 2;
const CT_DEALT_MULT = 1.5;
const CT_TAKEN_MULT = 0.75;

/** Round half up, applied AFTER multipliers. */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

// Conviction REPLACES CT's percentage; it never stacks a second CT factor.
const CONVICTION_DEALT_MULT = 2;
const CT_CONVICTION_DEALT_MULT = 2.0;
const CT_CONVICTION_TAKEN_MULT = 0.5;

/** `round(base × (conv ? 2 : 1) × (ct ? (conv ? 2.0 : 1.5) : 1))`. */
export function dealtMultiplier(ct: boolean, conviction: boolean): number {
  const convMult = conviction ? CONVICTION_DEALT_MULT : 1;
  const ctMult = ct ? (conviction ? CT_CONVICTION_DEALT_MULT : CT_DEALT_MULT) : 1;
  return convMult * ctMult;
}

/** `round(base × (ct ? (conv ? 0.5 : 0.75) : 1))`. With CT down, Conviction
 * alone reduces nothing. */
export function takenMultiplier(ct: boolean, conviction: boolean): number {
  return ct ? (conviction ? CT_CONVICTION_TAKEN_MULT : CT_TAKEN_MULT) : 1;
}

export function dealtDamage(base: number, ct: boolean, conviction: boolean): number {
  return roundHalfUp(base * dealtMultiplier(ct, conviction));
}

export function takenDamage(base: number, ct: boolean, conviction: boolean): number {
  return roundHalfUp(base * takenMultiplier(ct, conviction));
}

const BASE_KIT: readonly AbilityId[] = ["attack", "ct", "pt", "debug"];

/** Boss-defeat to ability-unlock map. Every entry has a reducer case arm. */
const KIT_UNLOCKS: Partial<Record<string, AbilityId>> = {
  [ALERT_STORM_ID]: "fo",
  [CASCADE_ID]: "rb",
  [SILENT_FAILURE_ID]: "rc",
};

/** Rush-order cumulative unlocks, intersected with `IMPLEMENTED_BOSSES` so a
 * boss beaten before its implementation grants no ability. The reducer
 * rejects any action outside this kit. */
export function deriveKit(defeatedBosses: string[]): AbilityId[] {
  const kit: AbilityId[] = [...BASE_KIT];
  for (const bossId of defeatedBosses) {
    if (!IMPLEMENTED_BOSSES.includes(bossId)) continue;
    const unlock = KIT_UNLOCKS[bossId];
    if (unlock && !kit.includes(unlock)) kit.push(unlock);
  }
  // Not a KIT_UNLOCKS entry: Conviction's other unlock, the mid-fight forge
  // before Imposter is defeated, is invisible here, so battleReduce gates it
  // separately off the boss's `forgeFired`.
  if (IMPLEMENTED_BOSSES.includes(IMPOSTER_ID) && defeatedBosses.includes(IMPOSTER_ID)) {
    kit.push("conv");
  }
  return kit;
}

function invalid(state: BattleState, reason: string): BattleState {
  return { ...state, events: [{ type: "invalid", reason }] };
}

// The only boss.kind branch points besides the reducer's case arms; a new
// boss adds one arm to each instead of forking battleReduce.

function cloneBoss(boss: BossState): BossState {
  if (boss.kind === CASCADE_ID) return { ...boss, nodes: boss.nodes.map((n) => ({ ...n })) };
  if (boss.kind === ALERT_STORM_ID) return { ...boss, bats: boss.bats.map((b) => ({ ...b })) };
  if (boss.kind === SILENT_FAILURE_ID) return { ...boss };
  if (boss.kind === IMPOSTER_ID) {
    return { ...boss }; // flat interface, no nested arrays to deep-clone
    /* v8 ignore next */
  }
  return assertNever(boss);
}

function findTarget(boss: BossState, id: number): { alive: boolean } | undefined {
  if (boss.kind === CASCADE_ID) return boss.nodes.find((n) => n.id === id);
  if (boss.kind === ALERT_STORM_ID) return boss.bats.find((b) => b.id === id);
  if (boss.kind === SILENT_FAILURE_ID) {
    return id === SF_TARGET_ID ? { alive: boss.hp > 0 } : undefined;
  }
  if (boss.kind === IMPOSTER_ID) {
    // 0/1/2 during CLONES, else [0] ([] once dead). Answers only "does this id
    // exist"; vanish targetability is isBossTargetable's job.
    return imposterLivingTargets(boss).includes(id) ? { alive: true } : undefined;
    /* v8 ignore next */
  }
  return assertNever(boss);
}

/** Whether the boss can be acted against now. Answered by each boss module,
 * never by an inline `kind` check at a call site. */
function isBossTargetable(boss: BossState): boolean {
  if (boss.kind === SILENT_FAILURE_ID) return isTargetable(boss);
  if (boss.kind === CASCADE_ID) return true;
  if (boss.kind === ALERT_STORM_ID) return true;
  if (boss.kind === IMPOSTER_ID) {
    // Untargetable only during VANISH. Root Cause bypasses this gate at the call
    // site: it ignores stealth and lands a real hit.
    return boss.phase !== "vanish";
    /* v8 ignore next */
  }
  return assertNever(boss);
}

/** Single-target hit. Returns the amount applied (Cascade: HP actually lost
 * after clamp and shield), so attack's +1 MP can gate on damage landing. A
 * hidden boss takes 0, the whiff: only `attack` reaches here while hidden,
 * pt/debug are rejected upstream. `ignoreStealth` is for Root Cause only. */
function dealSingleTarget(s: BattleState, targetId: number, amount: number, ignoreStealth = false): number {
  if (s.boss.kind === CASCADE_ID) {
    const before = s.boss.nodes.find((n) => n.id === targetId)!.hp;
    s.boss = damageNode(s.boss, targetId, amount);
    const node = s.boss.nodes.find((n) => n.id === targetId)!;
    const dealt = before - node.hp;
    s.events.push({ type: "damage", batId: targetId, amount: dealt });
    if (!node.alive) s.events.push({ type: "batDown", batId: targetId });
    return dealt;
  }
  if (s.boss.kind === ALERT_STORM_ID) {
    damageBat(s, targetId, amount);
    return amount;
  }
  if (s.boss.kind === SILENT_FAILURE_ID) {
    const applied = (ignoreStealth || isTargetable(s.boss)) ? amount : 0;
    const before = s.boss.hp;
    s.boss = damageSilentFailure(s.boss, applied);
    const dealt = before - s.boss.hp;
    s.events.push({ type: "damage", batId: targetId, amount: dealt });
    if (s.boss.hp === 0) s.events.push({ type: "batDown", batId: targetId });
    return dealt;
  }
  if (s.boss.kind === IMPOSTER_ID) {
    // Whiff while untargetable (attack only; pt/debug are rejected upstream).
    // Root Cause never reaches here for Imposter: its case arm bypasses the
    // CLONES illusion.
    const applied = (ignoreStealth || isBossTargetable(s.boss)) ? amount : 0;
    const wasPop = s.boss.phase === "clones" && targetId !== s.boss.realIndex;
    const result = resolveImposterHit(s.boss, targetId, applied);
    s.boss = result.boss;
    s.events.push({ type: "damage", batId: targetId, amount: result.dealt, wasPop });
    if (isImposterDefeated(s.boss)) s.events.push({ type: "batDown", batId: targetId });
    return result.dealt;
    /* v8 ignore next */
  }
  return assertNever(s.boss);
}

/** Debug's target mark. Cascade's per-node mark is what the pulse-absorb
 * check reads. */
function markTarget(s: BattleState, targetId: number): void {
  if (s.boss.kind === CASCADE_ID) {
    s.boss = markNode(s.boss, targetId);
  } else if (s.boss.kind === ALERT_STORM_ID) {
    s.boss.bats.find((b) => b.id === targetId)!.marked = true;
  } else if (s.boss.kind === SILENT_FAILURE_ID) {
    s.boss = markSilentFailure(s.boss);
  } else if (s.boss.kind === IMPOSTER_ID) {
    s.boss = markImposter(s.boss);
    /* v8 ignore next 3 */
  } else {
    assertNever(s.boss);
  }
  s.events.push({ type: "mark", batId: targetId });
}

/** Every boss kind carries a Debug mark, so Root Cause's marked bonus is
 * answered generically here, not by a kind check at the call site. */
function isTargetMarked(boss: BossState, targetId: number): boolean {
  if (boss.kind === CASCADE_ID) return !!boss.nodes.find((n) => n.id === targetId)?.marked;
  if (boss.kind === ALERT_STORM_ID) return !!boss.bats.find((b) => b.id === targetId)?.marked;
  if (boss.kind === SILENT_FAILURE_ID) return boss.marked;
  if (boss.kind === IMPOSTER_ID) {
    return boss.marked; // whole-boss flag, targetId (a clone slot) is irrelevant
    /* v8 ignore next */
  }
  return assertNever(boss);
}

export function battleReduce(state: BattleState, action: BattleAction): BattleState {
  if (state.status !== "active") return invalid(state, "battle over");

  const kit = deriveKit(state.defeatedBosses);
  // The mid-fight forge unlocks Conviction the instant Imposter crosses 50%,
  // before it is in `defeatedBosses` where `deriveKit` would see it.
  const convForgeUnlocked = state.boss.kind === IMPOSTER_ID && state.boss.forgeFired;
  if (!kit.includes(action.type) && !(action.type === "conv" && convForgeUnlocked)) {
    return invalid(state, "not in kit");
  }

  if (action.type === "attack" || action.type === "pt" || action.type === "debug" || action.type === "rc") {
    const target = findTarget(state.boss, action.target);
    if (!target || !target.alive) return invalid(state, "invalid target");
    // pt/debug against a hidden boss are invalid. attack is exempt and whiffs
    // in dealSingleTarget; Root Cause is exempt and lands a real hit.
    if (action.type !== "attack" && action.type !== "rc" && !isBossTargetable(state.boss)) {
      return invalid(state, "target is not there");
    }
  }
  // fo is untargeted but still vanish-gated, checked before MP is spent.
  if (action.type === "fo" && !isBossTargetable(state.boss)) {
    return invalid(state, "target is not there");
  }
  // Both unlock paths still require hp*4 <= maxHp at cast. Checked after the
  // kit check so "not in kit" takes precedence.
  if (action.type === "conv" && !convictionCastable(state.hero.hp, state.hero.maxHp)) {
    return invalid(state, "conviction gate not met");
  }
  const mpCost = MP_COST[action.type];
  if (state.hero.mp < mpCost) return invalid(state, "not enough MP");

  const s: BattleState = {
    ...state,
    hero: { ...state.hero },
    boss: cloneBoss(state.boss),
    dots: state.dots.map((d) => ({ ...d })),
    heroDots: state.heroDots.map((d) => ({ ...d })),
    cast: [...state.cast],
    defeatedBosses: [...state.defeatedBosses],
    events: [],
  };
  // Only Alert Storm reshuffles at scream end.
  const screaming = s.boss.kind === ALERT_STORM_ID && isScreamTurn(s);
  const preexistingDots = s.dots.length; // a dot cast this turn ticks from NEXT turn
  // Captured before this turn's hit and DoTs so the forge event fires once,
  // on the turn forgeFired flips.
  const forgeFiredBefore = s.boss.kind === IMPOSTER_ID && s.boss.forgeFired;
  s.hero.mp -= MP_COST[action.type];

  switch (action.type) {
    case "attack": {
      const dealt = dealSingleTarget(s, action.target, dealtDamage(ATTACK_DMG, s.ctTurns > 0, s.conviction));
      // Gated on damage landing, not on kind, so a vanished whiff grants nothing.
      if (dealt > 0) s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + 1);
      break;
    }
    case "ct": {
      s.ctTurns = CT_DURATION; // re-cast = refresh, no stack
      break;
    }
    case "rb": {
      // Conviction doubles the heal. CT never applies: it is not a damage roll.
      const healAmount = s.conviction ? ROLLBACK_HEAL * 2 : ROLLBACK_HEAL;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + healAmount);
      // Cleanses the hero-side mark/DoT from the Imposter's mirrored Debug.
      s.heroMarked = false;
      s.heroDots = [];
      break;
    }
    case "pt": {
      dealSingleTarget(s, action.target, dealtDamage(PT_DMG, s.ctTurns > 0, s.conviction));
      break;
    }
    case "debug": {
      // A CLONES pop spends the turn and MP and applies nothing else. Derived
      // from boss state before the hit, never from the damage returned.
      const wasPop = s.boss.kind === IMPOSTER_ID && s.boss.phase === "clones" && action.target !== s.boss.realIndex;
      dealSingleTarget(s, action.target, dealtDamage(DEBUG_DMG, s.ctTurns > 0, s.conviction));
      if (!wasPop) {
        markTarget(s, action.target); // permanent — this is the memory tool
        s.dots.push({ batId: action.target, ticksLeft: DOT_TICKS, tick: s.conviction ? DOT_TICK * 2 : DOT_TICK });
      }
      // Debug during an unfired PULSE charge breaks it, consuming the mark.
      // Phases are exclusive, so a pop cannot happen here.
      if (s.boss.kind === IMPOSTER_ID && s.boss.phase === "pulse" && s.boss.pulseCharged) {
        s.boss = breakPulse(s.boss);
      }
      break;
    }
    case "rc": {
      if (s.boss.kind === IMPOSTER_ID) {
        // Ignores the CLONES illusion and always hits the real clone, whichever
        // slot was targeted.
        const wasVanish = s.boss.phase === "vanish";
        const base = isTargetMarked(s.boss, action.target) ? ROOT_CAUSE_MARKED_DMG : ROOT_CAUSE_DMG;
        const amount = dealtDamage(base, s.ctTurns > 0, s.conviction);
        const realId = s.boss.realIndex ?? action.target;
        const before = s.boss.hp;
        s.boss = damageImposter(s.boss, amount);
        const dealt = before - s.boss.hp;
        s.events.push({ type: "damage", batId: realId, amount: dealt });
        if (isImposterDefeated(s.boss)) s.events.push({ type: "batDown", batId: realId });
        // Rips VANISH back this hero turn; an early end still counts as a
        // completed phase.
        if (wasVanish) s.boss = ripBackVanish(s.boss);
      } else {
        // Every other kind: the marked bonus via isTargetMarked, and
        // `ignoreStealth=true` so a vanished Silent Failure takes the full hit.
        const base = isTargetMarked(s.boss, action.target) ? ROOT_CAUSE_MARKED_DMG : ROOT_CAUSE_DMG;
        dealSingleTarget(s, action.target, dealtDamage(base, s.ctTurns > 0, s.conviction), true);
      }
      break;
    }
    case "conv": {
      s.conviction = true;
      break;
    }
    case "fo": {
      // AoE: resolves every hit, then at most one reshuffle (fanOutHit owns
      // that rule; nodes never reshuffle).
      if (s.boss.kind === CASCADE_ID) {
        const before = s.boss.nodes.filter((n) => n.alive).map((n) => ({ id: n.id, hp: n.hp }));
        s.boss = fanOutNodes(s.boss, s.ctTurns > 0, s.conviction);
        for (const b of before) {
          const node = s.boss.nodes.find((n) => n.id === b.id)!;
          s.events.push({ type: "damage", batId: b.id, amount: b.hp - node.hp });
          if (!node.alive) s.events.push({ type: "batDown", batId: b.id });
        }
      } else if (s.boss.kind === ALERT_STORM_ID) {
        fanOutHit(s, dealtDamage(FAN_OUT_DMG, s.ctTurns > 0, s.conviction));
      } else if (s.boss.kind === SILENT_FAILURE_ID) {
        // One entity, so "every living target" is one hit. Only reachable while
        // embodied (fo is vanish-gated above): no reshuffle, no shield.
        const before = s.boss.hp;
        s.boss = damageSilentFailure(s.boss, dealtDamage(FAN_OUT_DMG, s.ctTurns > 0, s.conviction));
        const dealt = before - s.boss.hp;
        s.events.push({ type: "damage", batId: SF_TARGET_ID, amount: dealt });
        if (s.boss.hp === 0) s.events.push({ type: "batDown", batId: SF_TARGET_ID });
      } else if (s.boss.kind === IMPOSTER_ID) {
        // Both clone slots pop (no HP) and the real slot takes the amount. The
        // non-real slots still get zero-amount wasPop events for the renderer.
        const targets = imposterLivingTargets(s.boss);
        // Outside CLONES the only living target is 0 (a finished fight rejects
        // every action).
        const realId = s.boss.phase === "clones" ? (s.boss.realIndex ?? 0) : 0;
        const before = s.boss.hp;
        s.boss = damageImposter(s.boss, dealtDamage(FAN_OUT_DMG, s.ctTurns > 0, s.conviction));
        const dealt = before - s.boss.hp;
        for (const id of targets) {
          if (id === realId) {
            s.events.push({ type: "damage", batId: id, amount: dealt });
            if (isImposterDefeated(s.boss)) s.events.push({ type: "batDown", batId: id });
          } else {
            s.events.push({ type: "damage", batId: id, amount: 0, wasPop: true });
          }
        }
        /* v8 ignore next 3 */
      } else {
        assertNever(s.boss);
      }
      break;
    }
  }
  // MIRROR tracks the last special cast (trackSpecial ignores "attack").
  if (s.boss.kind === IMPOSTER_ID) {
    s.boss = trackSpecial(s.boss, action.type);
  }
  if (!s.cast.includes(action.type)) {
    s.cast.push(action.type);
    s.events.push({ type: "firstCast", ability: action.type });
  }

  // DoT ticks: flat stamped `tick`, never CT-multiplied or re-derived from
  // the current conviction flag. A tick is not a hit (no reshuffle). Cascade
  // ticks go through `damageNode` so the carrier shield applies.
  if (s.status === "active") {
    for (let i = 0; i < preexistingDots; i++) {
      const d = s.dots[i];
      if (s.boss.kind === CASCADE_ID) {
        const node = s.boss.nodes.find((n) => n.id === d.batId);
        if (node && node.alive) {
          const before = node.hp;
          s.boss = damageNode(s.boss, d.batId, d.tick);
          const after = s.boss.nodes.find((n) => n.id === d.batId)!;
          s.events.push({ type: "dot", batId: d.batId, amount: before - after.hp });
          if (!after.alive) s.events.push({ type: "batDown", batId: d.batId });
        }
      } else if (s.boss.kind === ALERT_STORM_ID) {
        const bat = s.boss.bats.find((b) => b.id === d.batId)!;
        if (bat.alive) {
          bat.hp = Math.max(0, bat.hp - d.tick);
          s.events.push({ type: "dot", batId: d.batId, amount: d.tick });
          if (bat.hp === 0) {
            bat.alive = false;
            s.events.push({ type: "batDown", batId: d.batId });
          }
        }
      } else if (s.boss.kind === SILENT_FAILURE_ID) {
        if (s.boss.hp > 0) {
          const before = s.boss.hp;
          s.boss = damageSilentFailure(s.boss, d.tick);
          s.events.push({ type: "dot", batId: d.batId, amount: before - s.boss.hp });
          if (s.boss.hp === 0) {
            s.events.push({ type: "batDown", batId: d.batId });
            // A DoT kill re-embodies the boss for the death reel: the scene must
            // show the body frame, never empty armor. Only here is a tick known to
            // be the killing blow.
            if (s.boss.phase === "vanished") {
              s.boss = { ...s.boss, forceBodyForDeath: true };
            }
          }
        }
      } else if (s.boss.kind === IMPOSTER_ID) {
        // DoTs stay anchored to the boss through and after CLONES, never to a
        // clone slot.
        if (s.boss.hp > 0) {
          const before = s.boss.hp;
          s.boss = damageImposter(s.boss, d.tick);
          s.events.push({ type: "dot", batId: d.batId, amount: before - s.boss.hp });
          if (isImposterDefeated(s.boss)) s.events.push({ type: "batDown", batId: d.batId });
        }
        /* v8 ignore next 3 */
      } else {
        assertNever(s.boss);
      }
      d.ticksLeft -= 1;
    }
    s.dots = s.dots.filter((d) => {
      if (s.boss.kind === CASCADE_ID) {
        return d.ticksLeft > 0 && !!s.boss.nodes.find((n) => n.id === d.batId)?.alive;
      }
      if (s.boss.kind === ALERT_STORM_ID) {
        return d.ticksLeft > 0 && s.boss.bats.find((b) => b.id === d.batId)!.alive;
      }
      if (s.boss.kind === SILENT_FAILURE_ID) {
        return d.ticksLeft > 0 && s.boss.hp > 0;
      }
      if (s.boss.kind === IMPOSTER_ID) {
        return d.ticksLeft > 0 && s.boss.hp > 0;
        /* v8 ignore next */
      }
      return assertNever(s.boss);
    });
  }

  // The forge fires when forgeFired flips this turn, from the hit or a DoT
  // tick, independently of `defeatedBosses`.
  if (s.boss.kind === IMPOSTER_ID && s.boss.forgeFired && !forgeFiredBefore) {
    s.events.push({ type: "forge", ability: "conviction" });
  }

  // A boss kill ends the fight before the boss turn. Rider, forge and
  // unlocks apply to the first victory only (a rematch is a lap).
  let bossDefeated: boolean;
  if (s.boss.kind === CASCADE_ID) bossDefeated = isCascadeDefeated(s.boss);
  else if (s.boss.kind === ALERT_STORM_ID) bossDefeated = isBossDefeated(s.boss);
  else if (s.boss.kind === SILENT_FAILURE_ID) bossDefeated = isSilentFailureDefeated(s.boss);
  else if (s.boss.kind === IMPOSTER_ID) {
    bossDefeated = isImposterDefeated(s.boss);
    /* v8 ignore next 2 */
  } else {
    bossDefeated = assertNever(s.boss);
  }
  if (bossDefeated) {
    s.status = "victory";
    s.events.push({ type: "victory" });
    const bossId = s.boss.kind;
    // `undefined` for Imposter: the rush ends there, so no ability is left
    // to forge.
    let forgeAbility: "fan-out" | "rollback" | "root-cause" | undefined;
    if (s.boss.kind === CASCADE_ID) forgeAbility = "rollback";
    else if (s.boss.kind === ALERT_STORM_ID) forgeAbility = "fan-out";
    else if (s.boss.kind === SILENT_FAILURE_ID) forgeAbility = "root-cause";
    else if (s.boss.kind === IMPOSTER_ID) {
      forgeAbility = undefined;
      /* v8 ignore next 2 */
    } else {
      forgeAbility = assertNever(s.boss);
    }
    if (!s.defeatedBosses.includes(bossId)) {
      s.defeatedBosses.push(bossId);
      if (forgeAbility) s.events.push({ type: "forge", ability: forgeAbility });
      s.hero.maxHp += RIDER_HP;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + RIDER_HP);
      s.hero.maxMp += RIDER_MP;
      s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + RIDER_MP);
      s.events.push({ type: "rider", maxHp: RIDER_HP, maxMp: RIDER_MP });
      s.events.push({ type: "unlock", id: bossId });
    }
    return s;
  }

  // Scream-end reshuffle: position memory expires when the mouths close.
  if (s.status === "active" && screaming) reshuffle(s, "screamEnd");

  if (s.status === "active") {
    let heroDamage: number;
    if (s.boss.kind === CASCADE_ID) {
      // A hero-turn kill of the carrier makes the pulse fall forward (no
      // reset, no storm) so the carrier is always a living node.
      s.boss = fallForwardIfCarrierDied(s.boss);
      const result = resolveCascadeBossTurn(s.boss, s.ctTurns > 0, s.conviction);
      s.boss = result.boss;
      heroDamage = result.heroDamage;
    } else if (s.boss.kind === ALERT_STORM_ID) {
      heroDamage = roundHalfUp(rawVolley(s.boss.bats) * (s.ctTurns > 0 ? CT_TAKEN_MULT : 1));
    } else if (s.boss.kind === SILENT_FAILURE_ID) {
      const result = resolveSilentFailureBossTurn(s.boss, s.ctTurns > 0, s.conviction);
      s.boss = result.boss;
      heroDamage = result.heroDamage;
    } else if (s.boss.kind === IMPOSTER_ID) {
      // Existing hero DoTs tick before the boss acts, so a DoT the mirror pushes
      // this turn starts next turn. Flat MIRROR_DEBUG_DOT_TICK, never scaled.
      let heroDotDamage = 0;
      for (const hd of s.heroDots) {
        heroDotDamage += MIRROR_DEBUG_DOT_TICK;
        hd.ticksLeft -= 1;
      }
      s.heroDots = s.heroDots.filter((hd) => hd.ticksLeft > 0);
      const result = resolveImposterBossTurn(s.boss, s.ctTurns > 0, s.conviction);
      s.boss = result.boss;
      heroDamage = result.heroDamage + heroDotDamage;
      if (result.mirroredDebug) {
        s.heroMarked = true;
        s.heroDots.push({ ticksLeft: MIRROR_DEBUG_DOT_TICKS });
      }
      /* v8 ignore next 3 */
    } else {
      heroDamage = assertNever(s.boss);
    }
    s.hero.hp = Math.max(0, s.hero.hp - heroDamage);
    s.events.push({ type: "heroDamage", amount: heroDamage });
    if (s.hero.hp === 0) {
      s.status = "defeat";
      s.events.push({ type: "defeat" });
    }
  }

  // end of turn: timers, turn counter, MP regen (capped)
  if (s.status === "active") {
    s.ctTurns = Math.max(0, s.ctTurns - 1);
    s.turn += 1;
    s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + 1);
  }
  return s;
}
