// HP, mark and defeat primitives that the single-entity bosses (Silent
// Failure and the Imposter) share, run once per boss. Phase rules and each
// boss's own extras stay in silentFailure.test.ts and imposter.test.ts.
import { describe, expect, it } from "vitest";
import { damageSilentFailure, isSilentFailureDefeated, markSilentFailure, spawnSilentFailure } from "./silentFailure";
import { damageImposter, isImposterDefeated, markImposter, spawnImposter } from "./imposter";

interface SingleEntityBoss {
  hp: number;
  maxHp: number;
  marked: boolean;
}

interface Primitives<B extends SingleEntityBoss> {
  name: string;
  spawn: () => B;
  damage: (boss: B, amount: number) => B;
  mark: (boss: B) => B;
  isDefeated: (boss: B) => boolean;
}

function primitivesSuite<B extends SingleEntityBoss>(p: Primitives<B>): void {
  describe(p.name, () => {
    describe("damage", () => {
      it("subtracts amount from hp", () => {
        const boss = p.spawn();
        expect(p.damage(boss, 40).hp).toBe(boss.maxHp - 40);
      });

      it("clamps at 0 rather than going negative", () => {
        expect(p.damage(p.spawn(), 999).hp).toBe(0);
      });

      it("is a no-op against an already-dead boss", () => {
        const dead: B = { ...p.spawn(), hp: 0 };
        const after = p.damage(dead, 40);
        expect(after.hp).toBe(0);
        expect(after).toEqual(dead);
      });
    });

    describe("mark", () => {
      it("sets marked true", () => {
        expect(p.mark(p.spawn()).marked).toBe(true);
      });

      it("re-marking an already-marked boss is a no-op (still true)", () => {
        expect(p.mark(p.mark(p.spawn())).marked).toBe(true);
      });
    });

    describe("isDefeated", () => {
      it("false while hp > 0", () => {
        expect(p.isDefeated(p.spawn())).toBe(false);
      });

      it("true once hp hits 0", () => {
        expect(p.isDefeated({ ...p.spawn(), hp: 0 })).toBe(true);
      });
    });
  });
}

primitivesSuite({
  name: "silent-failure",
  spawn: spawnSilentFailure,
  damage: damageSilentFailure,
  mark: markSilentFailure,
  isDefeated: isSilentFailureDefeated,
});

/** Stand-in for `nextRng`: only `% 3` of the draw matters for seeding. */
const identityDraw = (r: number) => r;

primitivesSuite({
  name: "imposter-syndrome",
  spawn: () => spawnImposter(0, identityDraw).boss,
  damage: damageImposter,
  mark: markImposter,
  isDefeated: isImposterDefeated,
});
