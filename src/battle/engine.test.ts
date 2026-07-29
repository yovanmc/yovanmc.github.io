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
import type { BattleState, Bat, BattleAction } from "./engine";
import type { AlertStormBoss } from "./bosses/alertStorm";
import { SF_TARGET_ID, spawnSilentFailure } from "./bosses/silentFailure";
import type { SilentFailureBoss } from "./bosses/silentFailure";
import { spawnImposter } from "./bosses/imposter";
import type { ImposterBoss } from "./bosses/imposter";

/** `BattleState.boss` is a discriminated union as of M6 PR-1b (Cascade joined
 * Alert Storm) — this file is the pre-M6 Alert Storm suite, so every state it
 * builds is alert-storm-shaped; this narrows for the type checker without
 * changing any runtime behavior (mechanical accessor-path carve, same class
 * as PR-1a task 2's `s.bats` -> new-location moves). */
function bats(s: BattleState): Bat[] {
  if (s.boss.kind !== "alert-storm") throw new Error("expected alert-storm boss");
  return s.boss.bats;
}

/** Attack the real bat — never triggers a fake-hit reshuffle. */
function attackReal(s: BattleState): BattleState {
  const real = bats(s).find((b) => b.real)!;
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
    expect(bats(s)).toHaveLength(10);
    const real = bats(s).filter((b) => b.real);
    const fakes = bats(s).filter((b) => !b.real);
    expect(real).toHaveLength(1);
    expect(real[0].hp).toBe(60);
    expect(real[0].maxHp).toBe(60);
    expect(fakes).toHaveLength(9);
    for (const f of fakes) expect(f.hp).toBe(8);
    for (const b of bats(s)) {
      expect(b.alive).toBe(true);
      expect(b.marked).toBe(false);
    }
  });

  it("gives every bat a distinct id 0..9 and a distinct formation position 0..9", () => {
    const s = initBattle({ seed: 42 });
    expect(new Set(bats(s).map((b) => b.id)).size).toBe(10);
    expect(new Set(bats(s).map((b) => b.pos)).size).toBe(10);
    for (const b of bats(s)) {
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
    expect(bats(s).filter((b) => b.real)).toHaveLength(1);
    expect(s.rngState).not.toBe(0);
  });

  it("re-rolls the real bat across attempts for at least one seed (retry must not be a solved puzzle)", () => {
    const realId = (seed: number, attempt: number) =>
      bats(initBattle({ seed, attempt })).find((b) => b.real)!.id;
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
    const real = bats(s0).find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "attack", target: real.id });
    expect(bats(s1).find((b) => b.id === real.id)!.hp).toBe(48);
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
    const fake = bats(s0).find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "attack", target: fake.id });
    const hit = bats(s1).find((b) => b.id === fake.id)!;
    expect(hit.alive).toBe(false);
    expect(hit.hp).toBe(0);
    expect(s1.events.some((e) => e.type === "batDown" && e.batId === fake.id)).toBe(true);
    expect(s1.events.some((e) => e.type === "reshuffle" && e.reason === "fakeHit")).toBe(true);
    // permutation: living bats occupy the same SET of positions, each keeps its identity/hp
    const livingBefore = bats(s0).filter((b) => b.id !== fake.id);
    const livingAfter = bats(s1).filter((b) => b.alive);
    expect(new Set(livingAfter.map((b) => b.pos))).toEqual(
      new Set(livingBefore.map((b) => b.pos)),
    );
    for (const b of livingAfter) {
      const before = bats(s0).find((x) => x.id === b.id)!;
      expect(b.real).toBe(before.real);
      expect(b.hp).toBe(before.hp);
    }
  });

  it("hitting the real bat does not reshuffle", () => {
    const s1 = attackReal(initBattle({ seed: 42 }));
    expect(s1.events.some((e) => e.type === "reshuffle")).toBe(false);
    expect(bats(s1).map((b) => b.pos)).toEqual(bats(initBattle({ seed: 42 })).map((b) => b.pos));
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
    const fake = bats(s0).find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "attack", target: fake.id });
    const s2 = battleReduce(s1, { type: "attack", target: fake.id });
    expect(s2.events.some((e) => e.type === "invalid")).toBe(true);
    expect(s2.turn).toBe(s1.turn);
    expect(s2.hero).toEqual(s1.hero);
  });

  it("is deterministic: identical state + action produce identical results", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = bats(s0).find((b) => !b.real)!;
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
    const real = bats(s1).find((b) => b.real)!;
    const s2 = battleReduce(s1, { type: "attack", target: real.id });
    expect(bats(s2).find((b) => b.id === real.id)!.hp).toBe(42); // 60 − 18
  });

  it("lasts 3 turns: attacks on turns 2 and 3 are buffed, turn 4 is not", () => {
    let s = battleReduce(initBattle({ seed: 42 }), { type: "ct" }); // turn 1
    const real = () => bats(s).find((b) => b.real)!;
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
    const real = () => bats(s).find((b) => b.real)!;
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
    const real = bats(s0).find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "pt", target: real.id });
    expect(bats(s1).find((b) => b.id === real.id)!.hp).toBe(32);
    expect(s1.hero.mp).toBe(8); // 10 − 3 + 1 regen; no on-hit MP (Attack only)
  });

  it("deals 42 under Critical Thinking (28 × 1.5)", () => {
    const s1 = battleReduce(initBattle({ seed: 42 }), { type: "ct" });
    const real = bats(s1).find((b) => b.real)!;
    const s2 = battleReduce(s1, { type: "pt", target: real.id });
    expect(real.hp - bats(s2).find((b) => b.id === real.id)!.hp).toBe(42);
  });

  it("is invalid without 3 MP", () => {
    const s0 = initBattle({ seed: 42 });
    const real = bats(s0).find((b) => b.real)!;
    const broke = { ...s0, hero: { ...s0.hero, mp: 2 } };
    const s1 = battleReduce(broke, { type: "pt", target: real.id });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(true);
    expect(s1.turn).toBe(1);
  });
});

describe("debug", () => {
  it("costs 2 MP, deals 6 on cast, and marks the target permanently", () => {
    const s0 = initBattle({ seed: 42 });
    const real = bats(s0).find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "debug", target: real.id });
    const hit = bats(s1).find((b) => b.id === real.id)!;
    expect(hit.hp).toBe(54);
    expect(hit.marked).toBe(true);
    expect(s1.hero.mp).toBe(9); // 10 − 2 + 1 regen
    expect(s1.events.some((e) => e.type === "mark" && e.batId === real.id)).toBe(true);
  });

  it("ticks 4 damage on each of the next 3 turn advances, then stops — and CT never multiplies ticks", () => {
    const s0 = initBattle({ seed: 42 });
    const realId = bats(s0).find((b) => b.real)!.id;
    const hp = (s: BattleState) => bats(s).find((b) => b.id === realId)!.hp;
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
    const fake = bats(s0).find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "debug", target: fake.id });
    expect(s1.events.some((e) => e.type === "reshuffle" && e.reason === "fakeHit")).toBe(true);
    const marked = bats(s1).find((b) => b.id === fake.id)!;
    expect(marked.marked).toBe(true);
    expect(marked.hp).toBe(2); // 8 − 6, still alive
  });

  it("a DoT tick can down a fake (batDown) but a tick is not a hit — no reshuffle from the tick", () => {
    const s0 = initBattle({ seed: 42 });
    const fake = bats(s0).find((b) => !b.real)!;
    const s1 = battleReduce(s0, { type: "debug", target: fake.id }); // fake at 2 HP
    const s2 = battleReduce(s1, { type: "ct" }); // turn 2: tick 4 downs it
    const downed = bats(s2).find((b) => b.id === fake.id)!;
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
      bats(s0).find((b) => b.real)!.id,
      bats(s0).filter((b) => b.real === false)[0].id,
    ];
    let s = battleReduce(s0, { type: "debug", target: realId }); // turn 1
    s = battleReduce(s, { type: "debug", target: otherId }); // turn 2 (real ticks 4 → 50)
    const real = bats(s).find((b) => b.id === realId)!;
    expect(real.hp).toBe(50); // 60 − 6 − 4
    expect(real.marked).toBe(true);
    expect(bats(s).find((b) => b.id === otherId)!.marked).toBe(true);
  });
});

describe("victory", () => {
  /** PT, PT, attack kills the real bat on turn 3 (60 → 32 → 4 → 0). */
  function winBySeed(seed: number, defeatedBosses: string[] = []) {
    const s0 = initBattle({ seed, defeatedBosses });
    const realId = bats(s0).find((b) => b.real)!.id;
    let s = battleReduce(s0, { type: "pt", target: realId });
    s = battleReduce(s, { type: "pt", target: realId });
    return battleReduce(s, { type: "attack", target: realId });
  }

  it("killing the real bat wins immediately even with fakes alive — no volley lands that turn", () => {
    const s = winBySeed(42);
    expect(s.status).toBe("victory");
    expect(s.events.some((e) => e.type === "victory")).toBe(true);
    expect(bats(s).filter((b) => !b.real && b.alive).length).toBe(9);
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
    const realId = bats(s0).find((b) => b.real)!.id;
    const rigged = {
      ...s0,
      boss: { ...(s0.boss as AlertStormBoss), bats: bats(s0).map((b) => (b.id === realId ? { ...b, hp: 4 } : b)) },
      dots: [{ batId: realId, ticksLeft: 1, tick: 4 }],
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
  it("rush order is the four bosses in fight order; all four are implemented as of PR-3 (E3 reconciliation)", () => {
    expect(RUSH_ORDER).toEqual(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"]);
    expect(IMPLEMENTED_BOSSES).toEqual(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"]);
  });
});

describe("kit derivation", () => {
  it("the base four abilities are always in kit, fresh or rematch; Fan Out joins only once alert-storm is defeated", () => {
    expect(deriveKit([])).toEqual(["attack", "ct", "pt", "debug"]);
    expect(deriveKit(["alert-storm"])).toEqual(["attack", "ct", "pt", "debug", "fo"]);
  });

  it("cascade grants its real PR-2 unlock (rb); a fake boss id is ignored — no crash, no phantom kit growth (pass-2 G1 guard, 5th E3 reconciliation: re-pointed from imposter-syndrome, which is now IMPLEMENTED and asserted separately below rather than folded into this G1 probe — flipping THIS test's expectation to include \"conv\" would have deleted the only assertion protecting the G1 invariant)", () => {
    expect(deriveKit(["cascade", "not-a-real-boss"])).toEqual(["attack", "ct", "pt", "debug", "rb"]);
  });

  it("N10 path (b), both arms (task 5's deriveKit v8-ignore deletion): imposter-syndrome defeated grants conv; imposter-syndrome NOT defeated does not, even alongside every other boss", () => {
    expect(deriveKit(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"])).toEqual([
      "attack",
      "ct",
      "pt",
      "debug",
      "fo",
      "rb",
      "rc",
      "conv",
    ]);
    expect(deriveKit(["alert-storm", "cascade", "silent-failure"])).toEqual([
      "attack",
      "ct",
      "pt",
      "debug",
      "fo",
      "rb",
      "rc",
    ]);
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
    const realId = bats(s0).find((b) => b.real)!.id;
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(false);
    expect(s1.hero.mp).toBe(10); // 12 − 3 + 1 regen
    expect(bats(s1).find((b) => b.id === realId)!.hp).toBe(52); // 60 − 8
    for (const fake of bats(s0).filter((b) => !b.real)) {
      expect(bats(s1).find((b) => b.id === fake.id)!.alive).toBe(false); // 8 HP fakes die to 8 dmg
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
    const realId = bats(s).find((b) => b.real)!.id;
    s = battleReduce(s, { type: "ct" }); // turn 1
    const before = bats(s).find((b) => b.id === realId)!.hp;
    s = battleReduce(s, { type: "fo" }); // turn 2, CT still active
    expect(before - bats(s).find((b) => b.id === realId)!.hp).toBe(12);
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
      boss: { ...(s0.boss as AlertStormBoss), bats: bats(s0).map((b) => (b.real ? b : { ...b, hp: 0, alive: false })) },
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
    const fakes = bats(s0).filter((b) => !b.real).map((b) => b.id);
    let s = battleReduce(s0, { type: "attack", target: fakes[0] });
    s = battleReduce(s, { type: "attack", target: fakes[1] });
    s = battleReduce(s, { type: "attack", target: fakes[2] });
    expect(s.hero.hp).toBe(80); // 100 − 7 − 7 − 6
  });

  it("volley never drops below 4 (nine dead fakes: max(4, 7−3) = 4)", () => {
    const s0 = initBattle({ seed: 42 });
    const rigged = {
      ...s0,
      boss: { ...(s0.boss as AlertStormBoss), bats: bats(s0).map((b) => (b.real ? b : { ...b, hp: 0, alive: false })) },
    };
    const s = attackReal(rigged);
    expect(s.hero.hp).toBe(96); // 100 − 4
  });
});

describe("the streamlined line (plan verification item 6, pinned end-to-end)", () => {
  it("CT@1 → CT@2 → Debug@3 → PT@4 → PT@5 wins on turn 5 at 90 HP after the rider", () => {
    let s = initBattle({ seed: 42 });
    const realId = bats(s).find((b) => b.real)!.id;
    s = battleReduce(s, { type: "ct" }); // t1: volley 5, hero 95
    s = battleReduce(s, { type: "ct" }); // t2: refresh, hero 90
    s = battleReduce(s, { type: "debug", target: realId }); // t3 scream: −9 (6×1.5) → 51, hero 85
    s = battleReduce(s, { type: "pt", target: realId }); // t4 ext. scream: −42 −4 tick → 5, hero 80
    expect(bats(s).find((b) => b.id === realId)!.hp).toBe(5);
    expect(s.hero.hp).toBe(80);
    s = battleReduce(s, { type: "pt", target: realId }); // t5 (CT expired): 28 ≥ 5 — kill
    expect(s.status).toBe("victory");
    expect(s.turn).toBe(5);
    expect(s.hero.hp).toBe(90); // 80 + 10 rider
    expect(s.hero.maxHp).toBe(110);
  });
});

describe("Cascade boot + dispatch (M6 PR-1b task 3)", () => {
  it("initBattle boots boss: \"cascade\" on request, six nodes at 25/25, carrier at node 0", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    expect(s.boss.kind).toBe("cascade");
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    expect(s.boss.nodes).toHaveLength(6);
    expect(s.boss.nodes.every((n) => n.hp === 25 && n.alive)).toBe(true);
    expect(s.boss.carrier).toBe(0);
  });

  it("initBattle boots boss: \"imposter-syndrome\" on request, opens in clones at full HP (6th E3-class reconciliation, task 5)", () => {
    const s = initBattle({ seed: 42, boss: "imposter-syndrome" });
    expect(s.boss.kind).toBe("imposter-syndrome");
    if (s.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s.boss.hp).toBe(180);
    expect(s.boss.maxHp).toBe(180);
    expect(s.boss.phase).toBe("clones");
    expect(s.boss.realIndex).not.toBeNull();
  });

  it("falls back to alert-storm for a fake boss id (never a crash path; 6th E3-class reconciliation: re-pointed from imposter-syndrome, which now boots for real above — see the M6 PR-2 task 5 precedent this same test followed for silent-failure)", () => {
    expect(initBattle({ seed: 42, boss: "not-a-real-boss" }).boss.kind).toBe("alert-storm");
    expect(initBattle({ seed: 42 }).boss.kind).toBe("alert-storm");
  });

  it("the reducer rejects an out-of-kit action against a cascade boss the same way it does for alert-storm", () => {
    const s0 = initBattle({ seed: 42, boss: "cascade" });
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.events).toEqual([{ type: "invalid", reason: "not in kit" }]);
  });

  it("targets a living node; a dead or unknown node id is invalid", () => {
    const s0 = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["alert-storm"] });
    const s1 = battleReduce(s0, { type: "attack", target: 99 });
    expect(s1.events.some((e) => e.type === "invalid")).toBe(true);
  });

  it("Debug against the carrier marks it, deals 6 halved by the carrier shield (25 - floor(6/2) = 22), and starts a DoT", () => {
    const s = battleReduce(initBattle({ seed: 42, boss: "cascade" }), { type: "debug", target: 0 });
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    expect(s.boss.nodes.find((n) => n.id === 0)!.hp).toBe(22);
    expect(s.boss.nodes.find((n) => n.id === 0)!.marked).toBe(true);
    expect(s.events.some((e) => e.type === "mark" && e.batId === 0)).toBe(true);
    expect(s.dots).toEqual([{ batId: 0, ticksLeft: 3, tick: 4 }]); // tick stamped at push time (M6 PR-3 task 4)
  });

  it("DoT ticks on the carrier are halved by the shield too (the carrier shield applies from every source, not just direct hits)", () => {
    const s0 = initBattle({ seed: 42, boss: "cascade" });
    if (s0.boss.kind !== "cascade") throw new Error("unreachable");
    const rigged: BattleState = {
      ...s0,
      boss: { ...s0.boss, nodes: s0.boss.nodes.map((n) => (n.id === 0 ? { ...n, hp: 22, marked: true } : n)) },
      dots: [{ batId: 0, ticksLeft: 3, tick: 4 }],
    };
    const s = battleReduce(rigged, { type: "ct" }); // node 0 is still the (rigged, untouched) carrier
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    const node0 = s.boss.nodes.find((n) => n.id === 0)!;
    expect(node0.hp).toBe(20); // 22 - floor(4/2)
    expect(s.events.some((e) => e.type === "dot" && e.batId === 0 && e.amount === 2)).toBe(true);
  });

  it("a DoT tick that kills a node fires batDown and drops it from s.dots", () => {
    const s0 = initBattle({ seed: 42, boss: "cascade" });
    if (s0.boss.kind !== "cascade") throw new Error("unreachable");
    // rig node 1 (never the carrier at node 0) down to 3 HP with a live DoT
    const rigged: BattleState = {
      ...s0,
      boss: { ...s0.boss, nodes: s0.boss.nodes.map((n) => (n.id === 1 ? { ...n, hp: 3 } : n)) },
      dots: [{ batId: 1, ticksLeft: 1, tick: 4 }],
    };
    const s = battleReduce(rigged, { type: "ct" }); // DoT ticks 4 >= 3, node 1 dies
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    const node1 = s.boss.nodes.find((n) => n.id === 1)!;
    expect(node1.alive).toBe(false);
    expect(node1.hp).toBe(0);
    expect(s.events.some((e) => e.type === "batDown" && e.batId === 1)).toBe(true);
    expect(s.dots).toEqual([]); // exhausted AND the dead node drops it
  });

  it("a cascade boss turn that empties hero HP defeats: status, event, HP floored at 0", () => {
    const s0 = initBattle({ seed: 42, boss: "cascade" });
    const rigged: BattleState = { ...s0, hero: { ...s0.hero, hp: 5 } }; // any jolt/storm exceeds 5
    const s = battleReduce(rigged, { type: "ct" }); // jolt 9 -> taken 7 under CT, still > 5
    expect(s.status).toBe("defeat");
    expect(s.hero.hp).toBe(0);
    expect(s.events.some((e) => e.type === "defeat")).toBe(true);
  });

  describe("the engine-generated win line (regenerated from an actual battleReduce run, plan §Boss 2 signed table)", () => {
    // CT@1, FO@2, FO@3, FO@4, Attack(carrier)@5 — booted at the rematch-style
    // 110/12 start (defeatedBosses: ["alert-storm"]) per the plan's own note
    // that the derivation assumed Fan Out already in kit.
    function winLine() {
      let s = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["alert-storm"] });
      s = battleReduce(s, { type: "ct" }); // t1
      s = battleReduce(s, { type: "fo" }); // t2
      s = battleReduce(s, { type: "fo" }); // t3
      s = battleReduce(s, { type: "fo" }); // t4
      return s;
    }
    function nodes(s: BattleState) {
      if (s.boss.kind !== "cascade") throw new Error("unreachable");
      return s.boss.nodes;
    }
    function carrier(s: BattleState) {
      if (s.boss.kind !== "cascade") throw new Error("unreachable");
      return s.boss.carrier;
    }

    it("starts the rematch at 110/12 with Fan Out in kit", () => {
      const s0 = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["alert-storm"] });
      expect(s0.hero).toEqual({ hp: 110, maxHp: 110, mp: 12, maxMp: 12 });
      expect(deriveKit(s0.defeatedBosses)).toContain("fo");
    });

    it("T1 CT: jolt 9 taken-down to 7 (CT active), pulse lands on node 3, hero 103", () => {
      let s = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["alert-storm"] });
      s = battleReduce(s, { type: "ct" });
      expect(s.events.some((e) => e.type === "heroDamage" && e.amount === 7)).toBe(true);
      expect(s.hero.hp).toBe(103);
      expect(carrier(s)).toBe(3);
      expect(nodes(s).every((n) => n.hp === 25)).toBe(true); // no node damage yet
    });

    it("T2 first FO (still CT'd): 12 to every node (6 to the carrier), then the pulse WRAPS — a storm (19, CT'd) instead of a jolt, resets to head", () => {
      let s = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["alert-storm"] });
      s = battleReduce(s, { type: "ct" });
      s = battleReduce(s, { type: "fo" });
      expect(nodes(s).map((n) => n.hp)).toEqual([13, 13, 13, 19, 13, 13]); // node 3 was carrier: 25-6
      expect(s.events.some((e) => e.type === "heroDamage" && e.amount === 19)).toBe(true);
      expect(s.hero.hp).toBe(84);
      expect(carrier(s)).toBe(0); // storm resets the pulse to head
    });

    it("T3 second FO (last buffed turn): 12 to every node (6 to carrier 0), jolt 9 taken-down to 7, pulse lands on node 3", () => {
      let s = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["alert-storm"] });
      s = battleReduce(s, { type: "ct" });
      s = battleReduce(s, { type: "fo" });
      s = battleReduce(s, { type: "fo" });
      expect(nodes(s).map((n) => n.hp)).toEqual([7, 1, 1, 7, 1, 1]);
      expect(s.events.some((e) => e.type === "heroDamage" && e.amount === 7)).toBe(true);
      expect(s.hero.hp).toBe(77);
      expect(carrier(s)).toBe(3);
    });

    it("T4 third FO (CT expired, uncT'd 8): five nodes die, only the carrier survives at 3 HP (4 dmg after the shield); the lone-node ring wraps every turn — storm 25 (no CT), hero to 52", () => {
      const s = winLine();
      const living = nodes(s).filter((n) => n.alive);
      expect(living).toHaveLength(1);
      expect(living[0].id).toBe(3);
      expect(living[0].hp).toBe(3);
      expect(s.events.some((e) => e.type === "heroDamage" && e.amount === 25)).toBe(true);
      expect(s.hero.hp).toBe(52);
      expect(s.status).toBe("active");
    });

    it("T5 Attack on the carrier finishes the fight: victory, forge=rollback, unlock=cascade, rider applied on top of the 52 HP the fight arrived at", () => {
      let s = winLine();
      s = battleReduce(s, { type: "attack", target: carrier(s) });
      expect(s.status).toBe("victory");
      expect(s.turn).toBe(5);
      expect(nodes(s).every((n) => !n.alive)).toBe(true);
      expect(s.events.some((e) => e.type === "victory")).toBe(true);
      expect(s.events.some((e) => e.type === "forge" && e.ability === "rollback")).toBe(true);
      expect(s.events.some((e) => e.type === "rider" && e.maxHp === 10 && e.maxMp === 2)).toBe(true);
      expect(s.events.some((e) => e.type === "unlock" && e.id === "cascade")).toBe(true);
      expect(s.defeatedBosses).toEqual(["alert-storm", "cascade"]);
      // 110 -> 52 HP over the fight (the signed table's trajectory), +10 rider on this first cascade win
      expect(s.hero.hp).toBe(62);
      expect(s.hero.maxHp).toBe(120);
    });
  });

  it("rematch victory (cascade already defeated) grants no forge/rider/unlock event", () => {
    // Rigged, same style as the existing "a DoT tick that kills the real bat
    // also wins" test: only node 0 survives, at 1 HP, so a single attack ends
    // it immediately (victory short-circuits before any boss turn, so hero
    // HP/MP starting values don't matter here).
    const s0 = initBattle({ seed: 1, boss: "cascade", defeatedBosses: ["alert-storm", "cascade"] });
    if (s0.boss.kind !== "cascade") throw new Error("unreachable");
    const rigged: BattleState = {
      ...s0,
      boss: {
        ...s0.boss,
        nodes: s0.boss.nodes.map((n) => (n.id === 0 ? { ...n, hp: 1 } : { ...n, hp: 0, alive: false })),
      },
    };
    const s = battleReduce(rigged, { type: "attack", target: 0 });
    expect(s.status).toBe("victory");
    expect(s.events.some((e) => e.type === "forge")).toBe(false);
    expect(s.events.some((e) => e.type === "rider")).toBe(false);
    expect(s.events.some((e) => e.type === "unlock")).toBe(false);
    expect(s.hero.maxHp).toBe(s0.hero.maxHp); // no second bump
  });
});

// ---- M6 PR-2 task 4: Silent Failure engine wiring + Rollback --------------
// Silent Failure isn't bootable via initBattle until task 5 — until then
// these tests build a synthetic BattleState directly (same precedent as
// bosses/cascade.ts's own PR-1b task 2 tests, before Cascade had boot wiring
// either). Hero starts at the signed table's stated arrival stats (120/14
// with Rollback) by deriving from defeatedBosses: ["alert-storm", "cascade"].
function silentFailureState(
  bossOverrides: Partial<SilentFailureBoss> = {},
  stateOverrides: Partial<BattleState> = {},
): BattleState {
  const base = initBattle({ seed: 42, defeatedBosses: ["alert-storm", "cascade"] });
  const boss: SilentFailureBoss = { ...spawnSilentFailure(), ...bossOverrides };
  return { ...base, boss, ...stateOverrides };
}

describe("Silent Failure engine wiring (M6 PR-2 task 4)", () => {
  describe("D2 targetability: pt/debug/fo invalid while vanished; attack is exempted and whiffs", () => {
    it("pt against a vanished boss is invalid: no MP spent, no turn consumed", () => {
      const s0 = silentFailureState({ phase: "vanished" });
      const s1 = battleReduce(s0, { type: "pt", target: SF_TARGET_ID });
      expect(s1.events).toEqual([{ type: "invalid", reason: "target is not there" }]);
      expect(s1.turn).toBe(s0.turn);
      expect(s1.hero.mp).toBe(s0.hero.mp);
    });

    it("debug against a vanished boss is invalid: no MP spent, no mark, no DoT started", () => {
      const s0 = silentFailureState({ phase: "vanished" });
      const s1 = battleReduce(s0, { type: "debug", target: SF_TARGET_ID });
      expect(s1.events).toEqual([{ type: "invalid", reason: "target is not there" }]);
      expect(s1.hero.mp).toBe(s0.hero.mp);
      expect(s1.dots).toEqual([]);
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.marked).toBe(false);
    });

    it("fo against a vanished boss is invalid: no MP spent, no turn consumed (gated before the MP deduction, not inside the fan-out helper)", () => {
      const s0 = silentFailureState({ phase: "vanished" });
      const s1 = battleReduce(s0, { type: "fo" });
      expect(s1.events).toEqual([{ type: "invalid", reason: "target is not there" }]);
      expect(s1.turn).toBe(s0.turn);
      expect(s1.hero.mp).toBe(s0.hero.mp);
    });

    it("pt/debug/fo are all legal against an embodied boss (no invalid event)", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      expect(battleReduce(s0, { type: "pt", target: SF_TARGET_ID }).events.some((e) => e.type === "invalid")).toBe(false);
      expect(battleReduce(s0, { type: "debug", target: SF_TARGET_ID }).events.some((e) => e.type === "invalid")).toBe(false);
      expect(battleReduce(s0, { type: "fo" }).events.some((e) => e.type === "invalid")).toBe(false);
    });

    it("attack against a vanished boss whiffs: a damage event with amount 0, turn consumed, no +1 MP gain, boss HP untouched", () => {
      const s0 = silentFailureState({ phase: "vanished", phaseTurnsLeft: 2 });
      const s1 = battleReduce(s0, { type: "attack", target: SF_TARGET_ID });
      expect(s1.events).toContainEqual({ type: "damage", batId: SF_TARGET_ID, amount: 0 });
      expect(s1.events.some((e) => e.type === "invalid")).toBe(false);
      expect(s1.turn).toBe(s0.turn + 1);
      expect(s1.hero.mp).toBe(s0.hero.mp); // attack costs 0 MP and gains none back on a whiff
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(140);
    });

    it("attack against an embodied boss deals ATTACK_DMG and grants +1 MP as usual (the generic amount > 0 gate is behaviour-neutral here)", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const hurt: BattleState = { ...s0, hero: { ...s0.hero, mp: s0.hero.maxMp - 5 } };
      const s1 = battleReduce(hurt, { type: "attack", target: SF_TARGET_ID });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(140 - 12);
      // +1 MP on hit, then +1 end-of-turn regen (an embodied swing follows) = +2 total
      expect(s1.hero.mp).toBe(hurt.hero.mp + 2);
    });

    it("a target id other than SF_TARGET_ID is invalid: findTarget's unmatched-id path returns undefined (E2 real coverage gap)", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const s1 = battleReduce(s0, { type: "attack", target: SF_TARGET_ID + 1 });
      expect(s1.events).toEqual([{ type: "invalid", reason: "invalid target" }]);
      expect(s1.turn).toBe(s0.turn);
    });
  });

  describe("Debug mark + DoT on the Silent Failure (verbatim: DoT ticks through the hidden phase)", () => {
    it("debug deals 6, marks it, and starts a DoT that has not ticked yet this turn", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const s1 = battleReduce(s0, { type: "debug", target: SF_TARGET_ID });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(140 - 6);
      expect(s1.boss.marked).toBe(true);
      expect(s1.dots).toEqual([{ batId: SF_TARGET_ID, ticksLeft: 3, tick: 4 }]); // tick stamped at push time (M6 PR-3 task 4)
    });

    it("an existing DoT keeps ticking while vanished even though the boss is untargetable", () => {
      const s0 = silentFailureState(
        { phase: "vanished", phaseTurnsLeft: 2, hp: 100, marked: true },
        { dots: [{ batId: SF_TARGET_ID, ticksLeft: 2, tick: 4 }] },
      );
      const s1 = battleReduce(s0, { type: "ct" }); // untargeted, deals no direct damage — isolates the DoT tick
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(96); // DOT_TICK 4
      expect(s1.dots).toEqual([{ batId: SF_TARGET_ID, ticksLeft: 1, tick: 4 }]);
    });
  });

  describe("Fan Out vs the Silent Failure (single target — degenerates to a plain hit, no reshuffle, no shield)", () => {
    it("hits for the standard Fan Out amount", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const s1 = battleReduce(s0, { type: "fo" });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(140 - 8);
    });

    it("CT'd: dealtDamage(8, true, false) = 12", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 }, { ctTurns: 3 });
      const s1 = battleReduce(s0, { type: "fo" });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(140 - 12);
    });

    it("lethal Fan Out (hp exactly hits 0) pushes batDown same as a direct hit (E2 real coverage gap)", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2, hp: 8 });
      const s1 = battleReduce(s0, { type: "fo" });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(0);
      expect(s1.events).toContainEqual({ type: "batDown", batId: SF_TARGET_ID });
    });
  });

  describe("boss turn: swing (embodied) / ambush (vanished)", () => {
    // Triggered with `attack`, not `ct`: casting CT itself sets ctTurns > 0
    // for THIS SAME boss turn (pre-existing engine behaviour, same mechanism
    // Cascade's own CT tests rely on), which would silently CT-reduce the
    // swing/ambush amount these tests are trying to measure uncT'd.
    it("embodied boss turn deals the swing amount (12) and decrements the window", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const s1 = battleReduce(s0, { type: "attack", target: SF_TARGET_ID });
      expect(s1.hero.hp).toBe(s0.hero.hp - 12);
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.phase).toBe("embodied");
      expect(s1.boss.phaseTurnsLeft).toBe(1);
    });

    it("vanished boss turn deals the ambush amount (18) and decrements the window", () => {
      const s0 = silentFailureState({ phase: "vanished", phaseTurnsLeft: 2 });
      const s1 = battleReduce(s0, { type: "attack", target: SF_TARGET_ID }); // whiffs (vanished), still consumes the turn
      expect(s1.hero.hp).toBe(s0.hero.hp - 18);
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.phase).toBe("vanished");
      expect(s1.boss.phaseTurnsLeft).toBe(1);
    });

    it("a full window flips the phase (embodied -> vanished) across two hero turns", () => {
      let s = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      s = battleReduce(s, { type: "attack", target: SF_TARGET_ID });
      s = battleReduce(s, { type: "attack", target: SF_TARGET_ID });
      if (s.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s.boss.phase).toBe("vanished");
      expect(s.boss.phaseTurnsLeft).toBe(2);
    });

    it("a boss turn that empties hero HP defeats: status, event, HP floored at 0", () => {
      const s0 = silentFailureState(
        { phase: "vanished", phaseTurnsLeft: 2 },
        { hero: { hp: 10, maxHp: 120, mp: 14, maxMp: 14 } },
      );
      const s1 = battleReduce(s0, { type: "ct" }); // ambush 18 > 10
      expect(s1.status).toBe("defeat");
      expect(s1.hero.hp).toBe(0);
      expect(s1.events.some((e) => e.type === "defeat")).toBe(true);
    });
  });

  describe("Rollback (new ability this task): heal 30 capped at maxHp, 3 MP, untargeted", () => {
    it("heals 30 and costs 3 MP", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const hurt: BattleState = { ...s0, hero: { ...s0.hero, hp: 50 } };
      const s1 = battleReduce(hurt, { type: "rb" });
      expect(s1.hero.hp).toBe(50 + 30 - 12); // heal 30, then the embodied swing (12)
      expect(s1.hero.mp).toBe(hurt.hero.mp - 3 + 1); // 3 MP cost, +1 end-of-turn regen
    });

    it("caps the heal at maxHp rather than overhealing", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2 });
      const hurt: BattleState = { ...s0, hero: { ...s0.hero, hp: s0.hero.maxHp - 5 } };
      const s1 = battleReduce(hurt, { type: "rb" });
      expect(s1.hero.hp).toBe(s0.hero.maxHp - 12); // capped at max, then the swing
    });

    it("is invalid without Cascade defeated (out of kit)", () => {
      const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm"] }); // no cascade -> no rb
      const s1 = battleReduce(s0, { type: "rb" });
      expect(s1.events).toEqual([{ type: "invalid", reason: "not in kit" }]);
    });
  });

  describe("victory: forge event is root-cause; rc unlock live since PR-3 (E3 task-4 reconciliation)", () => {
    it("defeating Silent Failure emits forge: root-cause, rider, and unlock, and grants the rc ability", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2, hp: 5 });
      const s1 = battleReduce(s0, { type: "pt", target: SF_TARGET_ID }); // PT_DMG 28 >> 5, kills outright
      expect(s1.status).toBe("victory");
      expect(s1.events.some((e) => e.type === "forge" && e.ability === "root-cause")).toBe(true);
      expect(s1.events.some((e) => e.type === "unlock" && e.id === "silent-failure")).toBe(true);
      // base four + fo (alert-storm) + rb (cascade) + rc (silent-failure, M6 PR-3 task 4)
      expect(deriveKit([...s0.defeatedBosses, "silent-failure"])).toEqual([
        "attack",
        "ct",
        "pt",
        "debug",
        "fo",
        "rb",
        "rc",
      ]);
    });
  });

  describe("signed DoT-kill ruling: a DoT tick that drops the boss to 0 while vanished fires victory and sets forceBodyForDeath", () => {
    it("vanished: forceBodyForDeath becomes true", () => {
      const s0 = silentFailureState(
        { phase: "vanished", phaseTurnsLeft: 2, hp: 4, marked: true },
        { dots: [{ batId: SF_TARGET_ID, ticksLeft: 2, tick: 4 }] },
      );
      const s1 = battleReduce(s0, { type: "ct" }); // no direct damage — only the DoT tick touches boss HP
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(0);
      expect(s1.boss.forceBodyForDeath).toBe(true);
      expect(s1.status).toBe("victory");
      expect(s1.events.some((e) => e.type === "victory")).toBe(true);
    });

    it("embodied: forceBodyForDeath stays false (already showing the body)", () => {
      const s0 = silentFailureState(
        { phase: "embodied", phaseTurnsLeft: 2, hp: 4, marked: true },
        { dots: [{ batId: SF_TARGET_ID, ticksLeft: 2, tick: 4 }] },
      );
      const s1 = battleReduce(s0, { type: "ct" });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(0);
      expect(s1.boss.forceBodyForDeath).toBe(false);
      expect(s1.status).toBe("victory");
    });

    it("a direct-hit kill while embodied never forces the flag (it's already the body frame)", () => {
      const s0 = silentFailureState({ phase: "embodied", phaseTurnsLeft: 2, hp: 5 });
      const s1 = battleReduce(s0, { type: "pt", target: SF_TARGET_ID });
      if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
      expect(s1.boss.forceBodyForDeath).toBe(false);
    });
  });
});

// ---- M6 PR-2 task 5: Silent Failure bootable + engine-generated win line --
describe("Silent Failure boot + engine-generated win line (M6 PR-2 task 5)", () => {
  it('initBattle boots boss: "silent-failure" on request: 140/140, embodied, 2 turns left, unmarked, no extension used, body forced off', () => {
    const s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
    expect(s.boss.kind).toBe("silent-failure");
    if (s.boss.kind !== "silent-failure") throw new Error("unreachable");
    expect(s.boss.hp).toBe(140);
    expect(s.boss.maxHp).toBe(140);
    expect(s.boss.phase).toBe("embodied");
    expect(s.boss.phaseTurnsLeft).toBe(2);
    expect(s.boss.marked).toBe(false);
    expect(s.boss.extendedThisWindow).toBe(false);
    expect(s.boss.forceBodyForDeath).toBe(false);
  });

  it("hero arrives at the signed 120/14 with Rollback in kit (defeatedBosses: alert-storm + cascade)", () => {
    const s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
    expect(s.hero).toEqual({ hp: 120, maxHp: 120, mp: 14, maxMp: 14 });
    expect(deriveKit(s.defeatedBosses)).toContain("rb");
  });

  describe("the engine-generated win line (fastest legal line from the signed table: PT, PT, whiff, CT, PT, PT — 28+28+42+42 = exactly 140)", () => {
    // Not a hand-pinned literal sequence (standing F1 rule): this runs the
    // signed line through the real reducer and reads OBSERVED facts off the
    // resulting states — phases actually entered, whether an ambush turn was
    // survived, and where the run actually lands relative to the signed 6-11
    // hero-turn band — rather than typing in numbers computed by hand.
    const ACTIONS: BattleAction[] = [
      { type: "pt", target: SF_TARGET_ID }, // T1 embodied
      { type: "pt", target: SF_TARGET_ID }, // T2 embodied -> flips to vanished
      { type: "attack", target: SF_TARGET_ID }, // T3 vanished whiff
      { type: "ct" }, // T4 vanished (CT active same turn) -> flips to embodied
      { type: "pt", target: SF_TARGET_ID }, // T5 embodied, CT'd
      { type: "pt", target: SF_TARGET_ID }, // T6 embodied, CT'd, lethal
    ];

    function winLine() {
      let s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
      const phasesSeen = new Set<string>();
      const ambushDamageSurvived: number[] = [];
      if (s.boss.kind === "silent-failure") phasesSeen.add(s.boss.phase);
      for (const action of ACTIONS) {
        if (s.status !== "active") break;
        const prePhase = s.boss.kind === "silent-failure" ? s.boss.phase : undefined;
        s = battleReduce(s, action);
        if (s.boss.kind === "silent-failure") phasesSeen.add(s.boss.phase);
        const dmg = s.events.find((e) => e.type === "heroDamage");
        if (dmg && dmg.type === "heroDamage" && prePhase === "vanished" && s.status !== "defeat") {
          ambushDamageSurvived.push(dmg.amount);
        }
      }
      return { s, phasesSeen, ambushDamageSurvived };
    }

    it("reaches victory within the signed 6-11 hero-turn band, entering both phases, surviving at least one ambush, hero HP > 0", () => {
      const { s, phasesSeen, ambushDamageSurvived } = winLine();
      expect(s.status).toBe("victory");
      expect(s.turn).toBeGreaterThanOrEqual(6);
      expect(s.turn).toBeLessThanOrEqual(11);
      expect(phasesSeen.has("embodied")).toBe(true);
      expect(phasesSeen.has("vanished")).toBe(true);
      expect(ambushDamageSurvived.length).toBeGreaterThanOrEqual(1);
      expect(s.hero.hp).toBeGreaterThan(0);
    });

    it("emits victory + forge=root-cause + unlock=silent-failure, rider applied on top of the fight's ending HP", () => {
      const { s } = winLine();
      expect(s.events.some((e) => e.type === "victory")).toBe(true);
      expect(s.events.some((e) => e.type === "forge" && e.ability === "root-cause")).toBe(true);
      expect(s.events.some((e) => e.type === "unlock" && e.id === "silent-failure")).toBe(true);
      expect(s.defeatedBosses).toEqual(["alert-storm", "cascade", "silent-failure"]);
      // rc ability/KIT_UNLOCKS entry ships THIS PR (M6 PR-3 task 4) — SF
      // defeat now unlocks Root Cause (E3 task-4 reconciliation).
      expect(deriveKit(s.defeatedBosses)).toContain("rc");
      // Conviction still gains NO KIT_UNLOCKS entry (N10) — this input never
      // defeated Imposter, so the kit gate keeps a live guard here.
      expect(deriveKit(s.defeatedBosses)).not.toContain("conv");
    });
  });
});

// ---- M6 PR-3 task 4: Imposter engine wiring (rc/conv, mirror hookups, ------
// ---- Conviction conversion sites, E8 clone-pop overlay) -------------------
function imposterState(
  bossOverrides: Partial<ImposterBoss> = {},
  stateOverrides: Partial<BattleState> = {},
): BattleState {
  // Hero arrives 130/16 with Root Cause (N-table) — defeatedBosses grants
  // fo/rb/rc; imposter-syndrome itself is NOT in this list (IMPLEMENTED_BOSSES
  // doesn't carry it until task 5), matching the real pre-task-5 shape.
  const base = initBattle({ seed: 42, defeatedBosses: ["alert-storm", "cascade", "silent-failure"] });
  const boss: ImposterBoss = { ...spawnImposter(0, (r) => r).boss, ...bossOverrides };
  return { ...base, boss, ...stateOverrides };
}

describe("Root Cause (rc) — new ability this task: 4 MP (N1)", () => {
  it("costs 4 MP", () => {
    const s0 = imposterState();
    const s1 = battleReduce(s0, { type: "rc", target: 0 });
    expect(s1.hero.mp).toBe(16 - 4 + 1); // 4 MP cost, +1 end-of-turn regen
  });

  it("deals 22 unmarked, 33 vs a marked Imposter (N-table)", () => {
    const s0 = imposterState();
    const s1 = battleReduce(s0, { type: "rc", target: 0 });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 22);

    const marked = imposterState({ marked: true });
    const s2 = battleReduce(marked, { type: "rc", target: 0 });
    if (s2.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s2.boss.hp).toBe(180 - 33);
  });

  it('always hits the real clone regardless of which slot is targeted, and never pops (N-table: "hits real clone")', () => {
    const s0 = imposterState({ realIndex: 2 }); // the real boss is slot 2
    const s1 = battleReduce(s0, { type: "rc", target: 0 }); // targets the WRONG slot
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 22); // lands anyway — ignores the illusion
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg).toEqual({ type: "damage", batId: 2, amount: 22 }); // reported against the REAL slot id
  });

  it("rips a VANISH phase back immediately: full hit lands and the phase ends early (N5)", () => {
    const s0 = imposterState({ phase: "vanish", phaseTurnsLeft: 2 });
    const s1 = battleReduce(s0, { type: "rc", target: 0 });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 22);
    // Ends at "clones", not "mirror": ripBackVanish advances vanish -> mirror
    // (non-degenerate nextPhase), but MIRROR_TURNS is always exactly 1 and
    // the mirror phase resolves-and-advances unconditionally the INSTANT the
    // boss-turn dispatch (later in this same reduce call) sees it — so the
    // rip-back cascades through mirror's own immediate resolution too, same
    // hero turn, landing on "clones". Verified against the fastest-line's H6
    // (where the SAME rip-back, already degenerate there, lands on "clones"
    // directly with no intermediate mirror stop — this test is the
    // non-degenerate case, which passes THROUGH mirror instead of skipping
    // it, but still lands on the phase after mirror in one reduce call).
    expect(s1.boss.phase).toBe("clones");
  });

  it("against a non-Imposter boss (fallback): flat 22 unmarked (the marked bonus + ignore-stealth generic behavior are covered below)", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["alert-storm", "cascade", "silent-failure"] });
    const real = bats(s0).find((b) => b.real)!;
    const s1 = battleReduce(s0, { type: "rc", target: real.id });
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg?.amount).toBe(22);
  });
});

describe("rc marked bonus + ignores-stealth (diff-review fixes against 972a0f0 — both are player-reachable: beat Silent Failure, rc unlocks, rematch any boss)", () => {
  it("vs a marked Cascade node deals 33, not 22 (and an unmarked node still takes 22)", () => {
    const s0 = initBattle({ seed: 42, boss: "cascade", defeatedBosses: ["silent-failure"] });
    if (s0.boss.kind !== "cascade") throw new Error("unreachable");
    const cascadeBoss0 = s0.boss;
    const targetId = cascadeBoss0.nodes.find((n) => n.id !== cascadeBoss0.carrier)!.id; // avoid the carrier shield's halving

    const s1 = battleReduce(s0, { type: "rc", target: targetId });
    if (s1.boss.kind !== "cascade") throw new Error("unreachable");
    expect(s1.boss.nodes.find((n) => n.id === targetId)!.hp).toBe(25 - 22); // unmarked

    // A real node's max is 25 (addendum-signed) — too low to observe an
    // unclamped 33 without dying first, so this fixture bumps just the hp/
    // maxHp headroom on the ALREADY-BUILT state to isolate the marked-bonus
    // arithmetic from the unrelated 25-HP clamp; nothing else about the
    // node (id, carrier status, marked flag under test) is touched.
    const markedNodes = cascadeBoss0.nodes.map((n) =>
      n.id === targetId ? { ...n, marked: true, hp: 100, maxHp: 100 } : n,
    );
    const marked: BattleState = { ...s0, boss: { ...cascadeBoss0, nodes: markedNodes } };
    const s2 = battleReduce(marked, { type: "rc", target: targetId });
    if (s2.boss.kind !== "cascade") throw new Error("unreachable");
    expect(s2.boss.nodes.find((n) => n.id === targetId)!.hp).toBe(100 - 33);
  });

  it("vs a marked Alert Storm bat deals 33", () => {
    const s0 = initBattle({ seed: 42, defeatedBosses: ["cascade", "silent-failure"] }); // alert-storm boots by default
    const real = bats(s0).find((b) => b.real)!; // 60 HP — comfortably absorbs 33 unclamped
    const marked: BattleState = {
      ...s0,
      boss: {
        ...(s0.boss as AlertStormBoss),
        bats: bats(s0).map((b) => (b.id === real.id ? { ...b, marked: true } : b)),
      },
    };
    const s1 = battleReduce(marked, { type: "rc", target: real.id });
    const realAfter = bats(s1).find((b) => b.id === real.id)!;
    expect(real.hp - realAfter.hp).toBe(33);
  });

  it("vs a VANISHED Silent Failure lands full damage and does NOT whiff (Boss 3 table: \"targeting-while-hidden stays Root Cause's job\")", () => {
    // rc only exists in kit AFTER Silent Failure is defeated once (KIT_UNLOCKS),
    // so the only legal in-game way to cast it against SF at all is exactly
    // the coordinator's scenario: a REMATCH — defeatedBosses already includes
    // "silent-failure".
    const s0 = silentFailureState(
      { phase: "vanished", phaseTurnsLeft: 2 },
      { defeatedBosses: ["alert-storm", "cascade", "silent-failure"] },
    );
    const s1 = battleReduce(s0, { type: "rc", target: SF_TARGET_ID });
    if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(140 - 22); // full hit landed, not the whiffed 0
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg?.amount).toBe(22);
  });

  it("vs an embodied Silent Failure is unchanged: still a plain 22 hit", () => {
    const s0 = silentFailureState(
      { phase: "embodied", phaseTurnsLeft: 2 },
      { defeatedBosses: ["alert-storm", "cascade", "silent-failure"] },
    );
    const s1 = battleReduce(s0, { type: "rc", target: SF_TARGET_ID });
    if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(140 - 22);
  });

  it("regression guard: the ignore-stealth flag did not leak into attack/pt/debug against a vanished Silent Failure", () => {
    const s0 = silentFailureState({ phase: "vanished", phaseTurnsLeft: 2 });

    const attacked = battleReduce(s0, { type: "attack", target: SF_TARGET_ID });
    if (attacked.boss.kind !== "silent-failure") throw new Error("unreachable");
    expect(attacked.boss.hp).toBe(140); // still whiffs
    expect(attacked.hero.mp).toBe(s0.hero.mp); // still no +1-on-hit (capped at the same max either way)

    const pt = battleReduce(s0, { type: "pt", target: SF_TARGET_ID });
    expect(pt.events).toEqual([{ type: "invalid", reason: "target is not there" }]);

    const debug = battleReduce(s0, { type: "debug", target: SF_TARGET_ID });
    expect(debug.events).toEqual([{ type: "invalid", reason: "target is not there" }]);
  });
});

describe("Conviction (conv) — new ability this task: 5 MP, the hp*4 <= maxHp gate (N10)", () => {
  it("is invalid when hp*4 > maxHp, even with the mid-fight forge already unlocked", () => {
    const s0 = imposterState({ forgeFired: true }, { hero: { hp: 33, maxHp: 130, mp: 16, maxMp: 16 } }); // 33*4=132>130
    const s1 = battleReduce(s0, { type: "conv" });
    expect(s1.events).toEqual([{ type: "invalid", reason: "conviction gate not met" }]);
  });

  it("is castable exactly at the hp*4 == maxHp boundary (integer-exact, N10)", () => {
    const s0 = imposterState({ forgeFired: true }, { hero: { hp: 32, maxHp: 128, mp: 16, maxMp: 16 } }); // 32*4=128
    const s1 = battleReduce(s0, { type: "conv" });
    expect(s1.conviction).toBe(true);
  });

  it("is invalid outside both unlock paths (kit lacks conv, forge not yet fired)", () => {
    const s0 = imposterState({ forgeFired: false }, { hero: { hp: 10, maxHp: 130, mp: 16, maxMp: 16 } });
    const s1 = battleReduce(s0, { type: "conv" });
    expect(s1.events).toEqual([{ type: "invalid", reason: "not in kit" }]);
  });

  it("costs 5 MP and sets conviction true once the mid-fight forge has unlocked it (N10 path a)", () => {
    const s0 = imposterState({ forgeFired: true }, { hero: { hp: 20, maxHp: 130, mp: 16, maxMp: 16 } });
    const s1 = battleReduce(s0, { type: "conv" });
    expect(s1.conviction).toBe(true);
    expect(s1.hero.mp).toBe(16 - 5 + 1);
  });

  it("persists once active even after healing back above the threshold (N10)", () => {
    const s0 = imposterState({ forgeFired: true }, { hero: { hp: 20, maxHp: 130, mp: 16, maxMp: 16 } });
    const s1 = battleReduce(s0, { type: "conv" });
    expect(s1.conviction).toBe(true);
    const s2 = battleReduce(s1, { type: "rb" }); // heals well past the 32-hp threshold
    expect(s2.hero.hp).toBeGreaterThan(32);
    expect(s2.conviction).toBe(true); // still persists
  });
});

describe("N5: the mid-fight Conviction forge (dissect pass 2)", () => {
  it("fires forge: conviction exactly on the turn hp crosses <=50%, not on a later hit", () => {
    const s0 = imposterState({ hp: 100 }); // 100 > 90 (half of 180)
    const s1 = battleReduce(s0, { type: "rc", target: 0 }); // 22 dmg -> 78, crosses <=90
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(78);
    expect(s1.boss.forgeFired).toBe(true);
    expect(s1.events.some((e) => e.type === "forge" && e.ability === "conviction")).toBe(true);

    const s2 = battleReduce(s1, { type: "rc", target: 0 });
    expect(s2.events.some((e) => e.type === "forge" && e.ability === "conviction")).toBe(false);
  });
});

describe("conviction doubles every ability's constant (§Multipliers) — reducer level", () => {
  it("PT under both CT and conviction deals 112 (reducer level — a helper-level test is exactly what let this gap hide)", () => {
    const s0 = imposterState({}, { ctTurns: 3, conviction: true, hero: { hp: 130, maxHp: 130, mp: 16, maxMp: 16 } });
    const s1 = battleReduce(s0, { type: "pt", target: 0 }); // 0 is real (default seed)
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg?.amount).toBe(112); // 28 * 2 (conviction) * 2.0 (ct+conviction) = 112
  });

  it("Rollback heals 60 under conviction (doubled constant, no CT interaction)", () => {
    const s0 = imposterState({}, { conviction: true, hero: { hp: 50, maxHp: 130, mp: 16, maxMp: 16 } });
    const s1 = battleReduce(s0, { type: "rb" });
    // 50 + 60 = 110, then the boss's own clones-phase slash (14, un-CT'd) lands
    expect(s1.hero.hp).toBe(110 - 14);
  });

  it("a DoT already running before Conviction activates keeps ticking 4, not 8, even after activation (carried-forward from task 3)", () => {
    const s0 = imposterState(
      { forgeFired: true },
      { hero: { hp: 30, maxHp: 130, mp: 16, maxMp: 16 }, dots: [{ batId: 0, ticksLeft: 3, tick: 4 }] },
    );
    // Activates conviction mid-call; the PRE-EXISTING dot still ticks THIS
    // same call, at its stamped value — never recomputed from the flag that
    // just flipped.
    const s1 = battleReduce(s0, { type: "conv" });
    expect(s1.conviction).toBe(true);
    const dot1 = s1.events.find((e) => e.type === "dot");
    expect(dot1).toEqual({ type: "dot", batId: 0, amount: 4 });

    const s2 = battleReduce(s1, { type: "attack", target: 0 }); // one more turn, conviction now active throughout
    const dot2 = s2.events.find((e) => e.type === "dot");
    expect(dot2).toEqual({ type: "dot", batId: 0, amount: 4 }); // still 4 — stamped at push time, never recomputed
  });

  it("a DoT started AFTER Conviction activates ticks 8 (stamped at push time)", () => {
    const s0 = imposterState({}, { conviction: true, hero: { hp: 130, maxHp: 130, mp: 16, maxMp: 16 } });
    const s1 = battleReduce(s0, { type: "debug", target: 0 });
    expect(s1.dots).toEqual([{ batId: 0, ticksLeft: 3, tick: 8 }]);
  });
});

describe("E8: CLONES pop vs a real hit — wasPop derived at the call site, never inferred from amount===0", () => {
  it("a hit against a non-real slot pops it: wasPop true, zero damage, no mark, no DoT (N6)", () => {
    const s0 = imposterState({ realIndex: 0 });
    const s1 = battleReduce(s0, { type: "debug", target: 1 }); // slot 1 is NOT real
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180); // untouched
    expect(s1.boss.marked).toBe(false); // no mark applied
    expect(s1.dots).toEqual([]); // no DoT started
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg).toEqual({ type: "damage", batId: 1, amount: 0, wasPop: true });
  });

  it("a hit against the real slot lands normally: wasPop false, damage applied, mark + DoT started", () => {
    const s0 = imposterState({ realIndex: 0 });
    const s1 = battleReduce(s0, { type: "debug", target: 0 });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 6);
    expect(s1.boss.marked).toBe(true);
    expect(s1.dots).toEqual([{ batId: 0, ticksLeft: 3, tick: 4 }]);
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg).toEqual({ type: "damage", batId: 0, amount: 6, wasPop: false });
  });

  it("Fan Out vs clones hits all three: both non-real slots pop (wasPop true, zero), the real slot takes 8 (pass-2 G8, DECIDED not accidental)", () => {
    const s0 = imposterState({ realIndex: 1 });
    const s1 = battleReduce(s0, { type: "fo" });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 8);
    const damageEvents = s1.events.filter((e) => e.type === "damage");
    expect(damageEvents).toEqual([
      { type: "damage", batId: 0, amount: 0, wasPop: true },
      { type: "damage", batId: 1, amount: 8 },
      { type: "damage", batId: 2, amount: 0, wasPop: true },
    ]);
  });

  it("Fan Out against Imposter outside CLONES deals a plain 8 to the single target", () => {
    const s0 = imposterState({ phase: "pulse", phaseTurnsLeft: 2, pulseCharged: false });
    const s1 = battleReduce(s0, { type: "fo" });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 8);
    const damageEvents = s1.events.filter((e) => e.type === "damage");
    expect(damageEvents).toEqual([{ type: "damage", batId: 0, amount: 8 }]);
  });
});

describe("N4: Debug during an unfired PULSE charge breaks it, consuming the mark", () => {
  it("breaks the pulse: the mark is consumed and the remaining turn fizzles to the plain slash", () => {
    const s0 = imposterState({ phase: "pulse", phaseTurnsLeft: 1, pulseCharged: true, marked: true });
    const s1 = battleReduce(s0, { type: "debug", target: 0 });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.marked).toBe(false); // consumed by the break, even though this same cast just re-marked it
    expect(s1.boss.phase).toBe("vanish"); // the fizzle turn still counts down and crosses the phase boundary
    const heroDmg = s1.events.find((e) => e.type === "heroDamage");
    expect(heroDmg?.amount).toBe(14); // fizzles to the plain glitch slash, not the 26 pulse fire
  });
});

describe("E6: hero-side mark/DoT from the Imposter's mirrored Debug", () => {
  it("MIRROR mirrors Debug: hero takes 3 dmg, gets marked, and a hero DoT starts (ticks next turn, not this one)", () => {
    const s0 = imposterState({ phase: "mirror", phaseTurnsLeft: 1, lastSpecial: null });
    const s1 = battleReduce(s0, { type: "debug", target: 0 }); // this same cast is what MIRROR mirrors
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.phase).toBe("clones"); // mirror always resolves and advances
    expect(s1.heroMarked).toBe(true);
    expect(s1.heroDots).toEqual([{ ticksLeft: 3 }]);
    const heroDmg = s1.events.find((e) => e.type === "heroDamage");
    expect(heroDmg?.amount).toBe(3); // half of Debug's 6, never mirror-CT-boosted
  });

  it("the hero DoT ticks on subsequent boss turns, flat 2 dmg, never CT/conviction-scaled", () => {
    const s0 = imposterState({ phase: "mirror", phaseTurnsLeft: 1, lastSpecial: null });
    const s1 = battleReduce(s0, { type: "debug", target: 0 });
    expect(s1.heroDots).toEqual([{ ticksLeft: 3 }]);
    const s2 = battleReduce(s1, { type: "attack", target: 0 }); // clones now — attack never updates lastSpecial
    if (s2.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s2.heroDots).toEqual([{ ticksLeft: 2 }]);
    const heroDmg = s2.events.find((e) => e.type === "heroDamage");
    expect(heroDmg?.amount).toBe(16); // 14 (clones slash) + 2 (hero DoT tick)
  });

  it("Rollback cleanses the hero mark and DoT together", () => {
    const s0 = imposterState({ phase: "mirror", phaseTurnsLeft: 1, lastSpecial: null });
    const s1 = battleReduce(s0, { type: "debug", target: 0 });
    expect(s1.heroMarked).toBe(true);
    expect(s1.heroDots).toEqual([{ ticksLeft: 3 }]);
    const s2 = battleReduce(s1, { type: "rb" });
    expect(s2.heroMarked).toBe(false);
    expect(s2.heroDots).toEqual([]);
  });
});

describe("E8: DoT anchoring crosses CLONES phase boundaries — reducer level (carried-forward from task 3)", () => {
  it("a DoT already running keeps ticking as the boss transitions INTO clones", () => {
    const s0 = imposterState(
      { phase: "mirror", phaseTurnsLeft: 1, lastSpecial: null },
      { dots: [{ batId: 0, ticksLeft: 3, tick: 4 }] },
    );
    const s1 = battleReduce(s0, { type: "attack", target: 0 }); // mirror resolves this turn -> advances to clones
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.phase).toBe("clones");
    expect(s1.events.find((e) => e.type === "dot")).toEqual({ type: "dot", batId: 0, amount: 4 });
    expect(s1.dots).toEqual([{ batId: 0, ticksLeft: 2, tick: 4 }]);

    // second turn: now IN clones — the dot keeps ticking exactly the same
    // way, never popped or otherwise treated specially by the illusion.
    const s2 = battleReduce(s1, { type: "attack", target: s1.boss.realIndex ?? 0 });
    if (s2.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s2.boss.phase).toBe("clones");
    expect(s2.events.find((e) => e.type === "dot")).toEqual({ type: "dot", batId: 0, amount: 4 });
    expect(s2.dots).toEqual([{ batId: 0, ticksLeft: 1, tick: 4 }]);
  });

  it("a DoT anchored during CLONES keeps ticking after the phase leaves CLONES", () => {
    const s0 = imposterState({ phase: "clones", phaseTurnsLeft: 1 }, { dots: [{ batId: 0, ticksLeft: 3, tick: 4 }] });
    const s1 = battleReduce(s0, { type: "attack", target: 0 }); // clones boundary -> advances to pulse
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.phase).toBe("pulse");
    expect(s1.events.find((e) => e.type === "dot")).toEqual({ type: "dot", batId: 0, amount: 4 });

    const s2 = battleReduce(s1, { type: "ct" });
    if (s2.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s2.boss.phase).toBe("pulse"); // still charging (a 2-turn phase)
    expect(s2.events.find((e) => e.type === "dot")).toEqual({ type: "dot", batId: 0, amount: 4 });
    expect(s2.dots).toEqual([{ batId: 0, ticksLeft: 1, tick: 4 }]);
  });
});

describe("Imposter victory: no forge ability (the rush order ends here); unlock + rider still fire", () => {
  it("defeating the Imposter emits victory + unlock + rider, but no forge event", () => {
    const s0 = imposterState({ hp: 5 }); // any lethal hit finishes it
    const s1 = battleReduce(s0, { type: "rc", target: 0 }); // 22 >> 5
    expect(s1.status).toBe("victory");
    expect(s1.events.some((e) => e.type === "unlock" && e.id === "imposter-syndrome")).toBe(true);
    expect(s1.events.some((e) => e.type === "rider")).toBe(true);
    expect(s1.events.some((e) => e.type === "forge")).toBe(false);
  });
});

describe("engine.ts real coverage gaps (Imposter) — E2 discipline: every new branch this task added gets a test", () => {
  it("an invalid target id (findTarget's undefined branch) is rejected", () => {
    const s0 = imposterState({ phase: "pulse" }); // livingTargets = [0] only
    const s1 = battleReduce(s0, { type: "pt", target: 5 });
    expect(s1.events).toEqual([{ type: "invalid", reason: "invalid target" }]);
  });

  it("attack whiffs against a vanished (untargetable) Imposter: 0 dealt, no MP gain (D2)", () => {
    const s0 = imposterState({ phase: "vanish" });
    const s1 = battleReduce(s0, { type: "attack", target: 0 });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180); // whiffed
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg).toEqual({ type: "damage", batId: 0, amount: 0, wasPop: false });
    expect(s1.hero.mp).toBe(16); // no +1-on-hit (it whiffed); end-of-turn regen caps back at max
  });

  it("a lethal Debug hit through dealSingleTarget fires batDown (not just rc's own bypass path)", () => {
    const s0 = imposterState({ hp: 5 });
    const s1 = battleReduce(s0, { type: "debug", target: 0 });
    expect(s1.status).toBe("victory");
    expect(s1.events.some((e) => e.type === "batDown" && e.batId === 0)).toBe(true);
  });

  it("rc falls back to the targeted slot id when realIndex is null (defensive — never null in practice)", () => {
    const s0 = imposterState({ realIndex: null });
    const s1 = battleReduce(s0, { type: "rc", target: 1 });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 22);
    const dmg = s1.events.find((e) => e.type === "damage");
    expect(dmg).toEqual({ type: "damage", batId: 1, amount: 22 });
  });

  it("fo falls back to slot 0 when realIndex is null during CLONES (defensive — never null in practice)", () => {
    const s0 = imposterState({ realIndex: null });
    const s1 = battleReduce(s0, { type: "fo" });
    if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(180 - 8);
    const real = s1.events.find((e) => e.type === "damage" && e.amount === 8);
    if (!real || real.type !== "damage") throw new Error("unreachable");
    expect(real.batId).toBe(0);
  });

  it("a lethal Fan Out fires batDown on the real slot", () => {
    const s0 = imposterState({ hp: 5, realIndex: 1 });
    const s1 = battleReduce(s0, { type: "fo" });
    expect(s1.status).toBe("victory");
    expect(s1.events.some((e) => e.type === "batDown" && e.batId === 1)).toBe(true);
  });

  it("a lethal DoT tick fires batDown from the tick loop", () => {
    const s0 = imposterState({ hp: 3 }, { dots: [{ batId: 0, ticksLeft: 2, tick: 4 }] });
    const s1 = battleReduce(s0, { type: "ct" }); // untargeted, isolates the tick
    expect(s1.status).toBe("victory");
    expect(s1.events.some((e) => e.type === "batDown" && e.batId === 0)).toBe(true);
  });
});

describe("Imposter boot + engine-generated win line (M6 PR-3 task 5)", () => {
  it('initBattle boots boss: "imposter-syndrome" on request: opens in CLONES at full 180/180, unmarked, no forge/degeneration yet', () => {
    const s = initBattle({
      seed: 42,
      boss: "imposter-syndrome",
      defeatedBosses: ["alert-storm", "cascade", "silent-failure"],
    });
    expect(s.boss.kind).toBe("imposter-syndrome");
    if (s.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
    expect(s.boss.hp).toBe(180);
    expect(s.boss.maxHp).toBe(180);
    expect(s.boss.phase).toBe("clones");
    expect(s.boss.phaseTurnsLeft).toBe(2);
    expect(s.boss.marked).toBe(false);
    expect(s.boss.degenerate).toBe(false);
    expect(s.boss.forgeFired).toBe(false);
    expect(s.boss.realIndex).not.toBeNull();
  });

  it("hero arrives at the signed 130/16 with Root Cause in kit (defeatedBosses: alert-storm + cascade + silent-failure)", () => {
    const s = initBattle({
      seed: 42,
      boss: "imposter-syndrome",
      defeatedBosses: ["alert-storm", "cascade", "silent-failure"],
    });
    expect(s.hero).toEqual({ hp: 130, maxHp: 130, mp: 16, maxMp: 16 });
    expect(deriveKit(s.defeatedBosses)).toContain("rc");
  });

  describe("action tokens (bootParams.ts §actions=): rc:<id> / conv now parse (M6 PR-3 task 5)", () => {
    // engine.test.ts owns the reducer-level shape; bootParams.test.ts owns the
    // string-parsing contract. Covered here too because the reducer is what
    // actually consumes the parsed shape end to end.
    it("rc with a target reaches the reducer and resolves", () => {
      const s0 = imposterState();
      const s1 = battleReduce(s0, { type: "rc", target: 0 });
      if (s1.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
      expect(s1.boss.hp).toBe(180 - 22);
    });

    it("conv without the gate met (hp*4 > maxHp) is rejected as invalid, same rejection path a garbage token's absence would leave silent", () => {
      // forgeFired:true unlocks conv via the mid-fight N10(a) channel (kit
      // derivation off defeatedBosses would ALSO reject this as "not in
      // kit" first — this isolates the gate check itself).
      const s0 = imposterState({ forgeFired: true });
      const s1 = battleReduce(s0, { type: "conv" });
      expect(s1.events).toEqual([{ type: "invalid", reason: "conviction gate not met" }]);
    });
  });

  describe("the engine-generated win line (the plan's hand-derivation was illegal at H5 against the shipped phase-transition timing — VANISH's untargetable gate, the SAME signed rule Silent Failure's own PT/PT/whiff/CT/PT/PT line already demonstrates, rejects PT the instant PULSE's fire crosses the phase boundary INSIDE that same reducer call, one turn earlier than the hand-derivation assumed. This is the corrected, empirically re-derived line — not a hand-pinned literal sequence: it runs through the real reducer and asserts OBSERVED facts, per standing rule F1)", () => {
    function winLine() {
      let s = initBattle({
        seed: 42,
        boss: "imposter-syndrome",
        defeatedBosses: ["alert-storm", "cascade", "silent-failure"],
      });
      if (s.boss.kind !== "imposter-syndrome") throw new Error("unreachable");
      const realIndex = s.boss.realIndex ?? 0; // seeded at spawn, never reseeds this fight

      // H1 attack (real slot, clones) · H2 rc (clones->pulse, ignores the
      // illusion) · H3 ct (buff window) · H4 pt (pulse fires -> vanish) ·
      // H5 ct (re-cast, covers the vanish ambush + the rip-back turn) ·
      // H6 rc (rips the vanish; the <=50% crossing fires here too) ·
      // H7 debug (marks the boss; mirror fires, mirroring Debug) ·
      // H8 rc (the marked-target payoff: 33 vs the plain 22) ·
      // H9 attack (mirror fires again, mirroring rc) · H10 attack (lethal,
      // real slot).
      const ACTIONS: BattleAction[] = [
        { type: "attack", target: realIndex },
        { type: "rc", target: 0 },
        { type: "ct" },
        { type: "pt", target: 0 },
        { type: "ct" },
        { type: "rc", target: 0 },
        { type: "debug", target: 0 },
        { type: "rc", target: 0 },
        { type: "attack", target: 0 },
        { type: "attack", target: realIndex },
      ];

      const phasesSeen = new Set<string>();
      let invalidCount = 0;
      let mirrorFired = 0;
      let pulseFired = false;
      let vanishRippedByRc = false;
      let degenerateReached = false;
      let forgeCrossingSeen = false;
      let unlockSeen = false;
      let victorySeen = false;
      phasesSeen.add(s.boss.phase);
      for (const action of ACTIONS) {
        if (s.status !== "active") break;
        const prePhase = s.boss.kind === "imposter-syndrome" ? s.boss.phase : undefined;
        s = battleReduce(s, action);
        // Each battleReduce call replaces `events` with just THIS call's log
        // (never accumulates) — every event-based fact must be captured
        // turn-by-turn here, not read off the final state's events array.
        if (s.events.some((e) => e.type === "invalid")) invalidCount++;
        if (s.events.some((e) => e.type === "forge" && e.ability === "conviction")) forgeCrossingSeen = true;
        if (s.events.some((e) => e.type === "unlock" && e.id === "imposter-syndrome")) unlockSeen = true;
        if (s.events.some((e) => e.type === "victory")) victorySeen = true;
        if (s.boss.kind === "imposter-syndrome") {
          phasesSeen.add(s.boss.phase);
          if (s.boss.degenerate) degenerateReached = true;
          // "fired", not just charged: PULSE's charge turn always deals 0;
          // only the fire turn deals a nonzero hit.
          if (prePhase === "pulse" && s.events.some((e) => e.type === "heroDamage" && e.amount > 0)) {
            pulseFired = true;
          }
          // MIRROR's own boss turn resolves against whatever phase was
          // current at the START of the call (rc's rip-back is the only
          // action that changes phase mid-call, and it only ever fires from
          // "vanish", never from "mirror" — so this is unambiguous here).
          if (prePhase === "mirror") mirrorFired++;
        }
        if (prePhase === "vanish" && action.type === "rc") vanishRippedByRc = true;
      }
      return {
        s,
        phasesSeen,
        invalidCount,
        mirrorFired,
        pulseFired,
        vanishRippedByRc,
        degenerateReached,
        forgeCrossingSeen,
        unlockSeen,
        victorySeen,
      };
    }

    it("every action is legal (zero invalid events) and MP-feasible throughout", () => {
      const { invalidCount } = winLine();
      expect(invalidCount).toBe(0);
    });

    it("reaches victory within the signed 9-14 hero-turn band (N12), entering every phase — clones opened, pulse FIRED, vanish entered and ripped back by Root Cause, mirror fired at least twice — the forge crossing and degeneration both reached", () => {
      const { s, phasesSeen, mirrorFired, pulseFired, vanishRippedByRc, degenerateReached, forgeCrossingSeen } =
        winLine();
      expect(s.status).toBe("victory");
      expect(s.turn).toBeGreaterThanOrEqual(9);
      expect(s.turn).toBeLessThanOrEqual(14);
      expect(phasesSeen.has("clones")).toBe(true);
      expect(phasesSeen.has("pulse")).toBe(true);
      expect(phasesSeen.has("vanish")).toBe(true);
      expect(phasesSeen.has("mirror")).toBe(true);
      expect(pulseFired).toBe(true);
      expect(vanishRippedByRc).toBe(true);
      expect(mirrorFired).toBeGreaterThanOrEqual(2);
      expect(degenerateReached).toBe(true);
      expect(forgeCrossingSeen).toBe(true);
      expect(s.hero.hp).toBeGreaterThan(0);
    });

    it("emits victory + unlock=imposter-syndrome (no post-defeat forge — N14/the rush order ends here), and the final state's defeatedBosses covers RUSH_ORDER — the named M4 full-clear contract, no invented event", () => {
      const { s, unlockSeen, victorySeen } = winLine();
      expect(victorySeen).toBe(true);
      expect(unlockSeen).toBe(true);
      // No post-defeat forge for Imposter (N14) — the mid-fight "forge:
      // conviction" crossing event (asserted above) is a different channel
      // entirely and already fired earlier in this same run.
      expect(s.events.some((e) => e.type === "forge" && e.ability !== "conviction")).toBe(false);
      for (const bossId of RUSH_ORDER) {
        expect(s.defeatedBosses).toContain(bossId);
      }
    });
  });
});
