// Alert Storm: the swarm's state and mechanics.
//
// The engine.ts import cycle is safe: `BattleState` is type-only, and
// `nextRng` is a hoisted function declaration, bound before either module's
// top-level code runs. Keep it a `function`, not a `const` arrow.
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

/** Defined in ../rushOrder so bootParams.ts can import it without pulling
 * the engine.ts cycle into the landing bundle. */
export { ALERT_STORM_ID } from "../rushOrder";

const VOLLEY_BASE = 7;
const VOLLEY_FLOOR = 4;

/** Spawn the ten-bat swarm; consumes exactly one rng draw (`draw`). */
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

/** Narrows for the type checker. Everything below runs only after engine.ts
 * has branched on `boss.kind`. */
function bats(s: BattleState): Bat[] {
  return (s.boss as AlertStormBoss).bats;
}

/** Seeded Fisher–Yates over LIVING bats' positions; identities travel. */
export function reshuffle(s: BattleState, reason: "fakeHit" | "screamEnd"): void {
  const living = bats(s).filter((b) => b.alive);
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

/** Damage and events only, no reshuffle. `damageBat` reshuffles per hit;
 * `fanOutHit` reshuffles at most once per volley. */
function applyDamage(s: BattleState, batId: number, amount: number): void {
  const bat = bats(s).find((b) => b.id === batId)!;
  bat.hp = Math.max(0, bat.hp - amount);
  s.events.push({ type: "damage", batId, amount });
  if (bat.hp === 0) {
    bat.alive = false;
    s.events.push({ type: "batDown", batId });
  }
}

export function damageBat(s: BattleState, batId: number, amount: number): void {
  applyDamage(s, batId, amount);
  const bat = bats(s).find((b) => b.id === batId)!;
  if (!bat.real) reshuffle(s, "fakeHit");
}

/** Every living bat takes `amount`, then at most one reshuffle, iff any hit
 * landed on a fake (dead or alive after it, as in `damageBat`). One per fake
 * would be noise and burn rng draws. */
export function fanOutHit(s: BattleState, amount: number): void {
  const targets = bats(s).filter((b) => b.alive);
  let hitFake = false;
  for (const bat of targets) {
    applyDamage(s, bat.id, amount);
    if (!bat.real) hitFake = true;
  }
  if (hitFake) reshuffle(s, "fakeHit");
}

/** Volley damage before CT/rounding (both applied by the caller). */
export function rawVolley(bats: Bat[]): number {
  const deadFakes = bats.filter((b) => !b.real && !b.alive).length;
  return Math.max(VOLLEY_FLOOR, VOLLEY_BASE - Math.floor(deadFakes / 3));
}

export function isBossDefeated(boss: AlertStormBoss): boolean {
  return !boss.bats.find((b) => b.real)!.alive;
}
