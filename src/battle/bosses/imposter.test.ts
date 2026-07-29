import { describe, expect, it } from "vitest";
import {
  breakPulse,
  convictionCastable,
  damageImposter,
  erosionStage,
  healImposter,
  isImposterDefeated,
  livingTargets,
  markImposter,
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

/** Deterministic stand-in for engine.ts's Park-Miller `nextRng` — draw(r) = r
 * itself works fine for seeding tests since only `% 3` of the result matters. */
const identityDraw = (r: number) => r;

function fresh(overrides: Partial<ImposterBoss> = {}): ImposterBoss {
  return { ...spawnImposter(0, identityDraw).boss, ...overrides };
}

describe("spawnImposter", () => {
  it("opens in CLONES at 180/180, both clones already spawned before the first hero turn (N2)", () => {
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
  it("is [0,1,2] on the fresh (clones) spawn", () => {
    expect(livingTargets(fresh())).toEqual([0, 1, 2]);
  });

  it("is [0] outside clones", () => {
    expect(livingTargets(fresh({ phase: "vanish" }))).toEqual([0]);
    expect(livingTargets(fresh({ phase: "pulse" }))).toEqual([0]);
    expect(livingTargets(fresh({ phase: "mirror" }))).toEqual([0]);
  });

  it("is [] once hp hits 0, even mid-clones", () => {
    expect(livingTargets(fresh({ hp: 0 }))).toEqual([]);
  });
});

describe("damageImposter — unconditional, phase-agnostic hp reduction (E8 overlay-only pin)", () => {
  it("subtracts amount from hp", () => {
    expect(damageImposter(fresh(), 40).hp).toBe(140);
  });

  it("clamps at 0 rather than going negative", () => {
    expect(damageImposter(fresh(), 999).hp).toBe(0);
  });

  it("is a no-op against an already-dead boss", () => {
    const dead = fresh({ hp: 0 });
    const after = damageImposter(dead, 40);
    expect(after).toEqual(dead);
  });

  it("a DoT anchored before a CLONES phase keeps ticking THROUGH it into the next phase (crossing OUT of clones)", () => {
    let boss = fresh({ phase: "clones" });
    boss = damageImposter(boss, 4); // tick while in clones
    expect(boss.hp).toBe(176);
    boss = { ...boss, phase: "pulse" }; // simulate the natural phase boundary
    boss = damageImposter(boss, 4); // tick continues after leaving clones
    expect(boss.hp).toBe(172);
  });

  it("a DoT anchored before re-entering CLONES keeps ticking once inside it (crossing INTO clones)", () => {
    let boss = fresh({ phase: "mirror" });
    boss = damageImposter(boss, 4); // tick while NOT in clones
    expect(boss.hp).toBe(176);
    boss = { ...boss, phase: "clones" }; // re-enter clones
    boss = damageImposter(boss, 4); // tick continues inside clones, unconditionally
    expect(boss.hp).toBe(172);
  });

  it("N5: the <=50% crossing hit sets forgeFired immediately (94 -> 52 crosses 90)", () => {
    const before = fresh({ hp: 94 });
    const after = damageImposter(before, 42);
    expect(after.hp).toBe(52);
    expect(after.forgeFired).toBe(true);
  });

  it("does not fire the forge event before the crossing (91 -> 91-turn stays above)", () => {
    const boss = damageImposter(fresh({ hp: 100 }), 9); // 100 -> 91, still > 90
    expect(boss.forgeFired).toBe(false);
  });

  it("fires exactly at the boundary (90 counts as at-or-below 50%)", () => {
    const boss = damageImposter(fresh({ hp: 91 }), 1); // 91 -> 90
    expect(boss.forgeFired).toBe(true);
  });

  it("never re-fires once already set", () => {
    const already = fresh({ hp: 50, forgeFired: true });
    const after = damageImposter(already, 5);
    expect(after.forgeFired).toBe(true); // still true, no error re-deriving it
  });
});

describe("healImposter — caps at maxHp (N13)", () => {
  it("adds amount", () => {
    expect(healImposter(fresh({ hp: 50 }), 20).hp).toBe(70);
  });

  it("caps at maxHp, never overheals", () => {
    expect(healImposter(fresh({ hp: 170 }), 50).hp).toBe(180);
  });
});

describe("resolveImposterHit — the CLONES overlay gate (E8)", () => {
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

  it("Fan Out vs clones: both clones pop and the real takes its hit (signed table)", () => {
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

describe("markImposter — persists through everything except a pulse-break", () => {
  it("sets marked true", () => {
    expect(markImposter(fresh()).marked).toBe(true);
  });

  it("re-marking an already-marked boss is a no-op (still true)", () => {
    expect(markImposter(markImposter(fresh())).marked).toBe(true);
  });
});

describe("breakPulse (N4) — only inside the charge-complete window; consumes the mark", () => {
  it("flips pulseCharged back false and clears the mark when charged", () => {
    const charging = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true, marked: true });
    const after = breakPulse(charging);
    expect(after.pulseCharged).toBe(false);
    expect(after.marked).toBe(false);
  });

  it("is a no-op outside the pulse phase", () => {
    const notPulse = fresh({ phase: "vanish", marked: true });
    expect(breakPulse(notPulse)).toEqual(notPulse);
  });

  it("is a no-op during pulse before the charge completes (turn 1)", () => {
    const charging = fresh({ phase: "pulse", phaseTurnsLeft: 2, pulseCharged: false, marked: true });
    expect(breakPulse(charging)).toEqual(charging);
  });
});

describe("ripBackVanish (N5) — forces VANISH to end early; counts as complete", () => {
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

  it("N5: a rip-back with forgeFired already true counts as the completed phase AND degenerates at this exact boundary, landing on CLONES(1) directly (skipping mirror)", () => {
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

describe("isImposterDefeated", () => {
  it("false while hp > 0", () => {
    expect(isImposterDefeated(fresh())).toBe(false);
  });

  it("true once hp hits 0", () => {
    expect(isImposterDefeated(fresh({ hp: 0 }))).toBe(true);
  });
});

describe("erosionStage (N9) — integer-exact, gap-free at 180 max", () => {
  it("stage 0: hp > 120", () => {
    expect(erosionStage(fresh({ hp: 180 }))).toBe(0);
    expect(erosionStage(fresh({ hp: 121 }))).toBe(0);
  });

  it("stage 1: hp in (60, 120]", () => {
    expect(erosionStage(fresh({ hp: 120 }))).toBe(1);
    expect(erosionStage(fresh({ hp: 61 }))).toBe(1);
  });

  it("stage 2: hp in (0, 60]", () => {
    expect(erosionStage(fresh({ hp: 60 }))).toBe(2);
    expect(erosionStage(fresh({ hp: 1 }))).toBe(2);
  });

  it("stage 3: victory (hp <= 0)", () => {
    expect(erosionStage(fresh({ hp: 0 }))).toBe(3);
  });

  it("N13 SIGNED LIVE/REVERSIBLE: healing the boss back across a stage line REVERTS the stage (not a bug)", () => {
    const eroded = fresh({ hp: 55 }); // stage 2
    expect(erosionStage(eroded)).toBe(2);
    const healed = healImposter(eroded, 10); // 65, crosses back over 60 into stage 1
    expect(healed.hp).toBe(65);
    expect(erosionStage(healed)).toBe(1); // reverted, correct per N13
  });
});

describe("convictionCastable — integer-exact, no floating point (hp * 4 <= maxHp)", () => {
  it("castable at or below the line (130 max -> hp <= 32)", () => {
    expect(convictionCastable(32, 130)).toBe(true);
    expect(convictionCastable(0, 130)).toBe(true);
  });

  it("not castable just above the line", () => {
    expect(convictionCastable(33, 130)).toBe(false);
  });
});

describe("resolveImposterBossTurn — rotation script (N3/N4/N5/N7/N8)", () => {
  it("N3: both CLONES boss turns deal the 14 slash (spawn is not a turn action)", () => {
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

  it("N7: slash CT'd = round(14*0.75) = 11", () => {
    expect(resolveImposterBossTurn(fresh(), true, false).heroDamage).toBe(11);
  });

  it("N4: pulse turn 1 charges — no damage, pulseCharged flips true", () => {
    const boss = fresh({ phase: "pulse", phaseTurnsLeft: 2, pulseCharged: false });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.outcome).toBe("pulseCharge");
    expect(result.heroDamage).toBe(0);
    expect(result.boss.pulseCharged).toBe(true);
    expect(result.boss.phase).toBe("pulse");
    expect(result.boss.phaseTurnsLeft).toBe(1);
  });

  it("N4: pulse turn 2, unbroken, fires 26 and advances to vanish", () => {
    const boss = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.outcome).toBe("pulseFire");
    expect(result.heroDamage).toBe(26);
    expect(result.boss.phase).toBe("vanish");
    expect(result.boss.phaseTurnsLeft).toBe(2);
  });

  it("N7: pulse fire CT'd = round(26*0.75) = 20", () => {
    const boss = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true });
    expect(resolveImposterBossTurn(boss, true, false).heroDamage).toBe(20);
  });

  it("N4: a hero Debug between charge start and fire (breakPulse) fizzles the fire to the 14 slash instead", () => {
    const charged = fresh({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true, marked: true });
    const broken = breakPulse(charged);
    const result = resolveImposterBossTurn(broken, false, false);
    expect(result.outcome).toBe("pulseFizzle");
    expect(result.heroDamage).toBe(14); // the plain slash, not the 26 fire
    expect(result.boss.phase).toBe("vanish"); // phase still advances normally
    expect(broken.marked).toBe(false); // mark was already consumed by breakPulse
  });

  it("N7: vanish ambush 16, CT'd = round(16*0.75) = 12", () => {
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

  it("N5: a crossing mid-phase completes the CURRENT phase normally — degenerate only flips at the NEXT boundary", () => {
    // Cross the forge threshold via a hero hit landing between two clones turns.
    let boss = fresh({ phase: "clones", phaseTurnsLeft: 2 });
    boss = resolveImposterHit(boss, boss.realIndex!, 100).boss; // 180 -> 80, forge fires
    expect(boss.forgeFired).toBe(true);
    expect(boss.degenerate).toBe(false); // not yet — mid-phase
    // The turn that just crossed still had 2 phaseTurnsLeft; simulate the
    // boss's own turn continuing normally (still non-degenerate this turn).
    const stillClones = resolveImposterBossTurn(boss, false, false);
    expect(stillClones.outcome).toBe("slash");
    expect(stillClones.boss.phase).toBe("clones"); // current phase completes, doesn't truncate
    expect(stillClones.boss.degenerate).toBe(false);
    expect(stillClones.boss.phaseTurnsLeft).toBe(1);
    // NOW the boundary is reached (phaseTurnsLeft hits 0) — degenerate flips
    // exactly here, and the NEW (post-flip) degenerate mapping decides the
    // next phase: leaving clones while degenerate goes to mirror.
    const boundary = resolveImposterBossTurn(stillClones.boss, false, false);
    expect(boundary.boss.degenerate).toBe(true);
    expect(boundary.boss.phase).toBe("mirror");
    expect(boundary.boss.phaseTurnsLeft).toBe(1);
  });

  it("MIRROR dispatch — PT arm: half of 28 = 14", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "pt" });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.outcome).toBe("mirror");
    expect(result.heroDamage).toBe(14);
    expect(result.mirroredDebug).toBe(false);
  });

  it("MIRROR dispatch — FO arm: half of 8 = 4", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "fo" });
    expect(resolveImposterBossTurn(boss, false, false).heroDamage).toBe(4);
  });

  it("MIRROR dispatch — Debug arm: half of 6 = 3, and flags mirroredDebug for the caller's hero mark + DoT", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "debug" });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.heroDamage).toBe(3);
    expect(result.mirroredDebug).toBe(true);
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

  it("MIRROR dispatch — diagnostic default: null (no special used yet) -> glitch slash 14", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: null });
    expect(resolveImposterBossTurn(boss, false, false).heroDamage).toBe(14);
  });

  it("MIRROR dispatch — diagnostic default: an 'attack' tracker value (unreachable via trackSpecial, constructed directly) also falls back to glitch slash", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "attack" });
    expect(resolveImposterBossTurn(boss, false, false).heroDamage).toBe(14);
  });

  it("MIRROR dispatch — RC arm: half of 22 = 11, NOT the 14 glitch-slash default (M6 PR-3 task 4, carried forward from task 3)", () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "rc" });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.outcome).toBe("mirror");
    expect(result.heroDamage).toBe(11);
    expect(result.heroDamage).not.toBe(14);
    expect(result.mirroredDebug).toBe(false);
  });

  it('MIRROR dispatch — Conviction arm: glitch slash 14 ("the imposter cannot mirror belief")', () => {
    const boss = fresh({ phase: "mirror", lastSpecial: "conv" });
    const result = resolveImposterBossTurn(boss, false, false);
    expect(result.heroDamage).toBe(14);
    expect(result.mirroredDebug).toBe(false);
  });

  it("N8: mirrorCtTurns boosts the NEXT boss turns' slash/ambush/pulse dealt by 1.25x, never the mirror turn itself", () => {
    const mirrorTurn = fresh({ phase: "mirror", lastSpecial: "ct", mirrorCtTurns: 0 });
    const afterMirror = resolveImposterBossTurn(mirrorTurn, false, false);
    expect(afterMirror.boss.mirrorCtTurns).toBe(2);
    expect(afterMirror.boss.phase).toBe("clones"); // advances normally

    const boosted = resolveImposterBossTurn(afterMirror.boss, false, false);
    expect(boosted.outcome).toBe("slash");
    expect(boosted.heroDamage).toBe(18); // round(14 * 1.25) = round(17.5) = 18
    expect(boosted.boss.mirrorCtTurns).toBe(1); // decremented after use
  });

  it("N8 worked example: slash under both mirror-CT and hero CT = round(14*1.25*0.75) = round(13.125) = 13", () => {
    const boosted = fresh({ phase: "clones", mirrorCtTurns: 2 });
    const result = resolveImposterBossTurn(boosted, true, false);
    expect(result.heroDamage).toBe(13);
  });

  it("N8: mirrorCtTurns REFRESHES rather than stacks — a second mirror-CT while 1 turn remains resets to 2, not 3", () => {
    const almostExpired = fresh({ phase: "mirror", lastSpecial: "ct", mirrorCtTurns: 1 });
    const result = resolveImposterBossTurn(almostExpired, false, false);
    expect(result.boss.mirrorCtTurns).toBe(2); // reset to 2, not stacked to 3
  });

  it("N8: mirrorCtTurns decrements on every boss turn it is NOT freshly (re)granted, floored at 0", () => {
    const active = fresh({ phase: "vanish", phaseTurnsLeft: 2, mirrorCtTurns: 1 });
    const t1 = resolveImposterBossTurn(active, false, false);
    expect(t1.boss.mirrorCtTurns).toBe(0);
    const t2 = resolveImposterBossTurn(t1.boss, false, false);
    expect(t2.boss.mirrorCtTurns).toBe(0); // floored, never negative
    expect(t2.heroDamage).toBe(16); // no boost once expired
  });
});
