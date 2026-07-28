// Alert Storm — boss 1's swarm state and mechanics, extracted from engine.ts
// behind the per-boss interface the M6 plan anticipates for Cascade, Silent
// Failure, and Imposter Syndrome (docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md,
// PR-1a task 2). Pure refactor: no behavior changed, only relocated.
//
// `BattleState` is imported type-only, so this module has no runtime
// dependency on engine.ts's module-evaluation order; `nextRng` is imported as
// a value (safe under the resulting cycle because it's a hoisted `function`
// declaration in engine.ts, not a `const` arrow — hoisted functions are bound
// before either module's top-level code runs).
import type { BattleState } from "../engine";
import { nextRng } from "../engine";

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

export interface AlertStormBoss {
  kind: "alert-storm";
  bats: Bat[];
}

export const ALERT_STORM_ID = "alert-storm";

const VOLLEY_BASE = 7;
const VOLLEY_FLOOR = 4;

/** Spawn the ten-bat swarm; consumes exactly one rng draw (`draw`), mirroring
 * the draw that used to happen inline in `initBattle`. */
export function spawnAlertStorm(
  rng: number,
  draw: (r: number) => number,
): { boss: AlertStormBoss; rng: number } {
  const advanced = draw(rng);
  const realId = advanced % 10;
  const bats: Bat[] = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    hp: i === realId ? 60 : 8,
    maxHp: i === realId ? 60 : 8,
    real: i === realId,
    marked: false,
    alive: true,
    pos: i,
  }));
  return { boss: { kind: "alert-storm", bats }, rng: advanced };
}

/** True when mouths are open during the hero's targeting this turn. */
export function isScreamTurn(state: BattleState): boolean {
  if (state.turn % 3 === 0) return true;
  // CT stretches a scream into the following turn — never invents one on turn 1.
  return state.ctTurns > 0 && state.turn > 3 && state.turn % 3 === 1;
}

/** Seeded Fisher–Yates over LIVING bats' positions; identities travel. */
export function reshuffle(s: BattleState, reason: "fakeHit" | "screamEnd"): void {
  const living = s.boss.bats.filter((b) => b.alive);
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

export function damageBat(s: BattleState, batId: number, amount: number): void {
  const bat = s.boss.bats.find((b) => b.id === batId)!;
  bat.hp = Math.max(0, bat.hp - amount);
  s.events.push({ type: "damage", batId, amount });
  if (bat.hp === 0) {
    bat.alive = false;
    s.events.push({ type: "batDown", batId });
  }
  if (!bat.real) reshuffle(s, "fakeHit");
}

/** Volley damage before CT/rounding (both stay core — applied by the caller). */
export function rawVolley(bats: Bat[]): number {
  const deadFakes = bats.filter((b) => !b.real && !b.alive).length;
  return Math.max(VOLLEY_FLOOR, VOLLEY_BASE - Math.floor(deadFakes / 3));
}

export function isBossDefeated(boss: AlertStormBoss): boolean {
  return !boss.bats.find((b) => b.real)!.alive;
}
