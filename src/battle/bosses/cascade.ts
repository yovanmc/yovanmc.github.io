// The Cascade — boss 2's node-chain state and pulse mechanics, behind the
// per-boss interface bosses/alertStorm.ts established (M6 plan PR-1b task 2,
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md). This module is
// pure mechanics only: initBattle boot wiring and IMPLEMENTED_BOSSES growth
// are task 3's job, not this commit's — the exported functions below are
// unit-tested directly against synthetic CascadeBoss states, not yet reached
// through battleReduce.
//
// Jolt/storm damage (boss -> hero) routes through engine.ts's `takenDamage`
// (CT-aware); Fan Out (hero -> nodes) routes through `dealtDamage`
// (CT/Conviction-aware), per §Multipliers. `FAN_OUT_DMG` is imported from
// engine.ts (the one shared base every boss's Fan Out uses) rather than
// redefined here, to keep a single source of truth.
//
// Invariant callers must uphold: `boss.carrier` always names a currently
// LIVING node id. `fallForwardIfCarrierDied` is how a caller restores that
// invariant after applying hero-turn damage that might have killed the
// carrier (pulse micro-rule c) — call it before the next
// `resolveCascadeBossTurn`.
import { dealtDamage, FAN_OUT_DMG, takenDamage } from "../engine";

/** Canonical definition lives in ../rushOrder (same pattern as alertStorm.ts's
 * ALERT_STORM_ID re-export — bootParams.ts needs it without pulling the
 * engine.ts<->cascade.ts cycle into the eagerly loaded landing bundle). */
export { CASCADE_ID } from "../rushOrder";

export interface CascadeNode {
  id: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  marked: boolean;
}

export interface CascadeBoss {
  kind: "cascade";
  nodes: CascadeNode[];
  /** Node id currently carrying the pulse. */
  carrier: number;
  /** Boss turns remaining until the loop wraps and a storm fires; `1` means
   * the very next boss turn is the storm. Presentation-only in the sense that
   * nothing reads it to gate behavior — the wrap math in
   * `resolveCascadeBossTurn` is authoritative and this field just mirrors it
   * for the renderer's telegraph (CT's "one turn earlier" glow is a display
   * decision over this field, owned by the scene module — no balance
   * coupling here). */
  stormIn: number;
  /** `[from, to]` node ids of the pulse's last genuine hop (arrival). `null`
   * after a reset (storm wrap or carrier-death fall-forward) — those are
   * placements, not hops. */
  lastHop: [number, number] | null;
}

export const NODE_COUNT = 6;
export const NODE_HP = 25;
export const PULSE_STEP = 3;
const JOLT_BASE = 9;
const STORM_BASE = 25;

export function spawnCascade(): CascadeBoss {
  const nodes: CascadeNode[] = Array.from({ length: NODE_COUNT }, (_, id) => ({
    id,
    hp: NODE_HP,
    maxHp: NODE_HP,
    alive: true,
    marked: false,
  }));
  const boss: CascadeBoss = { kind: "cascade", nodes, carrier: 0, stormIn: 0, lastHop: null };
  return { ...boss, stormIn: turnsUntilStorm(boss) };
}

/** Living node ids in ring order (ascending id). Dead nodes stay as husks in
 * the underlying `nodes` array — they are filtered out here, never removed. */
export function livingNodeIds(boss: CascadeBoss): number[] {
  return boss.nodes.filter((n) => n.alive).map((n) => n.id);
}

/** Pulse micro-rule (b): "head" = the lowest-index LIVING node. `undefined`
 * only once every node is dead (post-victory). */
export function headNode(boss: CascadeBoss): number | undefined {
  return livingNodeIds(boss)[0];
}

/** Boss turns remaining until the pulse wraps past the tail and a storm
 * fires. Pulse speed is 3 living nodes per boss turn, constant — CT never
 * slows it (no `ct` parameter here; CT only ever changes the DAMAGE numbers,
 * via `takenDamage` in `resolveCascadeBossTurn`). */
export function turnsUntilStorm(boss: CascadeBoss): number {
  const ring = livingNodeIds(boss);
  if (ring.length === 0) return 0;
  const idx = ring.indexOf(boss.carrier);
  return Math.ceil((ring.length - idx) / PULSE_STEP);
}

/** The node carrying the pulse takes HALF damage, rounded down, from every
 * source (the charge armors it) — plan-originated carrier shield. Clamps at
 * 0 HP and flips `alive` false there; a no-op against an already-dead node. */
export function damageNode(boss: CascadeBoss, nodeId: number, amount: number): CascadeBoss {
  const applied = nodeId === boss.carrier ? Math.floor(amount / 2) : amount;
  const nodes = boss.nodes.map((n) => {
    if (n.id !== nodeId || !n.alive) return n;
    const hp = Math.max(0, n.hp - applied);
    return { ...n, hp, alive: hp > 0 };
  });
  return { ...boss, nodes };
}

/** Debug's target mark: "a debugged node cannot pass the pulse" (addendum
 * verbatim) — see the absorb branch of `resolveCascadeBossTurn`, which
 * consumes the mark on block. */
export function markNode(boss: CascadeBoss, nodeId: number): CascadeBoss {
  const nodes = boss.nodes.map((n) => (n.id === nodeId ? { ...n, marked: true } : n));
  return { ...boss, nodes };
}

/** Fan Out vs the chain: every LIVING node takes the same dealt amount
 * (CT/Conviction-aware, computed once per cast), with the carrier's own hit
 * still halved by the shield. No reshuffle — unlike Alert Storm's bats, nodes
 * carry no fake/real identity to scramble. */
export function fanOutNodes(boss: CascadeBoss, ct: boolean, conviction: boolean): CascadeBoss {
  const amount = dealtDamage(FAN_OUT_DMG, ct, conviction);
  let next = boss;
  for (const n of boss.nodes) {
    if (n.alive) next = damageNode(next, n.id, amount);
  }
  return next;
}

/** Pulse micro-rule (c): a carrier killed on a HERO turn falls forward to the
 * next living node in ring order — no reset, no storm (`lastHop` is left
 * untouched; this is not a hop, and per rule (e) it is not an arrival
 * either). A no-op while the carrier is still alive. Call this after any
 * hero-turn node damage, before the next `resolveCascadeBossTurn`. */
export function fallForwardIfCarrierDied(boss: CascadeBoss): CascadeBoss {
  const carrierNode = boss.nodes.find((n) => n.id === boss.carrier)!;
  if (carrierNode.alive) return boss;
  const living = livingNodeIds(boss);
  if (living.length === 0) return boss; // the dead carrier was the last node standing
  const carrier = living.find((id) => id > boss.carrier) ?? living[0]; // wrap to head if it was the tail
  return { ...boss, carrier, stormIn: turnsUntilStorm({ ...boss, carrier }) };
}

export type CascadeTurnOutcome = "jolt" | "storm" | "absorbed";

export interface CascadeTurnResult {
  boss: CascadeBoss;
  outcome: CascadeTurnOutcome;
  /** Damage the HERO takes this boss turn (0 when absorbed). Already
   * CT/Conviction-adjusted via `takenDamage` — apply as-is. */
  heroDamage: number;
}

/** Resolves one boss turn: advances the pulse 3 living-node ring-steps from
 * the current carrier.
 *
 * - Wrapping past the tail = loop complete: a STORM fires INSTEAD of the
 *   jolt, and the pulse restarts at head — a reset, never mark-checked
 *   (pulse micro-rule e's second clause).
 * - A non-wrapping advance is a genuine ARRIVAL: if the landing node is
 *   marked, the discharge is ABSORBED (no storm and no jolt), the mark burns
 *   out, and the pulse resets to head; otherwise a normal JOLT fires and the
 *   pulse stays at the new node. */
export function resolveCascadeBossTurn(
  boss: CascadeBoss,
  ct: boolean,
  conviction: boolean,
): CascadeTurnResult {
  const ring = livingNodeIds(boss);
  const idx = ring.indexOf(boss.carrier);
  const newIdx = idx + PULSE_STEP;

  if (newIdx >= ring.length) {
    const next: CascadeBoss = { ...boss, carrier: ring[0], lastHop: null };
    return {
      boss: { ...next, stormIn: turnsUntilStorm(next) },
      outcome: "storm",
      heroDamage: takenDamage(STORM_BASE, ct, conviction),
    };
  }

  const landingId = ring[newIdx];
  const landing = boss.nodes.find((n) => n.id === landingId)!;
  if (landing.marked) {
    const nodes = boss.nodes.map((n) => (n.id === landingId ? { ...n, marked: false } : n));
    const next: CascadeBoss = { ...boss, nodes, carrier: ring[0], lastHop: null };
    return {
      boss: { ...next, stormIn: turnsUntilStorm(next) },
      outcome: "absorbed",
      heroDamage: 0,
    };
  }

  const next: CascadeBoss = { ...boss, carrier: landingId, lastHop: [boss.carrier, landingId] };
  return {
    boss: { ...next, stormIn: turnsUntilStorm(next) },
    outcome: "jolt",
    heroDamage: takenDamage(JOLT_BASE, ct, conviction),
  };
}

/** Victory: all six nodes destroyed. */
export function isCascadeDefeated(boss: CascadeBoss): boolean {
  return boss.nodes.every((n) => !n.alive);
}
