// Imposter Syndrome's scene module (M6 plan §Scene generalization /
// §Renderer strategy Imposter, docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md,
// PR-3 task 6). Covers the two new optional BossSceneModule seams
// (stampOrigin/E4, arenaFor/E9), the N11-ruled mirrorOf facing fix (incl. a
// mirrored overlay coordinate, not just a cell-count check), the CLONES
// composite canvas, and the defensive banner.
import { describe, expect, it } from "vitest";
import { initBattle } from "../engine";
import { erosionStage, IMPOSTER_ID, spawnImposter, type ImposterBoss } from "../bosses/imposter";
import { imposterBatAnchor, imposterCursorAnchor, imposterScene, mirrorOf } from "./imposter";
import { GLITCH_A, IMP_ATK, IMP_DIE, IMP_IDLE } from "../../generated/bossImposter";
import { COLS, ROWS } from "../../generated/heroBattle";
import { BOSS_AT, erosionStage as erosionStageGrid, varIS } from "../../generated/battlefieldScene";

const identityDraw = (r: number) => r;

function fresh(overrides: Partial<ImposterBoss> = {}): ImposterBoss {
  return { ...spawnImposter(0, identityDraw).boss, ...overrides };
}

describe("mirrorOf - N11 facing fix", () => {
  it("reverses each row (per-cell), leaving grid dimensions unchanged", () => {
    const mirrored = mirrorOf(IMP_IDLE[0]);
    expect(mirrored.length).toBe(ROWS);
    expect(mirrored[0].length).toBe(COLS);
  });

  it("mirrors an OVERLAY coordinate correctly, not just some cell (eyes() hardcodes cols 23/27)", () => {
    // eyes(grid, 0) overlays [10,23,'T'] and [10,27,'T'] onto IMP_IDLE[0] at
    // generation time - a naive off-by-one reverse would misplace them by
    // one column and still pass a cell-count-only check.
    expect(IMP_IDLE[0][10][23]).toBe("T");
    expect(IMP_IDLE[0][10][27]).toBe("T");
    const mirrored = mirrorOf(IMP_IDLE[0]);
    expect(mirrored[10][COLS - 1 - 23]).toBe("T");
    expect(mirrored[10][COLS - 1 - 27]).toBe("T");
  });
});

describe("stampOrigin (E4) - via imposterBatAnchor/imposterCursorAnchor, the shared-origin contract", () => {
  it("is the bare BOSS_AT outside CLONES (single target, id 0)", () => {
    const boss = fresh({ phase: "vanish" });
    expect(imposterBatAnchor(boss, 0)).toEqual([BOSS_AT[0] + 6, BOSS_AT[1] + 24]);
  });

  it("is defensive against a non-imposter boss (falls back to BOSS_AT, never another boss's position)", () => {
    const alertState = initBattle({ seed: 1 });
    expect(imposterBatAnchor(alertState.boss, 0)).toEqual([BOSS_AT[0] + 6, BOSS_AT[1] + 24]);
  });

  it("gives three DISTINCT homes during CLONES, one per slot, shifted so the middle slot matches the non-clones anchor", () => {
    const clones = fresh({ phase: "clones" });
    const nonClones = fresh({ phase: "mirror" });
    const slot0 = imposterBatAnchor(clones, 0);
    const slot1 = imposterBatAnchor(clones, 1);
    const slot2 = imposterBatAnchor(clones, 2);
    // three distinct homes
    expect(new Set([slot0[1], slot1[1], slot2[1]]).size).toBe(3);
    // evenly spaced by the pinned +-20-col gap
    expect(slot1[1] - slot0[1]).toBe(20);
    expect(slot2[1] - slot1[1]).toBe(20);
    // the MIDDLE slot lands exactly where a solo boss would (the
    // shared-origin contract: composeBoss's canvas and this anchor math both
    // key off the SAME shifted stampOrigin, so they can't independently
    // drift apart) - proven here structurally, not just by construction.
    expect(slot1).toEqual(imposterBatAnchor(nonClones, 0));
  });

  it("cursor anchor is a fixed offset from the float anchor, per slot", () => {
    const boss = fresh({ phase: "clones" });
    for (const slot of [0, 1, 2]) {
      const [r, c] = imposterBatAnchor(boss, slot);
      expect(imposterCursorAnchor(boss, slot)).toEqual([r - 5, c - 2]);
    }
  });
});

describe("composeBoss", () => {
  it("is defensive against a non-imposter boss (blank grid, never another boss's art)", () => {
    const alertState = initBattle({ seed: 1 });
    const g = imposterScene.composeBoss(alertState.boss, false, 0, {});
    expect(g.every((row) => row.every((c) => c === null))).toBe(true);
  });

  it("idle (no fx, not clones, not defeated) is the mirrored IMP_IDLE frame for the flutter phase", () => {
    const boss = fresh({ phase: "mirror" });
    expect(imposterScene.composeBoss(boss, false, 0, {})).toEqual(mirrorOf(IMP_IDLE[0]));
    expect(imposterScene.composeBoss(boss, false, 1, {})).toEqual(mirrorOf(IMP_IDLE[1]));
  });

  it("a generic boss-volley windup (fx.ripple) selects the mirrored IMP_ATK reel frame", () => {
    const boss = fresh({ phase: "vanish" });
    expect(imposterScene.composeBoss(boss, false, 0, { ripple: 1 })).toEqual(mirrorOf(IMP_ATK[0][0]));
  });

  it("a defeated boss selects the mirrored IMP_DIE frame via the shared deathFrame mapping (task 6c precedent)", () => {
    const boss = fresh({ phase: "mirror", hp: 0 });
    // deathFrame({}) === 0 (scenes/silentFailure.ts's own mapping)
    expect(imposterScene.composeBoss(boss, false, 0, {})).toEqual(mirrorOf(IMP_DIE[0][0]));
    expect(imposterScene.composeBoss(boss, false, 0, { fall: 10, dither: 3 })).toEqual(mirrorOf(IMP_DIE[6][0]));
  });

  // Slots 0/1/2 sit at local canvas columns 0/20/40 (48-wide frames, a
  // 20-col gap - deliberately overlapping per the plan: "the 60x48 sprites
  // at +-20-col offsets overflow the 60x64 boss zone deliberately", layout
  // explicitly left to the first screenshot gate. Slot 0's leftmost 20
  // columns and slot 2's rightmost 20 columns are the only canvas regions no
  // OTHER slot's frame ever reaches, so they are the only ones a pixel-exact
  // assertion can make regardless of paint order - used below instead of a
  // full 48-col slice (order-dependent everywhere else thanks to the
  // deliberate overlap, worst of all for the sandwiched middle slot).
  const LEFT_EXCLUSIVE = [0, 20] as const; // slot 0's own local cols [0,20)
  const RIGHT_EXCLUSIVE = [68, 88] as const; // slot 2's own local cols [28,48), i.e. canvas [68,88)

  function region(canvas: (string | null)[][], bounds: readonly [number, number]) {
    const [c0, c1] = bounds;
    return canvas.map((row) => row.slice(c0, c1));
  }

  it("CLONES phase composes three silhouettes on one wide canvas, real slot exclusive-edge intact", () => {
    const boss = fresh({ phase: "clones", realIndex: 0 });
    const canvas = imposterScene.composeBoss(boss, false, 0, {});
    expect(canvas.length).toBe(ROWS);
    expect(canvas[0].length).toBe(COLS + 40);

    // slot 0 is REAL here - its exclusive left edge must be the real frame.
    const expectedReal = mirrorOf(IMP_IDLE[0]).map((row) => row.slice(0, 20));
    expect(region(canvas, LEFT_EXCLUSIVE)).toEqual(expectedReal);
    // slot 2 is fake here (CLONE_VARIANTS[2] = GLITCH_A) - its exclusive
    // right edge (its own local cols [28,48)) must be the glitch variant.
    const expectedFake2 = mirrorOf(GLITCH_A).map((row) => row.slice(28, 48));
    expect(region(canvas, RIGHT_EXCLUSIVE)).toEqual(expectedFake2);
  });

  it("CLONES phase honors whichever slot is real (not hardcoded to slot 0)", () => {
    const boss = fresh({ phase: "clones", realIndex: 2 });
    const canvas = imposterScene.composeBoss(boss, false, 1, {});

    // slot 0 is fake here (CLONE_VARIANTS[0] = GLITCH_A).
    const expectedFake0 = mirrorOf(GLITCH_A).map((row) => row.slice(0, 20));
    expect(region(canvas, LEFT_EXCLUSIVE)).toEqual(expectedFake0);
    // slot 2 is REAL here, at flutter phase 1.
    const expectedReal = mirrorOf(IMP_IDLE[1]).map((row) => row.slice(28, 48));
    expect(region(canvas, RIGHT_EXCLUSIVE)).toEqual(expectedReal);
  });

  it("draws nothing extra when realIndex is null (defensive - never produced by spawnImposter in practice)", () => {
    const boss = fresh({ phase: "clones", realIndex: null });
    const canvas = imposterScene.composeBoss(boss, false, 0, {});
    // both exclusive edges stay fake since nothing is real
    const expectedFake0 = mirrorOf(GLITCH_A).map((row) => row.slice(0, 20));
    expect(region(canvas, LEFT_EXCLUSIVE)).toEqual(expectedFake0);
  });
});

describe("arenaFor (E9) - erosion stage derived LIVE from hp (N9/N13)", () => {
  it("stage 0 (hp > 120 of 180) uses varIS, the LIVE variant", () => {
    const boss = fresh({ hp: 180 });
    expect(erosionStage(boss)).toBe(0);
    expect(imposterScene.arenaFor!(boss)).toEqual([varIS(0), varIS(1)]);
  });

  it("stage 1 (60 < hp <= 120)", () => {
    const boss = fresh({ hp: 90 });
    expect(erosionStage(boss)).toBe(1);
    expect(imposterScene.arenaFor!(boss)).toEqual([erosionStageGrid(1, 0), erosionStageGrid(1, 1)]);
  });

  it("stage 2 (0 < hp <= 60)", () => {
    const boss = fresh({ hp: 50 });
    expect(erosionStage(boss)).toBe(2);
    expect(imposterScene.arenaFor!(boss)).toEqual([erosionStageGrid(2, 0), erosionStageGrid(2, 1)]);
  });

  it("stage 3 (hp <= 0, victory)", () => {
    const boss = fresh({ hp: 0 });
    expect(erosionStage(boss)).toBe(3);
    expect(imposterScene.arenaFor!(boss)).toEqual([erosionStageGrid(3, 0), erosionStageGrid(3, 1)]);
  });

  it("REVERTS across a stage line on a heal (N13 signed live/reversible, not a bug)", () => {
    const eroded = fresh({ hp: 50 });
    const healed = fresh({ hp: 150 });
    expect(imposterScene.arenaFor!(eroded)).not.toEqual(imposterScene.arenaFor!(healed));
    expect(imposterScene.arenaFor!(healed)).toEqual([varIS(0), varIS(1)]);
  });

  it("is defensive against a non-imposter boss (falls back to stage 0)", () => {
    const alertState = initBattle({ seed: 1 });
    expect(imposterScene.arenaFor!(alertState.boss)).toEqual([varIS(0), varIS(1)]);
  });
});

describe("banner - defensive, and the mid-fight Conviction forge beat", () => {
  it("is empty against a non-imposter (ALERT-STORM) state (punctuation harness calls this)", () => {
    const alertState = initBattle({ seed: 42 });
    expect(imposterScene.banner({ ...alertState, turn: 3 })).toBe("");
  });

  it("is empty on an imposter state with no forge event this reduce", () => {
    const s = initBattle({ seed: 1, boss: IMPOSTER_ID });
    expect(imposterScene.banner(s)).toBe("");
  });

  it("fires exactly when a conviction forge event landed THIS reduce, while active", () => {
    const s = initBattle({ seed: 1, boss: IMPOSTER_ID });
    const withForge = { ...s, events: [{ type: "forge" as const, ability: "conviction" as const }] };
    expect(imposterScene.banner(withForge)).not.toBe("");
  });

  it("does not fire once the battle is no longer active, even with the event present", () => {
    const s = initBattle({ seed: 1, boss: IMPOSTER_ID });
    const done = {
      ...s,
      status: "victory" as const,
      events: [{ type: "forge" as const, ability: "conviction" as const }],
    };
    expect(imposterScene.banner(done)).toBe("");
  });
});

describe("imposterScene registration shape", () => {
  it("id matches IMPOSTER_ID", () => {
    expect(imposterScene.id).toBe(IMPOSTER_ID);
  });

  it("arena is set (never actually read at runtime since arenaFor always wins)", () => {
    expect(imposterScene.arena).toEqual([varIS(0), varIS(1)]);
  });

  it("plate.footer reads as a TARGET count, single-entity convention", () => {
    expect(imposterScene.plate.footer(1)).toBe("1/1 TARGET");
    expect(imposterScene.plate.footer(0)).toBe("0/1 TARGET");
  });
});

describe("plate.footerFor - phase-aware targetable-slot count", () => {
  const base = initBattle({ seed: 1, boss: IMPOSTER_ID });
  const withBoss = (o: Partial<ImposterBoss>) => ({ ...base, boss: fresh(o) });

  it("is wired as a function on the plate", () => {
    expect(typeof imposterScene.plate.footerFor).toBe("function");
  });

  it("CLONES: three targetable slots, all alive", () => {
    expect(imposterScene.plate.footerFor!(withBoss({ phase: "clones" }))).toBe("3/3 TARGET");
  });

  it("PULSE: one targetable slot, alive", () => {
    expect(imposterScene.plate.footerFor!(withBoss({ phase: "pulse" }))).toBe("1/1 TARGET");
  });

  it("VANISH: one targetable slot, alive", () => {
    expect(imposterScene.plate.footerFor!(withBoss({ phase: "vanish" }))).toBe("1/1 TARGET");
  });

  it("MIRROR: one targetable slot, alive", () => {
    expect(imposterScene.plate.footerFor!(withBoss({ phase: "mirror" }))).toBe("1/1 TARGET");
  });

  it("MIRROR + dead: 0/1, the ordinary single-entity fast-kill display", () => {
    expect(imposterScene.plate.footerFor!(withBoss({ phase: "mirror", hp: 0 }))).toBe("0/1 TARGET");
  });

  // Not a defensive corner: a killing blow never advances the phase (only the
  // boss's own turn does, via tickPhase/advancePhase), and CLONES is the
  // opening phase (spawnImposter). So a fast kill during CLONES is the
  // ordinary outcome, and the plate keeps rendering this string through the
  // IMP_DIE death-animation window - it is player-visible, not a corner case.
  it("CLONES + dead: 0/3, the ordinary fast-kill display during the opening phase (slots still exist, none targetable)", () => {
    expect(imposterScene.plate.footerFor!(withBoss({ phase: "clones", hp: 0 }))).toBe("0/3 TARGET");
  });
});
