// M5 battle engine — pure, deterministic, turn-discrete reducer.
// Rules source: docs/superpowers/specs/2026-07-25-battle-gameplay-addendum.md
// plus the plan-originated numbers table in 2026-07-28-be1-battle-engine-plan.md.
// No DOM, no Date, no Math.random: all randomness flows from state.rngState.

export interface Bat {
  /** Stable identity 0..9 — HP, realness, and marks travel with it. */
  id: number;
  hp: number;
  maxHp: number;
  real: boolean;
  marked: boolean;
  alive: boolean;
  /** Formation slot 0..9 — reshuffles permute this, never `id`. */
  pos: number;
}

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
  bats: Bat[];
  /** Critical Thinking turns remaining (0 = inactive). */
  ctTurns: number;
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

/** Advance the Park–Miller stream; returns the new state (also the draw). */
function nextRng(state: number): number {
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
  let rng = seedStream(opts.seed, attempt);
  rng = nextRng(rng);
  const realId = rng % 10;
  const bats: Bat[] = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    hp: i === realId ? 60 : 8,
    maxHp: i === realId ? 60 : 8,
    real: i === realId,
    marked: false,
    alive: true,
    pos: i,
  }));
  return {
    seed: opts.seed,
    attempt,
    turn: 1,
    hero: { hp: 100, maxHp: 100, mp: 10, maxMp: 10 },
    bats,
    ctTurns: 0,
    dots: [],
    status: "active",
    events: [],
    rngState: rng,
    cast: [],
    defeatedBosses: opts.defeatedBosses ?? [],
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
const VOLLEY_BASE = 7;
const VOLLEY_FLOOR = 4;
const BOSS_ID = "alert-storm";
const RIDER_HP = 10;
const RIDER_MP = 2;
const CT_DEALT_MULT = 1.5;
const CT_TAKEN_MULT = 0.75;

/** Round half up, applied AFTER multipliers (pinned micro-semantics). */
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

/** True when mouths are open during the hero's targeting this turn. */
export function isScreamTurn(state: BattleState): boolean {
  if (state.turn % 3 === 0) return true;
  // CT stretches a scream into the following turn — never invents one on turn 1.
  return state.ctTurns > 0 && state.turn > 3 && state.turn % 3 === 1;
}

function invalid(state: BattleState, reason: string): BattleState {
  return { ...state, events: [{ type: "invalid", reason }] };
}

/** Seeded Fisher–Yates over LIVING bats' positions; identities travel. */
function reshuffle(
  s: BattleState,
  reason: "fakeHit" | "screamEnd",
): void {
  const living = s.bats.filter((b) => b.alive);
  const positions = living.map((b) => b.pos);
  for (let i = positions.length - 1; i > 0; i--) {
    s.rngState = nextRng(s.rngState);
    const j = s.rngState % (i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  living.forEach((b, k) => {
    b.pos = positions[k];
  });
  s.events.push({ type: "reshuffle", reason });
}

function damageBat(s: BattleState, batId: number, amount: number): void {
  const bat = s.bats.find((b) => b.id === batId)!;
  bat.hp = Math.max(0, bat.hp - amount);
  s.events.push({ type: "damage", batId, amount });
  if (bat.hp === 0) {
    bat.alive = false;
    s.events.push({ type: "batDown", batId });
  }
  if (!bat.real) reshuffle(s, "fakeHit");
}

export function battleReduce(state: BattleState, action: BattleAction): BattleState {
  if (state.status !== "active") return invalid(state, "battle over");

  // validate before cloning
  if (action.type === "attack" || action.type === "pt" || action.type === "debug") {
    const target = state.bats.find((b) => b.id === action.target);
    if (!target || !target.alive) return invalid(state, "invalid target");
  }
  const mpCost = MP_COST[action.type];
  if (state.hero.mp < mpCost) return invalid(state, "not enough MP");

  const s: BattleState = {
    ...state,
    hero: { ...state.hero },
    bats: state.bats.map((b) => ({ ...b })),
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
      const bat = s.bats.find((b) => b.id === action.target)!;
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
      const bat = s.bats.find((b) => b.id === d.batId)!;
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
      (d) => d.ticksLeft > 0 && s.bats.find((b) => b.id === d.batId)!.alive,
    );
  }

  // victory: the real bat down ends the fight immediately — survivors scatter,
  // no volley lands. Rider/forge/unlocks are first-victory only (rematch = lap).
  const real = s.bats.find((b) => b.real)!;
  if (!real.alive) {
    s.status = "victory";
    s.events.push({ type: "victory" });
    if (!s.defeatedBosses.includes(BOSS_ID)) {
      s.defeatedBosses.push(BOSS_ID);
      s.events.push({ type: "forge", ability: "fan-out" });
      s.hero.maxHp += RIDER_HP;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + RIDER_HP);
      s.hero.maxMp += RIDER_MP;
      s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + RIDER_MP);
      s.events.push({ type: "rider", maxHp: RIDER_HP, maxMp: RIDER_MP });
      s.events.push({ type: "unlock", id: BOSS_ID });
    }
    return s;
  }

  // scream-end reshuffle: position memory expires when the mouths close
  if (s.status === "active" && screaming) reshuffle(s, "screamEnd");

  // boss volley
  if (s.status === "active") {
    const deadFakes = s.bats.filter((b) => !b.real && !b.alive).length;
    const volley = Math.max(VOLLEY_FLOOR, VOLLEY_BASE - Math.floor(deadFakes / 3));
    const taken = roundHalfUp(volley * (s.ctTurns > 0 ? CT_TAKEN_MULT : 1));
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
