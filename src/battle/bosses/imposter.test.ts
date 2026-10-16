import { describe, expect, it } from "vitest";
import {
  breakPulse,
  convictionCastable,
  damageImposter,
  erosionStage,
  healImposter,
  livingTargets,
  MAX_HP,
  MIRROR_DEBUG_DOT_TICK,
  MIRROR_DEBUG_DOT_TICKS,
  resolveImposterBossTurn,
  resolveImposterHit,
  ripBackVanish,
  spawnImposter,
  trackSpecial,
} from "./imposter";
import type { ImposterBoss } from "./imposter";

/** Stand-in for `nextRng`: only `% 3` of the draw matters for seeding. */
const identityDraw = (r: number) => r;

function fresh(overrides: Partial<ImposterBoss> = {}): ImposterBoss {
  return { ...spawnImposter(0, identityDraw).boss, ...overrides };
}

describe("spawnImposter", () => {
  it("opens in CLONES at 180/180, both clones already spawned before the first hero turn", () => {
    const { boss } = spawnImposter(1, identityDraw);
    expect(MAX_HP).toBe(180);
    expect(boss.hp).toBe(180);
    expect(boss.maxHp).toBe(180);
    expect(boss.phase).toBe("clones");
    expect(boss.phaseTurnsLeft).toBe(2);
    expect(boss.degenerate).toBe(false);
    expect(boss.forgeFired).toBe(false);
    expect(boss.marked).toBe(false);
    expect(boss.pulseCharged).toBe(false);
    expect(boss.lastSpecial).toBeNull();
    expect(boss.mirrorCtTurns).toBe(0);
    expect([0, 1, 2]).toContain(boss.realIndex);
  });

  it("seeds realIndex from the draw (0/1/2 of the three clone slots)", () => {
    expect(spawnImposter(0, identityDraw).boss.realIndex).toBe(0);
    expect(spawnImposter(1, identityDraw).boss.realIndex).toBe(1);
    expect(spawnImposter(2, identityDraw).boss.realIndex).toBe(2);
    expect(spawnImposter(3, identityDraw).boss.realIndex).toBe(0);
  });

  it("consumes exactly one rng draw, returning the advanced state", () => {
    const { rng } = spawnImposter(5, identityDraw);
    expect(rng).toBe(identityDraw(5));
  });
});

describe("livingTargets — [0,1,2] during clones, [0] otherwise, [] once dead", () => {
  it.each([
    { name: "is [0,1,2] on the fresh (clones) spawn", boss: fresh(), expected: [0, 1, 2] },
    { name: "is [0] in vanish", boss: fresh({ phase: "vanish" }), expected: [0] },
    { name: "is [0] in pulse", boss: fresh({ phase: "pulse" }), expected: [0] },
    { name: "is [0] in mirror", boss: fresh({ phase: "mirror" }), expected: [0] },
    { name: "is [] once hp hits 0, even mid-clones", boss: fresh({ hp: 0 }), expected: [] },
  ])("$name", ({ boss, expected }) => {
    expect(livingTargets(boss)).toEqual(expected);
  });
});

describe("damageImposter — unconditional, phase-agnostic hp reduction (overlay-only)", () => {
  it.each([
    { name: "a DoT anchored before a CLONES phase keeps ticking THROUGH it into the next phase (crossing OUT of clones)", from: "clones", to: "pulse" },
    { name: "a DoT anchored before re-entering CLONES keeps ticking once inside it (crossing INTO clones)", from: "mirror", to: "clones" },
  ] as const)("$name", ({ from, to }) => {
    let boss = fresh({ phase: from });
    boss = damageImposter(boss, 4); // tick before the phase boundary
    expect(boss.hp).toBe(176);
    boss = { ...boss, phase: to }; // simulate the natural phase boundary
    boss = damageImposter(boss, 4); // tick continues unconditionally
    expect(boss.hp).toBe(172);
  });

  it.each([
    { name: "the <=50% crossing hit sets forgeFired immediately (94 -> 52 crosses 90)", hp: 94, damage: 42, forgeFired: false, expectedHp: 52, expectedForge: true },
    { name: "does not fire the forge event before the crossing (100 -> 91 stays above 90)", hp: 100, damage: 9, forgeFired: false, expectedHp: 91, expectedForge: false },
    { name: "fires exactly at the boundary (90 counts as at-or-below 50%)", hp: 91, damage: 1, forgeFired: false, expectedHp: 90, expectedForge: true },
    { name: "never re-fires once already set", hp: 50, damage: 5, forgeFired: true, expectedHp: 45, expectedForge: true },
  ])("$name", ({ hp, damage, forgeFired, expectedHp, expectedForge }) => {
    const after = damageImposter(fresh({ hp, forgeFired }), damage);
    expect(after.hp).toBe(expectedHp);
    expect(after.forgeFired).toBe(expectedForge);
  });
});

describe("healImposter — caps at maxHp", () => {
  it.each([
    { name: "adds amount", hp: 50, amount: 20, expected: 70 },
    { name: "caps at maxHp, never overheals", hp: 170, amount: 50, expected: 180 },
  ])("$name", ({ hp, amount, expected }) => {
    expect(healImposter(fresh({ hp }), amount).hp).toBe(expected);
  });
});

describe("resolveImposterHit — the CLONES overlay gate", () => {
  it("outside clones, any id resolves as the single real entity", () => {
    const { boss, dealt } = resolveImposterHit(fresh({ phase: "vanish", realIndex: 1 }), 0, 22);
    expect(dealt).toBe(22);
    expect(boss.hp).toBe(158);
  });

  it("during clones, hitting the real slot applies full damage", () => {
    const { boss, dealt } = resolveImposterHit(fresh({ realIndex: 2 }), 2, 8);
    expect(dealt).toBe(8);
    expect(boss.hp).toBe(172);
  });

  it("during clones, hitting a non-real slot pops it harmlessly — no damage, boss state otherwise untouched", () => {
    const start = fresh({ realIndex: 2 });
    const { boss, dealt } = resolveImposterHit(start, 0, 8);
    expect(dealt).toBe(0);
    expect(boss).toEqual(start);
  });

  it("Fan Out vs clones: both clones pop and the real takes its hit", () => {
    const start = fresh({ realIndex: 1 });
    let boss = start;
    let totalDealt = 0;
    for (const id of [0, 1, 2]) {
      const result = resolveImposterHit(boss, id, 8);
      boss = result.boss;
      totalDealt += result.dealt;
    }
    expect(totalDealt).toBe(8);
    expect(boss.hp).toBe(172);
  });
});

describe("breakPulse — only inside the charge-complete window; consumes the mark", () => {
  it("flips pulseCharged back false and clears the mark when charged", () => {
    const charging = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true, marked: true });
    const after = breakPulse(charging);
    expect(after.pulseCharged).toBe(false);
    expect(after.marked).toBe(false);
  });

  it.each([
    { name: "is a no-op outside the pulse phase", boss: fresh({ phase: "vanish", marked: true }) },
    {
      name: "is a no-op during pulse before the charge completes (turn 1)",
      boss: fresh({ phase: "pulse", phaseTurnsLeft: 2, pulseCharged: false, marked: true }),
    },
  ])("$name", ({ boss }) => {
    expect(breakPulse(boss)).toEqual(boss);
  });
});

describe("ripBackVanish — forces VANISH to end early; counts as complete", () => {
  it("is a no-op outside the vanish phase", () => {
    const notVanish = fresh({ phase: "clones" });
    expect(ripBackVanish(notVanish)).toEqual(notVanish);
  });

  it("ends vanish immediately regardless of phaseTurnsLeft, advancing to the normal next phase (mirror) when not degenerate", () => {
    const vanishing = fresh({ phase: "vanish", phaseTurnsLeft: 2, degenerate: false, forgeFired: false });
    const after = ripBackVanish(vanishing);
    expect(after.phase).toBe("mirror");
    expect(after.phaseTurnsLeft).toBe(1);
  });

  it("a rip-back with forgeFired already true counts as the completed phase AND degenerates at this exact boundary, landing on CLONES(1) directly (skipping mirror)", () => {
    const vanishing = fresh({ phase: "vanish", phaseTurnsLeft: 1, degenerate: false, forgeFired: true });
    const after = ripBackVanish(vanishing);
    expect(after.degenerate).toBe(true);
    expect(after.phase).toBe("clones");
    expect(after.phaseTurnsLeft).toBe(1); // degenerate CLONES(1), not the normal 2
  });
});

describe("trackSpecial — MIRROR's tracker; attack never updates it", () => {
  it("records a cast special", () => {
    expect(trackSpecial(fresh(), "debug").lastSpecial).toBe("debug");
    expect(trackSpecial(fresh(), "pt").lastSpecial).toBe("pt");
    expect(trackSpecial(fresh(), "fo").lastSpecial).toBe("fo");
    expect(trackSpecial(fresh(), "rb").lastSpecial).toBe("rb");
    expect(trackSpecial(fresh(), "ct").lastSpecial).toBe("ct");
  });

  it("attack is NOT a special and never updates the tracker", () => {
    const marked = fresh({ lastSpecial: "pt" });
    expect(trackSpecial(marked, "attack").lastSpecial).toBe("pt");
  });
});

describe("erosionStage — integer-exact, gap-free at 180 max", () => {
  it.each([
    { name: "stage 0: hp > 120", hp: 180, stage: 0 },
    { name: "stage 0: hp > 120 (121)", hp: 121, stage: 0 },
    { name: "stage 1: hp in (60, 120]", hp: 120, stage: 1 },
    { name: "stage 1: hp in (60, 120] (61)", hp: 61, stage: 1 },
    { name: "stage 2: hp in (0, 60]", hp: 60, stage: 2 },
    { name: "stage 2: hp in (0, 60] (1)", hp: 1, stage: 2 },
    { name: "stage 3: victory (hp <= 0)", hp: 0, stage: 3 },
  ])("$name", ({ hp, stage }) => {
    expect(erosionStage(fresh({ hp }))).toBe(stage);
  });

  it("healing the boss back across a stage line REVERTS the stage", () => {
    const eroded = fresh({ hp: 55 }); // stage 2
    expect(erosionStage(eroded)).toBe(2);
    const healed = healImposter(eroded, 10); // 65, crosses back over 60 into stage 1
    expect(healed.hp).toBe(65);
    expect(erosionStage(healed)).toBe(1); // reverted
  });
});

describe("convictionCastable — integer-exact, no floating point (hp * 4 <= maxHp)", () => {
  it.each([
    { name: "castable at the line (130 max -> hp <= 32)", hp: 32, expected: true },
    { name: "castable below the line (130 max -> hp 0)", hp: 0, expected: true },
    { name: "not castable just above the line", hp: 33, expected: false },
  ])("$name", ({ hp, expected }) => {
    expect(convictionCastable(hp, 130)).toBe(expected);
  });
});

describe("resolveImposterBossTurn", () => {
  it("both CLONES boss turns deal the 14 slash (spawn is not a turn action)", () => {
    const t1 = resolveImposterBossTurn(fresh(), false, false);
    expect(t1.outcome).toBe("slash");
    expect(t1.heroDamage).toBe(14);
    expect(t1.boss.phase).toBe("clones");
    expect(t1.boss.phaseTurnsLeft).toBe(1);

    const t2 = resolveImposterBossTurn(t1.boss, false, false);
    expect(t2.outcome).toBe("slash");
    expect(t2.heroDamage).toBe(14);
    expect(t2.boss.phase).toBe("pulse"); // boundary: clones -> pulse
    expect(t2.boss.phaseTurnsLeft).toBe(2);
  });

  it("slash CT'd = round(14*0.75) = 11", () => {
    expect(resolveImposterBossTurn(fresh(), true, false).heroDamage).toBe(11);
  });

  it("pulse turn 1 charges — no damage, pulseCharged flips true", () => {
    const boss = fresh({ phase: "pulse", phaseTurnsLeft: 2, pulseCharged: false });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.outcome).toBe("pulseCharge");
    expect(result.heroDamage).toBe(0);
    expect(result.boss.pulseCharged).toBe(true);
    expect(result.boss.phase).toBe("pulse");
    expect(result.boss.phaseTurnsLeft).toBe(1);
  });

  it("pulse turn 2, unbroken, fires 26 and advances to vanish", () => {
    const boss = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.outcome).toBe("pulseFire");
    expect(result.heroDamage).toBe(26);
    expect(result.boss.phase).toBe("vanish");
    expect(result.boss.phaseTurnsLeft).toBe(2);
  });

  it("pulse fire CT'd = round(26*0.75) = 20", () => {
    const boss = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true });
    expect(resolveImposterBossTurn(boss, true, false).heroDamage).toBe(20);
  });

  it("a hero Debug between charge start and fire (breakPulse) fizzles the fire to the 14 slash instead", () => {
    const charged = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true, marked: true });
    const broken = breakPulse(charged);
    const result = resolveImposterBossTurn(broken, false, false);
    expect(result.outcome).toBe("pulseFizzle");
    expect(result.heroDamage).toBe(14); // the plain slash, not the 26 fire
    expect(result.boss.phase).toBe("vanish"); // phase still advances normally
    expect(broken.marked).toBe(false); // mark was already consumed by breakPulse
  });

  it("vanish ambush 16, CT'd = round(16*0.75) = 12", () => {
    const vanish = fresh({ phase: "vanish", phaseTurnsLeft: 2 });
    const uncTd = resolveImposterBossTurn(vanish, false, false);
    expect(uncTd.outcome).toBe("ambush");
    expect(uncTd.heroDamage).toBe(16);
    const ctd = resolveImposterBossTurn(vanish, true, false);
    expect(ctd.heroDamage).toBe(12);
  });

  it("full non-degenerate rotation cycles CLONES(2) -> PULSE(2) -> VANISH(2) -> MIRROR(1) -> CLONES(2)", () => {
    let boss = fresh();
    const phases: string[] = [];
    for (let i = 0; i < 7; i++) {
      const result = resolveImposterBossTurn(boss, false, false);
      boss = result.boss;
      phases.push(boss.phase);
    }
    expect(phases).toEqual([
      "clones", // T1: 2 -> 1
      "pulse", // T2: 1 -> 0, boundary -> pulse(2)
      "pulse", // T3: charge turn, 2 -> 1
      "vanish", // T4: fire turn, boundary -> vanish(2)
      "vanish", // T5: 2 -> 1
      "mirror", // T6: 1 -> 0, boundary -> mirror(1)
      "clones", // T7: 1 -> 0, boundary -> clones(2)
    ]);
    expect(boss.phase).toBe("clones");
    expect(boss.phaseTurnsLeft).toBe(2);
  });

  it("degenerate rotation alternates CLONES(1) <-> MIRROR(1) forever, never re-entering pulse/vanish", () => {
    let boss = fresh({ phase: "clones", phaseTurnsLeft: 1, degenerate: true, forgeFired: true });
    const phases: string[] = [];
    for (let i = 0; i < 4; i++) {
      const result = resolveImposterBossTurn(boss, false, false);
      boss = result.boss;
      phases.push(boss.phase);
    }
    expect(phases).toEqual(["mirror", "clones", "mirror", "clones"]);
    expect(boss.phaseTurnsLeft).toBe(1); // clones(1), never the normal 2
  });

  it("a crossing mid-phase completes the CURRENT phase normally — degenerate only flips at the NEXT boundary", () => {
    // Cross the forge threshold via a hero hit landing between two clones turns.
    let boss = fresh({ phase: "clones", phaseTurnsLeft: 2 });
    boss = resolveImposterHit(boss, boss.realIndex!, 100).boss; // 180 -> 80, forge fires
    expect(boss.forgeFired).toBe(true);
    expect(boss.degenerate).toBe(false); // not yet — mid-phase
    // This turn still had 2 phaseTurnsLeft, so the phase continues.
    const stillClones = resolveImposterBossTurn(boss, false, false);
    expect(stillClones.outcome).toBe("slash");
    expect(stillClones.boss.phase).toBe("clones"); // current phase completes, doesn't truncate
    expect(stillClones.boss.degenerate).toBe(false);
    expect(stillClones.boss.phaseTurnsLeft).toBe(1);
    // The boundary: degenerate flips exactly here, and the degenerate mapping
    // sends clones to mirror.
    const boundary = resolveImposterBossTurn(stillClones.boss, false, false);
    expect(boundary.boss.degenerate).toBe(true);
    expect(boundary.boss.phase).toBe("mirror");
    expect(boundary.boss.phaseTurnsLeft).toBe(1);
  });

  it.each([
    { name: "PT arm: half of 28 = 14", lastSpecial: "pt", damage: 14, mirroredDebug: false },
    { name: "FO arm: half of 8 = 4", lastSpecial: "fo", damage: 4, mirroredDebug: false },
    { name: "Debug arm: half of 6 = 3, and flags mirroredDebug for the caller's hero mark + DoT", lastSpecial: "debug", damage: 3, mirroredDebug: true },
    { name: "diagnostic default: null (no special used yet) -> glitch slash 14", lastSpecial: null, damage: 14, mirroredDebug: false },
    {
      name: "diagnostic default: an 'attack' tracker value (unreachable via trackSpecial, constructed directly) also falls back to glitch slash",
      lastSpecial: "attack",
      damage: 14,
      mirroredDebug: false,
    },
    { name: "RC arm: half of 22 = 11, NOT the 14 glitch-slash default", lastSpecial: "rc", damage: 11, mirroredDebug: false },
    { name: 'Conviction arm: glitch slash 14 ("the imposter cannot mirror belief")', lastSpecial: "conv", damage: 14, mirroredDebug: false },
  ] as const)("MIRROR dispatch — $name", ({ lastSpecial, damage, mirroredDebug }) => {
    const result = resolveImposterBossTurn(fresh({ phase: "mirror", lastSpecial }), false, false);
    expect(result.outcome).toBe("mirror");
    expect(result.heroDamage).toBe(damage);
    expect(result.mirroredDebug).toBe(mirroredDebug);
  });

  it("MIRROR dispatch — Debug arm mirrors into a hero DoT of 2 damage for 3 ticks", () => {
    expect(MIRROR_DEBUG_DOT_TICK).toBe(2);
    expect(MIRROR_DEBUG_DOT_TICKS).toBe(3);
  });

  it("MIRROR dispatch — Rollback arm: boss self-heals 15 (capped at maxHp), deals no damage", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "rb", hp: 170 });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.heroDamage).toBe(0);
    expect(result.boss.hp).toBe(180); // 170 + 15 capped at 180, not 185
  });

  it("MIRROR dispatch — CT arm: no damage, grants mirrorCtTurns = 2 without an immediate decrement", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "ct", mirrorCtTurns: 0 });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.heroDamage).toBe(0);
    expect(result.boss.mirrorCtTurns).toBe(2);
  });

  it("mirrorCtTurns boosts the NEXT boss turns' slash/ambush/pulse dealt by 1.25x, never the mirror turn itself", () => {
    const mirrorTurn = fresh({ phase: "mirror", lastSpecial: "ct", mirrorCtTurns: 0 });
    const afterMirror = resolveImposterBossTurn(mirrorTurn, false, false);
    expect(afterMirror.boss.mirrorCtTurns).toBe(2);
    expect(afterMirror.boss.phase).toBe("clones"); // advances normally

    const boosted = resolveImposterBossTurn(afterMirror.boss, false, false);
    expect(boosted.outcome).toBe("slash");
    expect(boosted.heroDamage).toBe(18); // round(14 * 1.25) = round(17.5) = 18
    expect(boosted.boss.mirrorCtTurns).toBe(1); // decremented after use
  });

  it("slash under both mirror-CT and hero CT = round(14*1.25*0.75) = round(13.125) = 13", () => {
    const boosted = fresh({ phase: "clones", mirrorCtTurns: 2 });
    const result = resolveImposterBossTurn(boosted, true, false);
    expect(result.heroDamage).toBe(13);
  });

  it("mirrorCtTurns REFRESHES rather than stacks — a second mirror-CT while 1 turn remains resets to 2, not 3", () => {
    const almostExpired = fresh({ phase: "mirror", lastSpecial: "ct", mirrorCtTurns: 1 });
    const result = resolveImposterBossTurn(almostExpired, false, false);
    expect(result.boss.mirrorCtTurns).toBe(2); // reset to 2, not stacked to 3
  });

  it("mirrorCtTurns decrements on every boss turn it is NOT freshly (re)granted, floored at 0", () => {
    const active = fresh({ phase: "vanish", phaseTurnsLeft: 2, mirrorCtTurns: 1 });
    const t1 = resolveImposterBossTurn(active, false, false);
    expect(t1.boss.mirrorCtTurns).toBe(0);
    const t2 = resolveImposterBossTurn(t1.boss, false, false);
    expect(t2.boss.mirrorCtTurns).toBe(0); // floored, never negative
    expect(t2.heroDamage).toBe(16); // no boost once expired
  });
});
