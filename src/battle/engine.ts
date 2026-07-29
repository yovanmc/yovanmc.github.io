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
// Re-exported for every existing import site (`from "./engine"`) — canonical
// definitions live in ./rushOrder so bootParams.ts can import them without
// pulling this module's engine<->alertStorm cycle into the eagerly loaded
// landing bundle (measured regression + fix: see rushOrder.ts).
export { IMPLEMENTED_BOSSES, RUSH_ORDER };

/** Discriminated on `.kind`. M6 PR-1b task 3 added Cascade; PR-2 task 4 adds
 * Silent Failure; PR-3 task 4 adds Imposter (BattleScene.tsx's 6 matching
 * sites stay compile-only stubs, task 6 per the plan's E1 "task 4/6" split). */
export type BossState = AlertStormBoss | CascadeBoss | SilentFailureBoss | ImposterBoss;

/** M6 PR-2 task 1 (D1): exhaustive-dispatch guard. Every per-boss branch
 * point in this file and in BattleScene.tsx narrows through every real
 * BossState kind and falls through to this only if a new boss kind was added
 * to the union without updating that branch — `x: never` then fails to
 * compile at the call site, which is the whole point (a silent two-arm
 * `if/else` would type-check fine and mis-route a new boss instead). */
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
  // `wasPop` (optional, Imposter-only): a CLONES-phase hit against a
  // non-real slot — the pop is the whole effect (no damage, no mark, no
  // DoT); derived at the call site from boss state, never inferred from
  // `amount === 0` (a real hit could coincidentally be exactly that, and
  // the plan's own carried-forward note flags the inference as unsafe).
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
  /** Conviction's persist-once-active flag (M6 §Multipliers). PR-3 task 4 is
   * the first real caster (`conv`); every earlier PR only ever reads it as
   * false. */
  conviction: boolean;
  /** Debug DoTs: batId → ticks remaining. `tick` (PR-3 task 4) is STAMPED at
   * push time from the conviction flag then live (4, or 8 if conviction was
   * active at cast) — this is what makes "already-running DoTs keep their
   * tick value" implementable: the tick loop applies the stamped value, not
   * a recomputed one, so a DoT started before Conviction activates keeps
   * ticking 4 even after. */
  dots: { batId: number; ticksLeft: number; tick: number }[];
  /** E6 (PR-3 task 4): a mark on the HERO from the Imposter's mirrored
   * Debug — DoT anchor + cosmetic only, no ability keys off it (F7). */
  heroMarked: boolean;
  /** E6: DoT(s) anchored on the HERO (mirrored Debug only source in the
   * game). Fixed tick (`MIRROR_DEBUG_DOT_TICK`), never CT/conviction-scaled
   * (DoTs are never CT-multiplied, plan §Multipliers) — no `tick` field
   * needed here, unlike the boss-side `dots` above. */
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
  } else if (requestedBoss === SILENT_FAILURE_ID) {
    boss = spawnSilentFailure(); // no rng draw — the boss starts embodied, deterministic
    rng = seeded;
  } else if (requestedBoss === IMPOSTER_ID) {
    // N2: opens already in CLONES, realIndex seeded (one rng draw, same
    // pattern as spawnAlertStorm's own rng use).
    ({ boss, rng } = spawnImposter(seeded, nextRng));
  } else {
    // G1 anti-crash fallback (D1, pass-2 J2): dispatches on a `string`, so
    // never-narrowing is impossible here; this trailing else stays even after
    // every real boss id is added, and it is what engine.test.ts's
    // "not-a-real-boss" case asserts. A new boss id is added as an `else if`
    // ahead of it, never by removing it.
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
    heroMarked: false,
    heroDots: [],
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
const ROLLBACK_HEAL = 30;
// Root Cause (N1, Boss 4 table): 22 base MP-gated above pt/fo/rb, below
// Conviction; +50% vs a marked target -> 33. Both numbers are the GENERAL
// kit-ability constants — the mark-bonus and vanish-ignoring/rip-back
// mechanics are pinned specifically for Imposter (the only boss with a
// signed "vs marked"/vanish interaction); against any other boss kind RC
// falls back to the plain flat-22 hit (scope decision, flagged in the
// task report — no other boss's signed table gives RC a mark bonus).
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

/** Boss-defeat → ability unlock map, gated to shipped modules. Root Cause
 * lands on silent-failure HERE, M6 PR-3 task 4 (G1 pairing: the reducer's
 * `rc` case arm lands in the same commit, never a kit entry without one —
 * PR-2 emitted the SF forge event but granted no `rc` entry, same as
 * PR-1b's Cascade forge with no `rb` entry until PR-2 shipped it). */
const KIT_UNLOCKS: Partial<Record<string, AbilityId>> = {
  [ALERT_STORM_ID]: "fo",
  [CASCADE_ID]: "rb",
  [SILENT_FAILURE_ID]: "rc",
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
  // N10 path (b): Conviction is kit-derived in ANY fight once Imposter is
  // defeated — deliberately NOT a KIT_UNLOCKS entry (N10: "KIT_UNLOCKS gains
  // NO conviction entry"), so it can't be expressed as a per-boss unlock map
  // lookup like fo/rb/rc. N10 path (a) — the mid-fight forge unlock, before
  // Imposter is actually defeated — is a different channel entirely: this
  // function only sees `defeatedBosses`, so that path is gated separately at
  // the battleReduce call site off the boss's own `forgeFired` flag.
  // Live as of M6 PR-3 task 5 (IMPOSTER_ID joined IMPLEMENTED_BOSSES this
  // task) — both arms of this branch are now real and tested: an
  // imposter-defeated input grants "conv", any other input does not. Do not
  // delete the IMPLEMENTED_BOSSES intersection to "simplify" this — that
  // intersection is the G1 guard this line exists for (a boss beaten ahead
  // of its own PR must never grant a kit entry with no ability behind it).
  if (IMPLEMENTED_BOSSES.includes(IMPOSTER_ID) && defeatedBosses.includes(IMPOSTER_ID)) {
    kit.push("conv");
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
    // 0/1/2 during CLONES, else just [0] (or [] once dead) — the E8 overlay
    // ids, never per-slot HP; targetability (vanish) is a separate gate
    // (isBossTargetable), this only answers "does this id exist right now".
    return imposterLivingTargets(boss).includes(id) ? { alive: true } : undefined;
    /* v8 ignore next */
  }
  return assertNever(boss);
}

/** D2: is the current boss target valid to act against right now? Alert Storm
 * and Cascade have no vanish mechanic (always targetable); Silent Failure
 * answers this itself via its own `isTargetable` (embodied only) — the
 * targetability question is answered by the boss module, never a `kind`
 * check written inline at a gate call site. */
function isBossTargetable(boss: BossState): boolean {
  if (boss.kind === SILENT_FAILURE_ID) return isTargetable(boss);
  if (boss.kind === CASCADE_ID) return true;
  if (boss.kind === ALERT_STORM_ID) return true;
  if (boss.kind === IMPOSTER_ID) {
    // Untargetable only during VANISH (N-table); CLONES/PULSE/MIRROR are all
    // targetable (attack/pt/debug legal). Root Cause bypasses this gate
    // entirely at the call site ("reveals/ignores stealth", like attack's
    // own D2 exemption, but RC lands a real hit instead of whiffing).
    return boss.phase !== "vanish";
    /* v8 ignore next */
  }
  return assertNever(boss);
}

/** Single-target hit (attack/pt/debug's own damage). Alert Storm routes
 * through `damageBat` (reshuffle-aware, mutates `s` directly). Cascade routes
 * through the pure `damageNode` (carrier-shield-aware) and reports the actual
 * HP lost — not the pre-clamp/pre-shield amount — via a before/after diff, so
 * a killing blow against an already-low node never over-reports. Silent
 * Failure routes through `damageSilentFailure`, forced to 0 while vanished
 * (D2's whiff rule — `pt`/`debug` never reach here vanished, the pre-validate
 * gate blocks them; only `attack` is exempted and lands here to whiff).
 * Returns the amount actually applied, so callers (attack's own +1 MP gain)
 * can gate on whether damage actually landed, generically. */
/** `ignoreStealth` (default false — every existing caller keeps byte-identical
 * behavior): bypasses the boss's own untargetable-while-hidden gate and lands
 * the full amount anyway. Root Cause is the one caller that passes `true`
 * ("reveals/ignores stealth", N-table) — attack's whiff rule and pt/debug's
 * upstream invalid-target rejection are both untouched, so this flag can
 * never leak into them. */
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
    // Diff-review fix: Root Cause reaching here against a VANISHED boss must
    // land its full hit, not whiff — "targeting-while-hidden stays Root
    // Cause's job" (Boss 3 table) is exactly what PR-3 delivers. Every other
    // caller (attack) still passes `ignoreStealth=false` and keeps whiffing.
    const applied = (ignoreStealth || isTargetable(s.boss)) ? amount : 0;
    const before = s.boss.hp;
    s.boss = damageSilentFailure(s.boss, applied);
    const dealt = before - s.boss.hp;
    s.events.push({ type: "damage", batId: targetId, amount: dealt });
    if (s.boss.hp === 0) s.events.push({ type: "batDown", batId: targetId });
    return dealt;
  }
  if (s.boss.kind === IMPOSTER_ID) {
    // D2 whiff (attack-only path here, same shape as SF's `applied` line —
    // pt/debug never reach here untargetable, the pre-validate gate blocks
    // them). `wasPop` is derived from boss state BEFORE the hit resolves,
    // never inferred from `dealt === 0` (carried-forward note: a real hit
    // can never coincidentally read as a pop this way, but the plan is
    // explicit that the call site must derive it, not assume it). rc never
    // reaches this arm for Imposter (its own case has a bespoke bypass that
    // ignores the CLONES illusion entirely), but `ignoreStealth` is honored
    // generically here anyway, matching the SF arm's shape.
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

/** Debug's target mark. Cascade's `markNode` is what the pulse-absorb check
 * (resolveCascadeBossTurn) reads; Alert Storm keeps its own permanent
 * `bat.marked` flag (the memory tool); Silent Failure's mark is permanent for
 * the fight (verbatim intent) via `markSilentFailure`. */
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

/** Is `targetId` currently marked? Root Cause's +50% row (N-table: "vs marked
 * +50% -> 33") describes the ABILITY, not an Imposter-only interaction — the
 * mark exists on all four boss kinds (Cascade's per-node `marked`, Alert
 * Storm's per-bat `marked`, Silent Failure's and Imposter's single boss-wide
 * `marked`), so this is a generic accessor alongside cloneBoss/findTarget/
 * isBossTargetable/dealSingleTarget/markTarget, never a kind check inlined at
 * the rc call site (diff-review fix — the marked bonus was Imposter-only in
 * the shipped 972a0f0 commit, a real defect against the abilities.ts row's
 * promised "33 vs marked" for every other boss). */
function isTargetMarked(boss: BossState, targetId: number): boolean {
  if (boss.kind === CASCADE_ID) return !!boss.nodes.find((n) => n.id === targetId)?.marked;
  if (boss.kind === ALERT_STORM_ID) return !!boss.bats.find((b) => b.id === targetId)?.marked;
  if (boss.kind === SILENT_FAILURE_ID) return boss.marked;
  if (boss.kind === IMPOSTER_ID) {
    return boss.marked; // whole-boss flag — targetId (a clone slot) is irrelevant to it
    /* v8 ignore next */
  }
  return assertNever(boss);
}

export function battleReduce(state: BattleState, action: BattleAction): BattleState {
  if (state.status !== "active") return invalid(state, "battle over");

  const kit = deriveKit(state.defeatedBosses);
  // N10 path (a): the mid-fight Conviction forge — castable the instant the
  // Imposter's ≤50% crossing fires, well before Imposter is in
  // `defeatedBosses` (so `deriveKit`, which only ever sees path (b), can't
  // see it). Read directly off the boss's own `forgeFired` flag.
  const convForgeUnlocked = state.boss.kind === IMPOSTER_ID && state.boss.forgeFired;
  if (!kit.includes(action.type) && !(action.type === "conv" && convForgeUnlocked)) {
    return invalid(state, "not in kit");
  }

  // validate before cloning
  if (action.type === "attack" || action.type === "pt" || action.type === "debug" || action.type === "rc") {
    const target = findTarget(state.boss, action.target);
    if (!target || !target.alive) return invalid(state, "invalid target");
    // D2: pt/debug against a vanished boss are invalid; attack is EXEMPTED
    // from this extension (pass-2 J8) — it reaches dealSingleTarget and
    // resolves as a whiff instead, per the signed table. Root Cause is ALSO
    // exempted (N-table: "reveals/ignores stealth") but, unlike attack,
    // lands a real hit rather than whiffing — its own case arm handles that.
    if (action.type !== "attack" && action.type !== "rc" && !isBossTargetable(state.boss)) {
      return invalid(state, "target is not there");
    }
  }
  // fo has no target to pre-validate (untargeted) but D2 still gates it while
  // vanished — checked here, before the MP deduction below, not inside the
  // fan-out helper's SF arm (which would run after MP is already spent).
  if (action.type === "fo" && !isBossTargetable(state.boss)) {
    return invalid(state, "target is not there");
  }
  // Conviction's activation gate (N10): both unlock paths still require
  // hp*4 <= maxHp at the moment of casting, checked here so a "not in kit"
  // rejection above always takes precedence over a gate rejection.
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
  // Scream is Alert Storm's own mechanic — Cascade has no mouths to close, so
  // it never reshuffles at "scream end" (the check below gates on boss.kind).
  const screaming = s.boss.kind === ALERT_STORM_ID && isScreamTurn(s);
  const preexistingDots = s.dots.length; // a dot cast this turn ticks from NEXT turn
  // N5: capture the crossing BEFORE this turn's hit/DoT resolve, so the
  // mid-fight "forge: conviction" event (below) fires exactly once, on the
  // turn the boss's own forgeFired flips false -> true.
  const forgeFiredBefore = s.boss.kind === IMPOSTER_ID && s.boss.forgeFired;
  s.hero.mp -= MP_COST[action.type];

  switch (action.type) {
    case "attack": {
      // Conviction-aware from PR-3 on (was the conviction-blind local
      // `dealtMult` — replaced repo-wide by this same call in this task).
      const dealt = dealSingleTarget(s, action.target, dealtDamage(ATTACK_DMG, s.ctTurns > 0, s.conviction));
      // +1 MP on hit — gated GENERICALLY on damage actually landing (D2),
      // never a kind check: "on hit" is what the ability text already
      // promised, so a Silent Failure vanished whiff (0 dealt) naturally
      // grants nothing, with no boss-specific code here.
      if (dealt > 0) s.hero.mp = Math.min(s.hero.maxMp, s.hero.mp + 1);
      break;
    }
    case "ct": {
      s.ctTurns = CT_DURATION; // re-cast = refresh, no stack
      break;
    }
    case "rb": {
      // Heal is conviction-doubled (§Multipliers: "Rollback heal 60") — CT
      // never factors in (this isn't a damage roll, so CT's percentage has
      // nothing to replace or stack with; conviction alone doubles it).
      const healAmount = s.conviction ? ROLLBACK_HEAL * 2 : ROLLBACK_HEAL;
      s.hero.hp = Math.min(s.hero.maxHp, s.hero.hp + healAmount);
      // Real cleanse (E6) — inert before PR-3 (nothing to clear), now clears
      // whatever hero-side mark/DoT the Imposter's mirrored Debug left.
      s.heroMarked = false;
      s.heroDots = [];
      break;
    }
    case "pt": {
      dealSingleTarget(s, action.target, dealtDamage(PT_DMG, s.ctTurns > 0, s.conviction));
      break;
    }
    case "debug": {
      // A CLONES-phase pop (Imposter only) applies NOTHING beyond the spent
      // turn/MP (N6) — no mark, no DoT push. Derived from boss state before
      // the hit, same rule as dealSingleTarget's own `wasPop` (never from
      // the returned damage amount).
      const wasPop = s.boss.kind === IMPOSTER_ID && s.boss.phase === "clones" && action.target !== s.boss.realIndex;
      dealSingleTarget(s, action.target, dealtDamage(DEBUG_DMG, s.ctTurns > 0, s.conviction));
      if (!wasPop) {
        markTarget(s, action.target); // permanent — this is the memory tool
        s.dots.push({ batId: action.target, ticksLeft: DOT_TICKS, tick: s.conviction ? DOT_TICK * 2 : DOT_TICK });
      }
      // N4: Debugging the boss during an unfired PULSE charge breaks it —
      // the mark is consumed as the cost (mark-semantics row); phase
      // exclusivity means this can only ever be true outside CLONES, so no
      // `wasPop` interaction is possible here.
      if (s.boss.kind === IMPOSTER_ID && s.boss.phase === "pulse" && s.boss.pulseCharged) {
        s.boss = breakPulse(s.boss);
      }
      break;
    }
    case "rc": {
      if (s.boss.kind === IMPOSTER_ID) {
        // Ignores the CLONES illusion entirely (N-table: "hits real clone")
        // — bypasses resolveImposterHit's pop logic and always resolves for
        // real, regardless of which slot the player targeted.
        const wasVanish = s.boss.phase === "vanish";
        const base = isTargetMarked(s.boss, action.target) ? ROOT_CAUSE_MARKED_DMG : ROOT_CAUSE_DMG;
        const amount = dealtDamage(base, s.ctTurns > 0, s.conviction);
        const realId = s.boss.realIndex ?? action.target;
        const before = s.boss.hp;
        s.boss = damageImposter(s.boss, amount);
        const dealt = before - s.boss.hp;
        s.events.push({ type: "damage", batId: realId, amount: dealt });
        if (isImposterDefeated(s.boss)) s.events.push({ type: "batDown", batId: realId });
        // "rips it back": VANISH ends THIS hero turn instead of waiting out
        // its boss-turn countdown (N5: an early end still counts as a
        // completed phase).
        if (wasVanish) s.boss = ripBackVanish(s.boss);
      } else {
        // Diff-review fixes (two real defects in the shipped 972a0f0):
        // (1) the +50%-vs-marked bonus is the ABILITY's own rule (N-table),
        // not Imposter-only — every boss's Debug-mark state feeds the
        // generic isTargetMarked accessor. (2) "reveals/ignores stealth"
        // (Boss 3 table: "targeting-while-hidden stays Root Cause's job")
        // means rc must land its full hit on a vanished Silent Failure, not
        // whiff — `ignoreStealth=true` bypasses dealSingleTarget's own
        // targetable gate for this one caller only.
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
      } else if (s.boss.kind === ALERT_STORM_ID) {
        fanOutHit(s, dealtDamage(FAN_OUT_DMG, s.ctTurns > 0, s.conviction));
      } else if (s.boss.kind === SILENT_FAILURE_ID) {
        // Single-entity degenerate case: "hit every living target" is just
        // one target. Reached only while embodied (the pre-validate gate
        // above blocks fo while vanished), so a plain full-amount hit is
        // correct — no reshuffle (nothing to scramble) and no shield.
        const before = s.boss.hp;
        s.boss = damageSilentFailure(s.boss, dealtDamage(FAN_OUT_DMG, s.ctTurns > 0, s.conviction));
        const dealt = before - s.boss.hp;
        s.events.push({ type: "damage", batId: SF_TARGET_ID, amount: dealt });
        if (s.boss.hp === 0) s.events.push({ type: "batDown", batId: SF_TARGET_ID });
      } else if (s.boss.kind === IMPOSTER_ID) {
        // Signed as DECIDED, not accidental (pass-2 G8): FO hits all three —
        // both clone slots pop (rendering-only, no HP of their own) and the
        // real slot takes the amount. Only the real slot ever carries HP, so
        // one damageImposter call covers it; the non-real slots get their
        // own zero-amount, wasPop-flagged event so a task-6 renderer can
        // still show both pops.
        const targets = imposterLivingTargets(s.boss);
        // Outside CLONES, livingTargets is always exactly [0] while alive
        // (fo can't reach a dead boss — the reducer's `status !== "active"`
        // guard blocks any action once the fight has already ended), so the
        // single-target id is the constant 0, no `targets[0]` lookup needed.
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
  // MIRROR's tracker (Imposter only): every special the hero casts updates
  // `lastSpecial` — trackSpecial's own no-op guard excludes "attack" (it is
  // not a special, and never should update the tracker).
  if (s.boss.kind === IMPOSTER_ID) {
    s.boss = trackSpecial(s.boss, action.type);
  }
  if (!s.cast.includes(action.type)) {
    s.cast.push(action.type);
    s.events.push({ type: "firstCast", ability: action.type });
  }

  // DoT ticks — flat per the stamped `tick` value (4, or 8 if conviction was
  // active at cast — never CT-multiplied, never RE-derived from the CURRENT
  // conviction flag, which is what makes "already-running DoTs keep their
  // tick value" hold). A tick is not a hit (no reshuffle). Cascade nodes
  // route through `damageNode` so the carrier shield applies "from every
  // source" (plan §Boss 2 table) even to ticks.
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
            // Signed DoT-kill ruling: the boss dies on the tick and
            // re-embodies for the death reel — victory fires below like any
            // other lethal source, but the scene must show the body frame,
            // never empty-armor, so flag it here (the only place that knows
            // a TICK, not a direct hit, was the killing blow).
            if (s.boss.phase === "vanished") {
              s.boss = { ...s.boss, forceBodyForDeath: true };
            }
          }
        }
      } else if (s.boss.kind === IMPOSTER_ID) {
        // E8: DoT anchoring is phase-agnostic — a dot anchored before or
        // during CLONES keeps ticking through/after it, same as SF's
        // `hp > 0` shape (never clone-slot/batId identity).
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

  // N5, mid-fight: the Conviction forge fires the instant the boss's own
  // forgeFired flag flips false -> true, from EITHER this turn's hit or the
  // DoT tick above — independently of `defeatedBosses` (Imposter isn't
  // defeated; this is the OTHER unlock path, N10 (a)).
  if (s.boss.kind === IMPOSTER_ID && s.boss.forgeFired && !forgeFiredBefore) {
    s.events.push({ type: "forge", ability: "conviction" });
  }

  // victory: the boss going down ends the fight immediately — no boss turn
  // lands. Rider/forge/unlocks are first-victory only (rematch = lap).
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
    // `undefined` for Imposter (N14/Victory row): the rush order ends here,
    // so there is no follow-on ability left to forge — a forge event with
    // no ability behind it would repeat the exact G1 mistake ("never a kit
    // entry without an arm") one level up.
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
    } else if (s.boss.kind === ALERT_STORM_ID) {
      heroDamage = roundHalfUp(rawVolley(s.boss.bats) * (s.ctTurns > 0 ? CT_TAKEN_MULT : 1));
    } else if (s.boss.kind === SILENT_FAILURE_ID) {
      const result = resolveSilentFailureBossTurn(s.boss, s.ctTurns > 0, s.conviction);
      s.boss = result.boss;
      heroDamage = result.heroDamage;
    } else if (s.boss.kind === IMPOSTER_ID) {
      // E6: hero-side DoT ticks IN the boss phase — existing ticks resolve
      // BEFORE this turn's own boss action, so a DoT the mirror pushes this
      // same turn (below) starts ticking next boss turn, never this one
      // (same "cast this turn ticks from next turn" rule as the boss-side
      // loop above). Flat MIRROR_DEBUG_DOT_TICK, never CT/conviction-scaled
      // (DoTs are never CT-multiplied, §Multipliers).
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
