// The Cascade: node-chain state and pulse mechanics, pure.
//
// Jolt/storm damage to the hero goes through engine.ts's `takenDamage`; Fan
// Out goes through `dealtDamage`. `FAN_OUT_DMG` is shared by every boss.
//
// Invariant callers must uphold: `boss.carrier` always names a LIVING node.
// After hero-turn damage that may have killed the carrier, call
// `fallForwardIfCarrierDied` before the next `resolveCascadeBossTurn`.
import { dealtDamage, FAN_OUT_DMG, takenDamage } from "../engine";

/** Defined in ../rushOrder so bootParams.ts can import it without pulling the
 * engine.ts<->cascade.ts cycle into the landing bundle. */
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
  /** Boss turns until the loop wraps and a storm fires (`1` = next turn).
   * Presentation-only, for the renderer's telegraph: the wrap math in
   * `resolveCascadeBossTurn` is authoritative. */
  stormIn: number;
  /** `[from, to]` of the pulse's last genuine hop. `null` after a reset (storm
   * wrap or carrier fall-forward): those are placements, not hops. */
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

/** Living node ids in ring order (ascending id). Dead nodes stay in `nodes`
 * as husks. */
export function livingNodeIds(boss: CascadeBoss): number[] {
  return boss.nodes.filter((n) => n.alive).map((n) => n.id);
}

/** The lowest-index living node. `undefined` once every node is dead. */
export function headNode(boss: CascadeBoss): number | undefined {
  return livingNodeIds(boss)[0];
}

/** Boss turns until the pulse wraps past the tail. Speed is a constant 3
 * living nodes per turn: CT changes only damage, never speed. */
export function turnsUntilStorm(boss: CascadeBoss): number {
  const ring = livingNodeIds(boss);
  if (ring.length === 0) return 0;
  const idx = ring.indexOf(boss.carrier);
  return Math.ceil((ring.length - idx) / PULSE_STEP);
}

/** Carrier shield: the pulse carrier takes half damage, rounded down, from
 * every source. Clamps at 0 HP and marks the node dead; no-op on a dead node. */
export function damageNode(boss: CascadeBoss, nodeId: number, amount: number): CascadeBoss {
  const applied = nodeId === boss.carrier ? Math.floor(amount / 2) : amount;
  const nodes = boss.nodes.map((n) => {
    if (n.id !== nodeId || !n.alive) return n;
    const hp = Math.max(0, n.hp - applied);
    return { ...n, hp, alive: hp > 0 };
  });
  return { ...boss, nodes };
}

/** Debug's mark: a marked node cannot pass the pulse. The absorb branch of
 * `resolveCascadeBossTurn` consumes it. */
export function markNode(boss: CascadeBoss, nodeId: number): CascadeBoss {
  const nodes = boss.nodes.map((n) => (n.id === nodeId ? { ...n, marked: true } : n));
  return { ...boss, nodes };
}

/** Every living node takes the same dealt amount, the carrier's hit still
 * halved. No reshuffle: nodes have no fake/real identity. */
export function fanOutNodes(boss: CascadeBoss, ct: boolean, conviction: boolean): CascadeBoss {
  const amount = dealtDamage(FAN_OUT_DMG, ct, conviction);
  let next = boss;
  for (const n of boss.nodes) {
    if (n.alive) next = damageNode(next, n.id, amount);
  }
  return next;
}

/** A carrier killed on a hero turn falls forward to the next living node,
 * with no reset, no storm, and `lastHop` untouched. No-op while it lives. */
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
  /** Damage the hero takes this boss turn (0 when absorbed), already
   * CT/Conviction-adjusted. */
  heroDamage: number;
}

/** Advances the pulse 3 living-node steps from the carrier.
 *
 * - Wrapping past the tail completes the loop: a STORM fires instead of the
 *   jolt and the pulse resets to head (a reset is never mark-checked).
 * - Otherwise it is an arrival: a marked landing node ABSORBS the discharge
 *   (no storm, no jolt), the mark burns out and the pulse resets to head;
 *   an unmarked one takes a JOLT and keeps the pulse. */
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
