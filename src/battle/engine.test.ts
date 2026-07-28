import { describe, expect, it } from "vitest";
import {
  battleReduce,
  dealtDamage,
  deriveKit,
  IMPLEMENTED_BOSSES,
  initBattle,
  isScreamTurn,
  RUSH_ORDER,
  takenDamage,
} from "./engine";
import type { BattleState } from "./engine";

/** Attack the real bat — never triggers a fake-hit reshuffle. */
function attackReal(s: BattleState): BattleState {
  const real = s.boss.bats.find((b) => b.real)!;
  return battleReduce(s, { type: "attack", target: real.id });
}

describe("initBattle", () => {
  it("starts the hero at 100/100 HP and 10/10 MP on turn 1, battle active", () => {
    const s = initBattle({ seed: 42 });
    expect(s.hero).toEqual({ hp: 100, maxHp: 100, mp: 10, maxMp: 10 });
    expect(s.turn).toBe(1);
    expect(s.status).toBe("active");
    expect(s.attempt).toBe(1);
  });

  it("spawns ten bats: one real at 60 HP, nine fakes at 8 HP, all alive and unmarked", () => {
    const s = initBattle({ seed: 42 });
    expect(s.boss.bats).toHaveLength(10);
    const real = s.boss.bats.filter((b) => b.real);
    const fakes = s.boss.bats.filter((b) => !b.real);
    expect(real).toHaveLength(1);
    expect(real[0].hp).toBe(60);
    expect(real[0].maxHp).toBe(60);
    expect(fakes).toHaveLength(9);
    for (const f of fakes) expect(f.hp).toBe(8);
    for (const b of s.boss.bats) {
      expect(b.alive).toBe(true);
      expect(b.marked).toBe(false);
    }
  });

  it("gives every bat a distinct id 0..9 and a distinct formation position 0..9", () => {
    const s = initBattle({ seed: 42 });
    expect(new Set(s.boss.bats.map((b) => b.id)).size).toBe(10);
    expect(new Set(s.boss.bats.map((b) => b.pos)).size).toBe(10);
    for (const b of s.boss.bats) {
      expect(b.id).toBeGreaterThanOrEqual(0);
      expect(b.id).toBeLessThan(10);
      expect(b.pos).toBeGreaterThanOrEqual(0);
      expect(b.pos).toBeLessThan(10);
    }
  });

  it("is deterministic: same seed and attempt produce identical states", () => {
    expect(initBattle({ seed: 7 })).toEqual(initBattle({ seed: 7 }));
  });

  it("survives the degenerate seed that folds to a zero rng stream", () => {
    // 1640531525 + 1×0x9e3779b9 ≡ 0 (mod 2147483647) — the stream must not stall
    const s = initBattle({ seed: 1640531525 });
    expect(s.boss.bats.filter((b) => b.real)).toHaveLength(1);
    expect(s.rngState).not.toBe(0);
  });

  it("re-rolls the real bat across attempts for at least one seed (retry must not be a solved puzzle)", () => {
    const realId = (seed: number, attempt: number) =>
      initBattle({ seed, attempt }).boss.bats.find((b) => b.real)!.id;
    const anyDiffers = [1, 2, 3, 4, 5].some(
      (seed) => realId(seed, 1) !== realId(seed, 2),
    );
    expect(anyDiffers).toBe(true);
  });
});

describe("scream schedule", () => {
  it("mouths are stitched on turns 1 and 2, open on turn 3, repeating with period 3", () => {
    // Advance turns without damage (CT expires before its extension can matter
    // on the checked turns 4/5; turn-6 scream is period-3, not CT).
    const s = initBattle({ seed: 42 });
    const at = (turn: number) => ({ ...s, turn });
    expect(isScreamTurn(at(1))).toBe(false);
    expect(isScreamTurn(at(2))).toBe(false);
    expect(isScreamTurn(at(3))).toBe(true);
    expect(isScreamTurn(at(4))).toBe(false);
    expect(isScreamTurn(at(5))).toBe(false);
    expect(isScreamTurn(at(6))).toBe(true);
  });

  it("Critical Thinking stretches the scream into the following turn (turn 4 screams while CT is active)", () => {
    const s = initBattle({ seed: 42 });
    expect(isScreamTurn({ ...s, turn: 4, ctTurns: 2 })).toBe(true);
    expect(isScreamTurn({ ...s, turn: 4, ctTurns: 0 })).toBe(false);
  });

  it("CT never invents a scream on turn 1 (extension only follows a real scream turn)", () => {
    const s = initBattle({ seed: 42 });
    expect(isScreamTurn({ ...s, turn: 1, ctTurns: 3 })).toBe(false);
  });
});

describe("attack", () => {
  it("deals 12 to the target and the swarm answers with a 7-damage volley; the turn advances", () => {
    const s0 = initBattle({ seed: 42 });
    const real = s0.boss.bats.find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "attack", target: real.id });
    expect(s1.boss.bats.find((b) => b.id === real.id)!.hp).toBe(48);
    expect(s1.hero.hp).toBe(93);
    expect(s1.turn).toBe(2);
    expect(s1.status).toBe("active");
  });

  it("MP stays capped at max: +1 on hit and +1 regen cannot exceed 10", () => {
    const s1 = attackReal(initBattle({ seed: 42 }));
    expect(s1.hero.mp).toBe(10);
  });

  it("killing a fake (8 HP < 12) downs it and reshuffles living positions; identities travel", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = s0.boss.bats.find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "attack", target: fake.id });
    const hit = s1.boss.bats.find((b) => b.id === fake.id)!;
    expect(hit.alive).toBe(false);
    expect(hit.hp).toBe(0);
    expect(s1.events.some((e) => e.type === "batDown" && e.batId === fake.id)).toBe(true);
    expect(s1.events.some((e) => e.type === "reshuffle" && e.reason === "fakeHit")).toBe(true);
    // permutation: living bats occupy the same SET of positions, each keeps its identity/hp
    const livingBefore = s0.boss.bats.filter((b) => b.id !== fake.id);
    const livingAfter = s1.boss.bats.filter((b) => b.alive);
    expect(new Set(livingAfter.map((b) => b.pos))).toEqual(
      new Set(livingBefore.map((b) => b.pos)),
    );
    for (const b of livingAfter) {
      const before = s0.boss.bats.find((x) => x.id === b.id)!;
      expect(b.real).toBe(before.real);
      expect(b.hp).toBe(before.hp);
    }
  });

  it("hitting the real bat does not reshuffle", () => {
    const s1 = attackReal(initBattle({ seed: 42 }));
    expect(s1.events.some((e) => e.type === "reshuffle")).toBe(false);
    expect(s1.boss.bats.map((b) => b.pos)).toEqual(initBattle({ seed: 42 }).boss.bats.map((b) => b.pos));
  });

  it("positions reshuffle at the end of every scream turn (position memory expires)", () => {
    let s = initBattle({ seed: 42 });
    s = attackReal(s); // turn 1 → 2
    s = attackReal(s); // turn 2 → 3
    const s3 = attackReal(s); // hero acts ON scream turn 3 → scream-end shuffle
    expect(s3.events.some((e) => e.type === "reshuffle" && e.reason === "screamEnd")).toBe(true);
  });

  it("targeting a dead bat is invalid: an invalid event, no damage, no turn advance", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = s0.boss.bats.find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "attack", target: fake.id });
    const s2 = battleReduce(s1, { type: "attack", target: fake.id });
    expect(s2.events.some((e) => e.type === "invalid")).toBe(true);
    expect(s2.turn).toBe(s1.turn);
    expect(s2.hero).toEqual(s1.hero);
  });

  it("is deterministic: identical state + action produce identical results", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = s0.boss.bats.find((b) => !b.real)!;
    expect(battleReduce(s0, { type: "attack", target: fake.id })).toEqual(
      battleReduce(s0, { type: "attack", target: fake.id }),
    );
  });

  it("does not mutate the input state", () => {
    const s0 = initBattle({ seed: 42 });
    const snapshot = JSON.parse(JSON.stringify(s0));
    attackReal(s0);
    expect(s0).toEqual(snapshot);
  });
});

describe("critical thinking", () => {
  it("costs 2 MP and reduces the volley taken by 25% on the cast turn (7 → 5, round half up)", () => {
    const s1 = battleReduce(initBattle({ seed: 42 }), { type: "ct" });
    expect(s1.hero.hp).toBe(95); // roundHalfUp(7 * 0.75) = 5
    expect(s1.hero.mp).toBe(9); // 10 − 2 + 1 regen
    expect(s1.turn).toBe(2);
  });

  it("boosts damage dealt by 50% while active (attack 12 → 18)", () => {
    const s1 = battleReduce(initBattle({ seed: 42 }), { type: "ct" });
    const real = s1.boss.bats.find((b) => b.real)!;
    const s2 = battleReduce(s1, { type: "attack", target: real.id });
    expect(s2.boss.bats.find((b) => b.id === real.id)!.hp).toBe(42); // 60 − 18
  });

  it("lasts 3 turns: attacks on turns 2 and 3 are buffed, turn 4 is not", () => {
    let s = battleReduce(initBattle({ seed: 42 }), { type: "ct" }); // turn 1
    const real = () => s.boss.bats.find((b) => b.real)!;
    let hpBefore = real().hp;
    s = battleReduce(s, { type: "attack", target: real().id }); // turn 2
    expect(hpBefore - real().hp).toBe(18);
    hpBefore = real().hp;
    s = battleReduce(s, { type: "attack", target: real().id }); // turn 3
    expect(hpBefore - real().hp).toBe(18);
    hpBefore = real().hp;
    s = battleReduce(s, { type: "attack", target: real().id }); // turn 4, expired
    expect(hpBefore - real().hp).toBe(12);
  });

  it("re-casting while active refreshes the timer (no stack): CT@1, CT@2 keeps turn 4 buffed", () => {
    let s = battleReduce(initBattle({ seed: 42 }), { type: "ct" }); // turn 1
    s = battleReduce(s, { type: "ct" }); // turn 2, refresh
    const real = () => s.boss.bats.find((b) => b.real)!;
    let hpBefore = real().hp;
    s = battleReduce(s, { type: "attack", target: real().id }); // turn 3
    expect(hpBefore - real().hp).toBe(18);
    hpBefore = real().hp;
    s = battleReduce(s, { type: "attack", target: real().id }); // turn 4, still active
    expect(hpBefore - real().hp).toBe(18);
  });

  it("is invalid without 2 MP: no cast, no turn advance", () => {
    const s0 = initBattle({ seed: 42 });
    const broke = { ...s0, hero: { ...s0.hero, mp: 1 } };
    const s1 = battleReduce(broke, { type: "ct" });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(true);
    expect(s1.turn).toBe(1);
    expect(s1.ctTurns).toBe(0);
  });
});

describe("power through", () => {
  it("costs 3 MP and deals 28 (60 → 32 on the real bat)", () => {
    const s0 = initBattle({ seed: 42 });
    const real = s0.boss.bats.find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "pt", target: real.id });
    expect(s1.boss.bats.find((b) => b.id === real.id)!.hp).toBe(32);
    expect(s1.hero.mp).toBe(8); // 10 − 3 + 1 regen; no on-hit MP (Attack only)
  });

  it("deals 42 under Critical Thinking (28 × 1.5)", () => {
    const s1 = battleReduce(initBattle({ seed: 42 }), { type: "ct" });
    const real = s1.boss.bats.find((b) => b.real)!;
    const s2 = battleReduce(s1, { type: "pt", target: real.id });
    expect(real.hp - s2.boss.bats.find((b) => b.id === real.id)!.hp).toBe(42);
  });

  it("is invalid without 3 MP", () => {
    const s0 = initBattle({ seed: 42 });
    const real = s0.boss.bats.find((b) => b.real)!;
    const broke = { ...s0, hero: { ...s0.hero, mp: 2 } };
    const s1 = battleReduce(broke, { type: "pt", target: real.id });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(true);
    expect(s1.turn).toBe(1);
  });
});

describe("debug", () => {
  it("costs 2 MP, deals 6 on cast, and marks the target permanently", () => {
    const s0 = initBattle({ seed: 42 });
    const real = s0.boss.bats.find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "debug", target: real.id });
    const hit = s1.boss.bats.find((b) => b.id === real.id)!;
    expect(hit.hp).toBe(54);
    expect(hit.marked).toBe(true);
    expect(s1.hero.mp).toBe(9); // 10 − 2 + 1 regen
    expect(s1.events.some((e) => e.type === "mark" && e.batId === real.id)).toBe(true);
  });

  it("ticks 4 damage on each of the next 3 turn advances, then stops — and CT never multiplies ticks", () => {
    const s0 = initBattle({ seed: 42 });
    const realId = s0.boss.bats.find((b) => b.real)!.id;
    const hp = (s: BattleState) => s.boss.bats.find((b) => b.id === realId)!.hp;
    let s = battleReduce(s0, { type: "debug", target: realId }); // turn 1: 60−6 = 54
    expect(hp(s)).toBe(54);
    s = battleReduce(s, { type: "ct" }); // turn 2: tick 4 (CT active, still 4)
    expect(hp(s)).toBe(50);
    s = battleReduce(s, { type: "ct" }); // turn 3: tick 4
    expect(hp(s)).toBe(46);
    s = battleReduce(s, { type: "ct" }); // turn 4: tick 4, DoT exhausted
    expect(hp(s)).toBe(42);
    s = battleReduce(s, { type: "ct" }); // turn 5: no tick
    expect(hp(s)).toBe(42);
  });

  it("a mark placed on a fake survives the fake-hit reshuffle it triggers", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = s0.boss.bats.find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "debug", target: fake.id });
    expect(s1.events.some((e) => e.type === "reshuffle" && e.reason === "fakeHit")).toBe(true);
    const marked = s1.boss.bats.find((b) => b.id === fake.id)!;
    expect(marked.marked).toBe(true);
    expect(marked.hp).toBe(2); // 8 − 6, still alive
  });

  it("a DoT tick can down a fake (batDown) but a tick is not a hit — no reshuffle from the tick", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = s0.boss.bats.find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "debug", target: fake.id }); // fake at 2 HP
    const s2 = battleReduce(s1, { type: "ct" }); // turn 2: tick 4 downs it
    const downed = s2.boss.bats.find((b) => b.id === fake.id)!;
    expect(downed.alive).toBe(false);
    expect(s2.events.some((e) => e.type === "batDown" && e.batId === fake.id)).toBe(true);
    expect(s2.events.some((e) => e.type === "reshuffle" && e.reason === "fakeHit")).toBe(false);
  });

  it("emits a firstCast event only the first time an ability is cast", () => {
    const s1 = attackReal(initBattle({ seed: 42 }));
    expect(s1.events.some((e) => e.type === "firstCast" && e.ability === "attack")).toBe(true);
    const s2 = attackReal(s1);
    expect(s2.events.some((e) => e.type === "firstCast")).toBe(false);
  });

  it("two debugs run independent DoTs and both marks persist", () => {
    const s0 = initBattle({ seed: 42 });
    const [realId, otherId] = [
      s0.boss.bats.find((b) => b.real)!.id,
      s0.boss.bats.filter((b) => b.real === false)[0].id,
    ];
    let s = battleReduce(s0, { type: "debug", target: realId }); // turn 1
    s = battleReduce(s, { type: "debug", target: otherId }); // turn 2 (real ticks 4 → 50)
    const real = s.boss.bats.find((b) => b.id === realId)!;
    expect(real.hp).toBe(50); // 60 − 6 − 4
    expect(real.marked).toBe(true);
    expect(s.boss.bats.find((b) => b.id === otherId)!.marked).toBe(true);
  });
});

describe("victory", () => {
  /** PT, PT, attack kills the real bat on turn 3 (60 → 32 → 4 → 0). */
  function winBySeed(seed: number, defeatedBosses: string[] = []) {
    const s0 = initBattle({ seed, defeatedBosses });
    const realId = s0.boss.bats.find((b) => b.real)!.id;
    let s = battleReduce(s0, { type: "pt", target: realId });
    s = battleReduce(s, { type: "pt", target: realId });
    return battleReduce(s, { type: "attack", target: realId });
  }

  it("killing the real bat wins immediately even with fakes alive — no volley lands that turn", () => {
    const s = winBySeed(42);
    expect(s.status).toBe("victory");
    expect(s.events.some((e) => e.type === "victory")).toBe(true);
    expect(s.boss.bats.filter((b) => !b.real && b.alive).length).toBe(9);
    expect(s.hero.hp).toBe(96); // 100 − 7 − 7 volleys, then +10 rider; none on the kill turn
  });

  it("first victory forges Fan Out, applies the +10/+2 rider, and emits the unlock", () => {
    const s = winBySeed(42);
    expect(s.events.some((e) => e.type === "forge" && e.ability === "fan-out")).toBe(true);
    expect(s.events.some((e) => e.type === "rider" && e.maxHp === 10 && e.maxMp === 2)).toBe(true);
    expect(s.events.some((e) => e.type === "unlock" && e.id === "alert-storm")).toBe(true);
    expect(s.hero.maxHp).toBe(110);
    expect(s.hero.maxMp).toBe(12);
    expect(s.defeatedBosses).toContain("alert-storm");
  });

  it("rematch victory grants NO forge/rider/unlock EVENT (defeatedBosses gates them); maxHp stays the derived 110 the fight started at (M6 — carry-over is derived, not a second bump)", () => {
    const s = winBySeed(42, ["alert-storm"]);
    expect(s.status).toBe("victory");
    expect(s.events.some((e) => e.type === "forge")).toBe(false);
    expect(s.events.some((e) => e.type === "rider")).toBe(false);
    expect(s.events.some((e) => e.type === "unlock")).toBe(false);
    expect(s.hero.maxHp).toBe(110);
  });

  it("a DoT tick that kills the real bat also wins", () => {
    const s0 = initBattle({ seed: 42 });
    const realId = s0.boss.bats.find((b) => b.real)!.id;
    const rigged = {
      ...s0,
      boss: { ...s0.boss, bats: s0.boss.bats.map((b) => (b.id === realId ? { ...b, hp: 4 } : b)) },
      dots: [{ batId: realId, ticksLeft: 1 }],
    };
    const s = battleReduce(rigged, { type: "ct" });
    expect(s.status).toBe("victory");
  });

  it("actions after the battle ends are invalid", () => {
    const s = winBySeed(42);
    const after = battleReduce(s, { type: "ct" });
    expect(after.events.some((e) => e.type === "invalid")).toBe(true);
    expect(after.status).toBe("victory");
  });
});

describe("derived rider (M6 — carry-over is derived, not stored)", () => {
  it("maxHp = 100 + 10·D, maxMp = 10 + 2·D where D = defeatedBosses.length; battles start full", () => {
    const fresh = initBattle({ seed: 42 });
    expect(fresh.hero).toEqual({ hp: 100, maxHp: 100, mp: 10, maxMp: 10 });

    const oneDown = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    expect(oneDown.hero).toEqual({ hp: 110, maxHp: 110, mp: 12, maxMp: 12 });
  });

  it("scales past one boss even though only alert-storm is implemented yet (rider math is boss-count-generic)", () => {
    const twoDown = initBattle({
      seed: 42,
      defeatedBosses: ["alert-storm", "cascade"],
    });
    expect(twoDown.hero).toEqual({ hp: 120, maxHp: 120, mp: 14, maxMp: 14 });
  });
});

describe("RUSH_ORDER / IMPLEMENTED_BOSSES (pinned constants)", () => {
  it("rush order is the four bosses in fight order; alert-storm is the only implemented one this PR", () => {
    expect(RUSH_ORDER).toEqual(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"]);
    expect(IMPLEMENTED_BOSSES).toEqual(["alert-storm"]);
  });
});

describe("kit derivation", () => {
  it("the base four abilities are always in kit, fresh or rematch; Fan Out joins only once alert-storm is defeated", () => {
    expect(deriveKit([])).toEqual(["attack", "ct", "pt", "debug"]);
    expect(deriveKit(["alert-storm"])).toEqual(["attack", "ct", "pt", "debug", "fo"]);
  });

  it("ignores a defeated boss outside IMPLEMENTED_BOSSES (pass-2 G1 guard) — no crash, no phantom kit growth", () => {
    expect(deriveKit(["cascade", "silent-failure"])).toEqual(["attack", "ct", "pt", "debug"]);
  });

  it("the reducer rejects an out-of-kit action type as invalid, without mutating turn/hero (forward-compat guard proven ahead of Fan Out landing)", () => {
    const s0 = initBattle({ seed: 42 });
    const s1 = battleReduce(s0, { type: "fo" } as unknown as Parameters<typeof battleReduce>[1]);
    expect(s1.events).toEqual([{ type: "invalid", reason: "not in kit" }]);
    expect(s1.turn).toBe(1);
    expect(s1.hero).toEqual(s0.hero);
  });
});

describe("Multiplier core (M6 §Multipliers — Conviction not castable in PR-1a, helpers tested directly)", () => {
  it("dealt, PT under both CT and Conviction: 28 × 2 × 2 = 112 (Conviction REPLACES CT's dealt percentage, never stacks it)", () => {
    expect(dealtDamage(28, true, true)).toBe(112);
  });

  it("taken, glitch-slash-sized hit under both CT and Conviction: 14 × 0.5 = 7 (Conviction REPLACES CT's taken percentage)", () => {
    expect(takenDamage(14, true, true)).toBe(7);
  });

  it("CT alone (Conviction off) still uses the shipped M5 percentages: dealt ×1.5, taken ×0.75", () => {
    expect(dealtDamage(28, true, false)).toBe(42);
    expect(takenDamage(14, true, false)).toBe(11); // roundHalfUp(10.5)
  });

  it("Conviction alone, CT down: dealt still doubles, but taken reduces nothing (CT owns the taken side entirely)", () => {
    expect(dealtDamage(28, false, true)).toBe(56);
    expect(takenDamage(14, false, true)).toBe(14);
  });

  it("neither active: both multipliers are 1", () => {
    expect(dealtDamage(28, false, false)).toBe(28);
    expect(takenDamage(14, false, false)).toBe(14);
  });

  it("a rigged state with conviction:true feeds the same pinned math (Conviction is a state flag even though nothing can cast it yet)", () => {
    const s = { ...initBattle({ seed: 1 }), ctTurns: 3, conviction: true };
    expect(dealtDamage(28, s.ctTurns > 0, s.conviction)).toBe(112);
    expect(takenDamage(14, s.ctTurns > 0, s.conviction)).toBe(7);
  });
});

describe("Fan Out (M6 — base 8, hits all living targets, single reshuffle)", () => {
  it("is out-of-kit and rejected as invalid in a fresh fight (Fan Out unlocks only once alert-storm is beaten)", () => {
    const s0 = initBattle({ seed: 42 });
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.events).toEqual([{ type: "invalid", reason: "not in kit" }]);
    expect(s1.turn).toBe(1);
    expect(s1.hero).toEqual(s0.hero);
  });

  it("is castable in the Alert Storm rematch (kit-derived): costs 3 MP and deals 8 to every living bat, one hit per target", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    const realId = s0.boss.bats.find((b) => b.real)!.id;
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(false);
    expect(s1.hero.mp).toBe(10); // 12 − 3 + 1 regen
    expect(s1.boss.bats.find((b) => b.id === realId)!.hp).toBe(52); // 60 − 8
    for (const fake of s0.boss.bats.filter((b) => !b.real)) {
      expect(s1.boss.bats.find((b) => b.id === fake.id)!.alive).toBe(false); // 8 HP fakes die to 8 dmg
    }
    expect(s1.events.filter((e) => e.type === "damage")).toHaveLength(10); // all 10 bats hit
  });

  it("resolves ALL hits before firing AT MOST ONE reshuffle — never nine chained fake-hit reshuffles", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.events.filter((e) => e.type === "reshuffle")).toHaveLength(1);
  });

  it("deals 12 under Critical Thinking (8 × 1.5, round half up) to the real bat", () => {
    let s = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    const realId = s.boss.bats.find((b) => b.real)!.id;
    s = battleReduce(s, { type: "ct" }); // turn 1
    const before = s.boss.bats.find((b) => b.id === realId)!.hp;
    s = battleReduce(s, { type: "fo" }); // turn 2, CT still active
    expect(before - s.boss.bats.find((b) => b.id === realId)!.hp).toBe(12);
  });

  it("emits a firstCast event the first time it is cast", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.events.some((e) => e.type === "firstCast" && e.ability === "fo")).toBe(true);
  });

  it("hitting only the real bat (all fakes already dead) fires no reshuffle", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    const rigged = {
      ...s0,
      boss: { ...s0.boss, bats: s0.boss.bats.map((b) => (b.real ? b : { ...b, hp: 0, alive: false })) },
    };
    const s1 = battleReduce(rigged, { type: "fo" });
    expect(s1.events.some((e) => e.type === "reshuffle")).toBe(false);
  });

  it("is invalid without 3 MP", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] });
    const broke = { ...s0, hero: { ...s0.hero, mp: 2 } };
    const s1 = battleReduce(broke, { type: "fo" });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(true);
    expect(s1.turn).toBe(1);
  });
});

describe("defeat and swarm decay", () => {
  it("the volley that empties hero HP defeats: status, event, HP floored at 0", () => {
    const s0 = initBattle({ seed: 42 });
    const rigged = { ...s0, hero: { ...s0.hero, hp: 5 } };
    const s = attackReal(rigged);
    expect(s.status).toBe("defeat");
    expect(s.hero.hp).toBe(0);
    expect(s.events.some((e) => e.type === "defeat")).toBe(true);
  });

  it("volley decays by 1 per 3 dead fakes (7 → 6 after the third kill)", () => {
    const s0 = initBattle({ seed: 42 });
    const fakes = s0.boss.bats.filter((b) => !b.real).map((b) => b.id);
    let s = battleReduce(s0, { type: "attack", target: fakes[0] });
    s = battleReduce(s, { type: "attack", target: fakes[1] });
    s = battleReduce(s, { type: "attack", target: fakes[2] });
    expect(s.hero.hp).toBe(80); // 100 − 7 − 7 − 6
  });

  it("volley never drops below 4 (nine dead fakes: max(4, 7−3) = 4)", () => {
    const s0 = initBattle({ seed: 42 });
    const rigged = {
      ...s0,
      boss: { ...s0.boss, bats: s0.boss.bats.map((b) => (b.real ? b : { ...b, hp: 0, alive: false })) },
    };
    const s = attackReal(rigged);
    expect(s.hero.hp).toBe(96); // 100 − 4
  });
});

describe("the streamlined line (plan verification item 6, pinned end-to-end)", () => {
  it("CT@1 → CT@2 → Debug@3 → PT@4 → PT@5 wins on turn 5 at 90 HP after the rider", () => {
    let s = initBattle({ seed: 42 });
    const realId = s.boss.bats.find((b) => b.real)!.id;
    s = battleReduce(s, { type: "ct" }); // t1: volley 5, hero 95
    s = battleReduce(s, { type: "ct" }); // t2: refresh, hero 90
    s = battleReduce(s, { type: "debug", target: realId }); // t3 scream: −9 (6×1.5) → 51, hero 85
    s = battleReduce(s, { type: "pt", target: realId }); // t4 ext. scream: −42 −4 tick → 5, hero 80
    expect(s.boss.bats.find((b) => b.id === realId)!.hp).toBe(5);
    expect(s.hero.hp).toBe(80);
    s = battleReduce(s, { type: "pt", target: realId }); // t5 (CT expired): 28 ≥ 5 — kill
    expect(s.status).toBe("victory");
    expect(s.turn).toBe(5);
    expect(s.hero.hp).toBe(90); // 80 + 10 rider
    expect(s.hero.maxHp).toBe(110);
  });
});
