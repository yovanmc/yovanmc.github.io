// M5 battle engine — pure, deterministic, turn-discrete reducer.
// Rules source: docs/superpowers/specs/2026-07-25-battle-gameplay-addendum.md
// plus the plan-originated numbers table in 2026-07-28-be1-battle-engine-plan.md.
// No DOM, no Date, no Math.random: all randomness flows from state.rngState.
//
// Core (this file): hero economy, MP costs, CT/DoT timers, rounding, rng,
// event log. Per-boss mechanics live behind bosses/<boss>.ts (M6 PR-1a task 2
// split out Alert Storm first; docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md).

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
import { IMPLEMENTED_BOSSES, RUSH_ORDER } from "./rushOrder";
export type { Bat };
export { isScreamTurn };
// Re-exported for every existing import site (`from "./engine"`) — canonical
// definitions live in ./rushOrder so bootParams.ts can import them without
// pulling this module's engine<->alertStorm cycle into the eagerly loaded
// landing bundle (measured regression + fix: see rushOrder.ts).
export { IMPLEMENTED_BOSSES, RUSH_ORDER };

/** Discriminated on `.kind`. M6 PR-1b task 3 adds Cascade; Silent Failure and
 * Imposter join in PR-2/PR-3. */
export type BossState = AlertStormBoss | CascadeBoss;

export interface Hero {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export type BattleStatus = "active" | "victory" | "defeat";

export type BattleEvent =
  | { type: "damage"; batId: number; amount: number }
  | { type: "heroDamage"; amount: number }
  | { type: "dot"; batId: number; amount: number }
  | { type: "mark"; batId: number }
  | { type: "reshuffle"; reason: "fakeHit" | "screamEnd" }
  | { type: "batDown"; batId: number }
  | { type: "victory" }
  | { type: "defeat" }
  | { type: "forge"; ability: "fan-out" | "rollback" }
  | { type: "rider"; maxHp: number; maxMp: number }
  | { type: "unlock"; id: string }
  | { type: "firstCast"; ability: AbilityId }
  | { type: "invalid"; reason: string };

export type AbilityId = "attack" | "ct" | "pt" | "debug" | "fo";

export type BattleAction =
  | { type: "attack"; target: number }
  | { type: "ct" }
  | { type: "pt"; target: number }
  | { type: "debug"; target: number }
  | { type: "fo" };

export interface BattleState {
  seed: number;
  attempt: number;
  /** Hero turn counter, 1-based. Turn order is hero → boss. */
  turn: number;
  hero: Hero;
  boss: BossState;
  /** Critical Thinking turns remaining (0 = inactive). */
  ctTurns: number;
  /** Conviction's persist-once-active flag (M6 §Multipliers). Not castable in
   * PR-1a — always false — but the field lands now so the multiplier core
   * below is exercised by real state shape, not just bare booleans. Imposter
   * (PR-3) is the only caster. */
  conviction: boolean;
  /** Debug DoTs: batId → ticks remaining. */
  dots: { batId: number; ticksLeft: number }[];
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
  /** `boss=` capture key / FIGHT selection. Validated against
   * `IMPLEMENTED_BOSSES` here too (belt-and-suspenders with
   * bootParams.ts's `parseBoss` — never a crash path on the auto-deploy
   * site, pass-2 G1); an unimplemented or garbage id falls back to
   * `alert-storm`, same default as today. */
  boss?: string;
}

const MOD = 2147483647; // Park–Miller modulus, same family as src/lib/rng.ts

/** Advance the Park–Miller stream; returns the new state (also the draw).
 * Exported for bosses/alertStorm.ts (spawn + reshuffle draws). */
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
  } else {
    ({ boss, rng } = spawnAlertStorm(seeded, nextRng));
  }
  const defeatedBosses = opts.defeatedBosses ?? [];
  // Derived, not stored (owner ruling, M6 plan): rider carry-over recomputes
  // from defeatedBosses.length every init, so a rematch of an earlier boss
  // starts at the hero's current post-rider stats. Battles always start full.
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
    status: "active",
    events: [],
    rngState: rng,
    cast: [],
    defeatedBosses,
  };
}

/** Plan-originated numbers table (owner-approved 2026-07-28). */
const ATTACK_DMG = 12;
const PT_DMG = 28;
const DEBUG_DMG = 6;
export const FAN_OUT_DMG = 8; // Cascade-signed resolution (dissect F1) — addendum "~10"; shared by every boss's Fan Out (bosses/cascade.ts imports this rather than redefining it)
const DOT_TICK = 4;
const DOT_TICKS = 3;
const CT_DURATION = 3;
const MP_COST: Record<AbilityId, number> = { attack: 0, ct: 2, pt: 3, debug: 2, fo: 3 };
const RIDER_HP = 10;
const RIDER_MP = 2;
const CT_DEALT_MULT = 1.5;
const CT_TAKEN_MULT = 0.75;

/** Round half up, applied AFTER multipliers (pinned micro-semantics). */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

// ---- Multiplier core (M6 §Multipliers — dissect F2, ONE rule) -------------
// Conviction REPLACES CT's percentage; it never stacks a second CT factor.
// Not castable in PR-1a — `conviction` is always false on every real state —
// but the helpers below are the pinned contract, tested directly against the
// two owner-signed worked examples (PT→112, glitch-slash-taken→7).
const CONVICTION_DEALT_MULT = 2;
const CT_CONVICTION_DEALT_MULT = 2.0;
const CT_CONVICTION_TAKEN_MULT = 0.5;

/** `round(base × (conv ? 2 : 1) × (ct ? (conv ? 2.0 : 1.5) : 1))`. */
export function dealtMultiplier(ct: boolean, conviction: boolean): number {
  const convMult = conviction ? CONVICTION_DEALT_MULT : 1;
  const ctMult = ct ? (conviction ? CT_CONVICTION_DEALT_MULT : CT_DEALT_MULT) : 1;
  return convMult * ctMult;
}

/** `round(base × (ct ? (conv ? 0.5 : 0.75) : 1))` — with CT down, Conviction
 * alone reduces nothing (it only ever replaces CT's percentage). */
export function takenMultiplier(ct: boolean, conviction: boolean): number {
  return ct ? (conviction ? CT_CONVICTION_TAKEN_MULT : CT_TAKEN_MULT) : 1;
}

export function dealtDamage(base: number, ct: boolean, conviction: boolean): number {
  return roundHalfUp(base * dealtMultiplier(ct, conviction));
}

export function takenDamage(base: number, ct: boolean, conviction: boolean): number {
  return roundHalfUp(base * takenMultiplier(ct, conviction));
}

// ---- Kit derivation (M6 §Cross-boss architecture) --------------------------
const BASE_KIT: readonly AbilityId[] = ["attack", "ct", "pt", "debug"];

/** Boss-defeat → ability unlock map, gated to shipped modules. Later PRs
 * extend this map (Rollback on cascade, Root Cause on silent-failure), never
 * `deriveKit`'s body. */
const KIT_UNLOCKS: Partial<Record<string, AbilityId>> = {
  [ALERT_STORM_ID]: "fo",
};

/** Rush-order cumulative unlocks, intersected with `IMPLEMENTED_BOSSES` (a
 * boss beaten ahead of its own PR must never grant a kit entry with no
 * ability behind it). The reducer rejects any action outside this kit. */
export function deriveKit(defeatedBosses: string[]): AbilityId[] {
  const kit: AbilityId[] = [...BASE_KIT];
  for (const bossId of defeatedBosses) {
    if (!IMPLEMENTED_BOSSES.includes(bossId)) continue;
    const unlock = KIT_UNLOCKS[bossId];
    if (unlock && !kit.includes(unlock)) kit.push(unlock);
  }
  return kit;
}

function invalid(state: BattleState, reason: string): BattleState {
  return { ...state, events: [{ type: "invalid", reason }] };
}

// ---- Per-boss dispatch helpers (M6 PR-1b task 3) ---------------------------
// Hero economy (MP, CT timers, DoT bookkeeping, firstCast, defeat) stays
// shared below; these helpers are the only boss.kind branch points, so a
// future boss just adds one arm to each rather than forking battleReduce.

function cloneBoss(boss: BossState): BossState {
  if (boss.kind === CASCADE_ID) return { ...boss, nodes: boss.nodes.map((n) => ({ ...n })) };
  return { ...boss, bats: boss.bats.map((b) => ({ ...b })) };
}

function findTarget(boss: BossState, id: number): { alive: boolean } | undefined {
  if (boss.kind === CASCADE_ID) return boss.nodes.find((n) => n.id === id);
  return boss.bats.find((b) => b.id === id);
}

/** Single-target hit (attack/pt/debug's own damage). Alert Storm routes
 * through `damageBat` (reshuffle-aware, mutates `s` directly). Cascade routes
 * through the pure `damageNode` (carrier-shield-aware) and reports the actual
 * HP lost — not the pre-clamp/pre-shield amount — via a before/after diff, so
 * a killing blow against an already-low node never over-reports. */
function dealSingleTarget(s: BattleState, targetId: number, amount: number): void {
  if (s.boss.kind === CASCADE_ID) {
    const before = s.boss.nodes.find((n) => n.id === targetId)!.hp;
    s.boss = damageNode(s.boss, targetId, amount);
    const node = s.boss.nodes.find((n) => n.id === targetId)!;
    s.events.push({ type: "damage", batId: targetId, amount: before - node.hp });
    if (!node.alive) s.events.push({ type: "batDown", batId: targetId });
  } else {
    damageBat(s, targetId, amount);
  }
}

/** Debug's target mark. Cascade's `markNode` is what the pulse-absorb check
 * (resolveCascadeBossTurn) reads; Alert Storm keeps its own permanent
 * `bat.marked` flag (the memory tool). */
function markTarget(s: BattleState, targetId: number): void {
  if (s.boss.kind === CASCADE_ID) {
    s.boss = markNode(s.boss, targetId);
  } else {
    s.boss.bats.find((b) => b.id === targetId)!.marked = true;
  }
  s.events.push({ type: "mark", batId: targetId });
}

export function battleReduce(state: BattleState, action: BattleAction): BattleState {
  if (state.status !== "active") return invalid(state, "battle over");

  if (!deriveKit(state.defeatedBosses).includes(action.type)) {
    return invalid(state, "not in kit");
  }

  // validate before cloning
  if (action.type === "attack" || action.type === "pt" || action.type === "debug") {
    const target = findTarget(state.boss, action.target);
    if (!target || !target.alive) return invalid(state, "invalid target");
  }
  const mpCost = MP_COST[action.type];
  if (state.hero.mp < mpCost) return invalid(state, "not enough MP");

  const s: BattleState = {
    ...state,
    hero: { ...state.hero },
    boss: cloneBoss(state.boss),
    dots: state.dots.map((d) => ({ ...d })),
    cast: [...state.cast],
    defeatedBosses: [...state.defeatedBosses],
    events: [],
  };
  // Scream is Alert Storm's own mechanic — Cascade has no mouths to close, so
  // it never reshuffles at "scream end" (the check below gates on boss.kind).
  const screaming = s.boss.kind === ALERT_STORM_ID && isScreamTurn(s);
  const dealtMult = s.ctTurns > 0 ? CT_DEALT_MULT : 1;
  const preexistingDots = s.dots.length; // a dot cast this turn ticks from NEXT turn
  s.hero.mp -= MP_COST[action.type];

  switch (action.type) {
    case "attack": {
      dealSingleTarget(s, action.target, roundHalfUp(ATTACK_DMG * dealtMult));
      s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + 1); // +1 MP on hit
      break;
    }
    case "ct": {
      s.ctTurns = CT_DURATION; // re-cast = refresh, no stack
      break;
    }
    case "pt": {
      dealSingleTarget(s, action.target, roundHalfUp(PT_DMG * dealtMult));
      break;
    }
    case "debug": {
      dealSingleTarget(s, action.target, roundHalfUp(DEBUG_DMG * dealtMult));
      markTarget(s, action.target); // permanent — this is the memory tool
      s.dots.push({ batId: action.target, ticksLeft: DOT_TICKS });
      break;
    }
    case "fo": {
      // AoE — hits every living target; resolves all hits, then at most one
      // reshuffle (fanOutHit owns that rule; nodes never reshuffle). Uses the
      // Conviction-aware helper directly since Fan Out ships after the
      // multiplier core.
      if (s.boss.kind === CASCADE_ID) {
        const before = s.boss.nodes.filter((n) => n.alive).map((n) => ({ id: n.id, hp: n.hp }));
        s.boss = fanOutNodes(s.boss, s.ctTurns > 0, s.conviction);
        for (const b of before) {
          const node = s.boss.nodes.find((n) => n.id === b.id)!;
          s.events.push({ type: "damage", batId: b.id, amount: b.hp - node.hp });
          if (!node.alive) s.events.push({ type: "batDown", batId: b.id });
        }
      } else {
        fanOutHit(s, dealtDamage(FAN_OUT_DMG, s.ctTurns > 0, s.conviction));
      }
      break;
    }
  }
  if (!s.cast.includes(action.type)) {
    s.cast.push(action.type);
    s.events.push({ type: "firstCast", ability: action.type });
  }

  // DoT ticks — flat 4, never CT-multiplied; a tick is not a hit (no
  // reshuffle). Cascade nodes route through `damageNode` so the carrier
  // shield applies "from every source" (plan §Boss 2 table) even to ticks.
  if (s.status === "active") {
    for (let i = 0; i < preexistingDots; i++) {
      const d = s.dots[i];
      if (s.boss.kind === CASCADE_ID) {
        const node = s.boss.nodes.find((n) => n.id === d.batId);
        if (node && node.alive) {
          const before = node.hp;
          s.boss = damageNode(s.boss, d.batId, DOT_TICK);
          const after = s.boss.nodes.find((n) => n.id === d.batId)!;
          s.events.push({ type: "dot", batId: d.batId, amount: before - after.hp });
          if (!after.alive) s.events.push({ type: "batDown", batId: d.batId });
        }
      } else {
        const bat = s.boss.bats.find((b) => b.id === d.batId)!;
        if (bat.alive) {
          bat.hp = Math.max(0, bat.hp - DOT_TICK);
          s.events.push({ type: "dot", batId: d.batId, amount: DOT_TICK });
          if (bat.hp === 0) {
            bat.alive = false;
            s.events.push({ type: "batDown", batId: d.batId });
          }
        }
      }
      d.ticksLeft -= 1;
    }
    s.dots = s.dots.filter((d) => {
      if (s.boss.kind === CASCADE_ID) {
        return d.ticksLeft > 0 && !!s.boss.nodes.find((n) => n.id === d.batId)?.alive;
      }
      return d.ticksLeft > 0 && s.boss.bats.find((b) => b.id === d.batId)!.alive;
    });
  }

  // victory: the boss going down ends the fight immediately — no boss turn
  // lands. Rider/forge/unlocks are first-victory only (rematch = lap).
  const bossDefeated = s.boss.kind === CASCADE_ID ? isCascadeDefeated(s.boss) : isBossDefeated(s.boss);
  if (bossDefeated) {
    s.status = "victory";
    s.events.push({ type: "victory" });
    const bossId = s.boss.kind;
    const forgeAbility = s.boss.kind === CASCADE_ID ? "rollback" : "fan-out";
    if (!s.defeatedBosses.includes(bossId)) {
      s.defeatedBosses.push(bossId);
      s.events.push({ type: "forge", ability: forgeAbility });
      s.hero.maxHp += RIDER_HP;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + RIDER_HP);
      s.hero.maxMp += RIDER_MP;
      s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + RIDER_MP);
      s.events.push({ type: "rider", maxHp: RIDER_HP, maxMp: RIDER_MP });
      s.events.push({ type: "unlock", id: bossId });
    }
    return s;
  }

  // scream-end reshuffle: position memory expires when the mouths close
  // (Alert Storm only — `screaming` is always false for any other boss.kind)
  if (s.status === "active" && screaming) reshuffle(s, "screamEnd");

  // boss turn
  if (s.status === "active") {
    let heroDamage: number;
    if (s.boss.kind === CASCADE_ID) {
      // Restore the "carrier is always a living node" invariant before
      // running the boss turn — a hero-turn hit above may have killed the
      // carrier (pulse micro-rule c: falls forward, no reset, no storm).
      s.boss = fallForwardIfCarrierDied(s.boss);
      const result = resolveCascadeBossTurn(s.boss, s.ctTurns > 0, s.conviction);
      s.boss = result.boss;
      heroDamage = result.heroDamage;
    } else {
      heroDamage = roundHalfUp(rawVolley(s.boss.bats) * (s.ctTurns > 0 ? CT_TAKEN_MULT : 1));
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
