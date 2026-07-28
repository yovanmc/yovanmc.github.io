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
  isBossDefeated,
  isScreamTurn,
  rawVolley,
  reshuffle,
  spawnAlertStorm,
} from "./bosses/alertStorm";
export type { Bat };
export { isScreamTurn };

/** Grows into a discriminated union as PR-1b+ add Cascade/Silent Failure/Imposter. */
export type BossState = AlertStormBoss;

/** Pinned boss-rush order (M6 plan §Cross-boss architecture). Fixed forever —
 * later PRs only ever read this, never reorder it. */
export const RUSH_ORDER: readonly string[] = [
  ALERT_STORM_ID,
  "cascade",
  "silent-failure",
  "imposter-syndrome",
];

/** Prefix of RUSH_ORDER actually shipped in running code (pass-2 G1 — the
 * live-crash guard). Kit derivation, FIGHT's next-boss row, and the `boss=`
 * capture-key whitelist all intersect with this so a boss beaten ahead of its
 * own PR never grants a kit entry / route with no module behind it. Extend
 * this array, never remove from it, as each subsequent PR ships a boss. */
export const IMPLEMENTED_BOSSES: readonly string[] = [ALERT_STORM_ID];

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
  | { type: "forge"; ability: "fan-out" }
  | { type: "rider"; maxHp: number; maxMp: number }
  | { type: "unlock"; id: string }
  | { type: "firstCast"; ability: AbilityId }
  | { type: "invalid"; reason: string };

export type AbilityId = "attack" | "ct" | "pt" | "debug";

export type BattleAction =
  | { type: "attack"; target: number }
  | { type: "ct" }
  | { type: "pt"; target: number }
  | { type: "debug"; target: number };

export interface BattleState {
  seed: number;
  attempt: number;
  /** Hero turn counter, 1-based. Turn order is hero → boss. */
  turn: number;
  hero: Hero;
  boss: BossState;
  /** @deprecated Alias of `boss.bats` — same array reference, never diverges.
   * Kept only so BattleScene.tsx keeps compiling until PR-1a task 6's
   * scene-shell split moves its readers onto `boss.bats` directly. */
  bats: Bat[];
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
  const { boss, rng } = spawnAlertStorm(seeded, nextRng);
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
    bats: boss.bats, // alias — see BattleState.bats
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
const DOT_TICK = 4;
const DOT_TICKS = 3;
const CT_DURATION = 3;
const MP_COST: Record<AbilityId, number> = { attack: 0, ct: 2, pt: 3, debug: 2 };
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

/** Boss-defeat → ability unlock map, gated to shipped modules. Empty this PR
 * (Fan Out's `"fo"` entry lands in PR-1a task 4 once `AbilityId` grows); later
 * PRs extend this map, never `deriveKit`'s body. */
const KIT_UNLOCKS: Partial<Record<string, AbilityId>> = {};

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

export function battleReduce(state: BattleState, action: BattleAction): BattleState {
  if (state.status !== "active") return invalid(state, "battle over");

  if (!deriveKit(state.defeatedBosses).includes(action.type)) {
    return invalid(state, "not in kit");
  }

  // validate before cloning
  if (action.type === "attack" || action.type === "pt" || action.type === "debug") {
    const target = state.boss.bats.find((b) => b.id === action.target);
    if (!target || !target.alive) return invalid(state, "invalid target");
  }
  const mpCost = MP_COST[action.type];
  if (state.hero.mp < mpCost) return invalid(state, "not enough MP");

  const bossBats = state.boss.bats.map((b) => ({ ...b }));
  const s: BattleState = {
    ...state,
    hero: { ...state.hero },
    boss: { ...state.boss, bats: bossBats },
    bats: bossBats, // alias — see BattleState.bats
    dots: state.dots.map((d) => ({ ...d })),
    cast: [...state.cast],
    defeatedBosses: [...state.defeatedBosses],
    events: [],
  };
  const screaming = isScreamTurn(s);
  const dealtMult = s.ctTurns > 0 ? CT_DEALT_MULT : 1;
  const preexistingDots = s.dots.length; // a dot cast this turn ticks from NEXT turn
  s.hero.mp -= MP_COST[action.type];

  switch (action.type) {
    case "attack": {
      damageBat(s, action.target, roundHalfUp(ATTACK_DMG * dealtMult));
      s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + 1); // +1 MP on hit
      break;
    }
    case "ct": {
      s.ctTurns = CT_DURATION; // re-cast = refresh, no stack
      break;
    }
    case "pt": {
      damageBat(s, action.target, roundHalfUp(PT_DMG * dealtMult));
      break;
    }
    case "debug": {
      damageBat(s, action.target, roundHalfUp(DEBUG_DMG * dealtMult));
      const bat = s.boss.bats.find((b) => b.id === action.target)!;
      bat.marked = true; // permanent — this is the memory tool
      s.events.push({ type: "mark", batId: action.target });
      s.dots.push({ batId: action.target, ticksLeft: DOT_TICKS });
      break;
    }
  }
  if (!s.cast.includes(action.type)) {
    s.cast.push(action.type);
    s.events.push({ type: "firstCast", ability: action.type });
  }

  // DoT ticks — flat 4, never CT-multiplied; a tick is not a hit (no reshuffle)
  if (s.status === "active") {
    for (let i = 0; i < preexistingDots; i++) {
      const d = s.dots[i];
      const bat = s.boss.bats.find((b) => b.id === d.batId)!;
      if (bat.alive) {
        bat.hp = Math.max(0, bat.hp - DOT_TICK);
        s.events.push({ type: "dot", batId: d.batId, amount: DOT_TICK });
        if (bat.hp === 0) {
          bat.alive = false;
          s.events.push({ type: "batDown", batId: d.batId });
        }
      }
      d.ticksLeft -= 1;
    }
    s.dots = s.dots.filter(
      (d) => d.ticksLeft > 0 && s.boss.bats.find((b) => b.id === d.batId)!.alive,
    );
  }

  // victory: the real bat down ends the fight immediately — survivors scatter,
  // no volley lands. Rider/forge/unlocks are first-victory only (rematch = lap).
  if (isBossDefeated(s.boss)) {
    s.status = "victory";
    s.events.push({ type: "victory" });
    if (!s.defeatedBosses.includes(ALERT_STORM_ID)) {
      s.defeatedBosses.push(ALERT_STORM_ID);
      s.events.push({ type: "forge", ability: "fan-out" });
      s.hero.maxHp += RIDER_HP;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + RIDER_HP);
      s.hero.maxMp += RIDER_MP;
      s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + RIDER_MP);
      s.events.push({ type: "rider", maxHp: RIDER_HP, maxMp: RIDER_MP });
      s.events.push({ type: "unlock", id: ALERT_STORM_ID });
    }
    return s;
  }

  // scream-end reshuffle: position memory expires when the mouths close
  if (s.status === "active" && screaming) reshuffle(s, "screamEnd");

  // boss volley
  if (s.status === "active") {
    const taken = roundHalfUp(rawVolley(s.boss.bats) * (s.ctTurns > 0 ? CT_TAKEN_MULT : 1));
    s.hero.hp = Math.max(0, s.hero.hp - taken);
    s.events.push({ type: "heroDamage", amount: taken });
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
