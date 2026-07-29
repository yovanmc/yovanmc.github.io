import { describe, expect, it } from "vitest";
import {
  damageSilentFailure,
  isSilentFailureDefeated,
  isTargetable,
  livingTargets,
  markSilentFailure,
  MAX_HP,
  resolveSilentFailureBossTurn,
  SF_TARGET_ID,
  spawnSilentFailure,
} from "./silentFailure";
import type { SilentFailureBoss } from "./silentFailure";

describe("spawnSilentFailure", () => {
  it("spawns at 140/140 HP, unmarked, embodied, a fresh 2-turn window, no extension, no forced death frame", () => {
    const boss = spawnSilentFailure();
    expect(MAX_HP).toBe(140);
    expect(boss.hp).toBe(140);
    expect(boss.maxHp).toBe(140);
    expect(boss.marked).toBe(false);
    expect(boss.phase).toBe("embodied");
    expect(boss.phaseTurnsLeft).toBe(2);
    expect(boss.extendedThisWindow).toBe(false);
    expect(boss.forceBodyForDeath).toBe(false);
  });
});

describe("livingTargets — [0] while alive, [] once dead (single-entity degenerate case)", () => {
  it("is [0] on a fresh boss", () => {
    expect(livingTargets(spawnSilentFailure())).toEqual([SF_TARGET_ID]);
  });

  it("is [] once hp hits 0", () => {
    const dead: SilentFailureBoss = { ...spawnSilentFailure(), hp: 0 };
    expect(livingTargets(dead)).toEqual([]);
  });
});

describe("isTargetable (D2): the armor stays selectable, but only embodied is targetable", () => {
  it("true while embodied", () => {
    expect(isTargetable(spawnSilentFailure())).toBe(true);
  });

  it("false while vanished", () => {
    const vanished: SilentFailureBoss = { ...spawnSilentFailure(), phase: "vanished" };
    expect(isTargetable(vanished)).toBe(false);
  });
});

describe("damageSilentFailure", () => {
  it("subtracts amount from hp", () => {
    const after = damageSilentFailure(spawnSilentFailure(), 40);
    expect(after.hp).toBe(100);
  });

  it("clamps at 0 rather than going negative", () => {
    const after = damageSilentFailure(spawnSilentFailure(), 999);
    expect(after.hp).toBe(0);
  });

  it("is a no-op against an already-dead boss", () => {
    const dead: SilentFailureBoss = { ...spawnSilentFailure(), hp: 0 };
    const after = damageSilentFailure(dead, 40);
    expect(after.hp).toBe(0);
    expect(after).toEqual(dead);
  });
});

describe("markSilentFailure — Debug's mark, permanent for this fight", () => {
  it("sets marked true", () => {
    const after = markSilentFailure(spawnSilentFailure());
    expect(after.marked).toBe(true);
  });

  it("re-marking an already-marked boss is a no-op (still true)", () => {
    const once = markSilentFailure(spawnSilentFailure());
    const twice = markSilentFailure(once);
    expect(twice.marked).toBe(true);
  });
});

describe("resolveSilentFailureBossTurn — signed table: swing 12 (CT -> 9), ambush 18 (CT -> 14)", () => {
  it("embodied, uncT'd: swing 12, phaseTurnsLeft ticks down, stays embodied", () => {
    const { boss, outcome, heroDamage } = resolveSilentFailureBossTurn(spawnSilentFailure(), false, false);
    expect(outcome).toBe("swing");
    expect(heroDamage).toBe(12);
    expect(boss.phase).toBe("embodied");
    expect(boss.phaseTurnsLeft).toBe(1);
  });

  it("embodied, CT'd: takenDamage(12, true, false) = round(9) = 9", () => {
    const { outcome, heroDamage } = resolveSilentFailureBossTurn(spawnSilentFailure(), true, false);
    expect(outcome).toBe("swing");
    expect(heroDamage).toBe(9);
  });

  it("vanished, uncT'd: ambush 18, phaseTurnsLeft ticks down, stays vanished", () => {
    const vanished: SilentFailureBoss = { ...spawnSilentFailure(), phase: "vanished", phaseTurnsLeft: 2 };
    const { boss, outcome, heroDamage } = resolveSilentFailureBossTurn(vanished, false, false);
    expect(outcome).toBe("ambush");
    expect(heroDamage).toBe(18);
    expect(boss.phase).toBe("vanished");
    expect(boss.phaseTurnsLeft).toBe(1);
  });

  it("vanished, CT'd: takenDamage(18, true, false) = round(13.5) = 14", () => {
    const vanished: SilentFailureBoss = { ...spawnSilentFailure(), phase: "vanished", phaseTurnsLeft: 2 };
    const { outcome, heroDamage } = resolveSilentFailureBossTurn(vanished, true, false);
    expect(outcome).toBe("ambush");
    expect(heroDamage).toBe(14);
  });

  it("Conviction alone (no CT) changes nothing on the taken side (Conviction only ever replaces CT's percentage)", () => {
    const { heroDamage } = resolveSilentFailureBossTurn(spawnSilentFailure(), false, true);
    expect(heroDamage).toBe(12);
  });

  it("CT + Conviction: takenDamage(12, true, true) = round(6) = 6 (0.5 taken mult)", () => {
    const { heroDamage } = resolveSilentFailureBossTurn(spawnSilentFailure(), true, true);
    expect(heroDamage).toBe(6);
  });
});

describe("D4 cycle resolution — the CT-extension rule (window-end check reads ct BEFORE the engine's own end-of-turn decrement)", () => {
  it("CT cast on the LAST vanish turn: ct is still active at the following window's natural end -> extends to a 3rd embodied turn", () => {
    // The second (= last, base window is 2) embodied turn: phaseTurnsLeft is
    // about to hit 0. This models "CT cast on the last vanish turn" from the
    // hero's perspective: by the time the SECOND embodied boss-turn's
    // window-end check runs, CT (cast 2 hero-turns earlier) is still active.
    const boundary: SilentFailureBoss = { ...spawnSilentFailure(), phase: "embodied", phaseTurnsLeft: 1 };
    const { boss, outcome } = resolveSilentFailureBossTurn(boundary, true, false);
    expect(outcome).toBe("swing");
    expect(boss.phase).toBe("embodied"); // window EXTENDS, does not flip
    expect(boss.phaseTurnsLeft).toBe(1); // one more embodied turn (turn 3 of 3)
    expect(boss.extendedThisWindow).toBe(true);
  });

  it("CT cast on the FIRST vanish turn: expired by the window-end check (ct=false here) -> extends nothing, flips normally", () => {
    const boundary: SilentFailureBoss = { ...spawnSilentFailure(), phase: "embodied", phaseTurnsLeft: 1 };
    const { boss, outcome } = resolveSilentFailureBossTurn(boundary, false, false);
    expect(outcome).toBe("swing");
    expect(boss.phase).toBe("vanished"); // flips normally, no extension
    expect(boss.phaseTurnsLeft).toBe(2);
    expect(boss.extendedThisWindow).toBe(false);
  });

  it("3-turn cap: the extended (3rd) embodied turn does not extend again even under CT — flips to vanished", () => {
    const extendedTurn: SilentFailureBoss = {
      ...spawnSilentFailure(),
      phase: "embodied",
      phaseTurnsLeft: 1,
      extendedThisWindow: true,
    };
    const { boss, outcome } = resolveSilentFailureBossTurn(extendedTurn, true, false);
    expect(outcome).toBe("swing");
    expect(boss.phase).toBe("vanished");
    expect(boss.phaseTurnsLeft).toBe(2);
    expect(boss.extendedThisWindow).toBe(false); // reset for the next embodied window
  });

  it("vanished windows are always exactly 2 and NEVER extend, even under CT", () => {
    const boundary: SilentFailureBoss = { ...spawnSilentFailure(), phase: "vanished", phaseTurnsLeft: 1 };
    const { boss, outcome } = resolveSilentFailureBossTurn(boundary, true, false);
    expect(outcome).toBe("ambush");
    expect(boss.phase).toBe("embodied"); // flips, does not extend
    expect(boss.phaseTurnsLeft).toBe(2);
    expect(boss.extendedThisWindow).toBe(false);
  });

  it("phase flips across a full two-cycle run (uncT'd throughout): embodied 2, vanished 2, embodied 2, vanished 2", () => {
    let boss = spawnSilentFailure();
    const phases: string[] = [];
    for (let i = 0; i < 8; i++) {
      const result = resolveSilentFailureBossTurn(boss, false, false);
      boss = result.boss;
      phases.push(boss.phase);
    }
    expect(phases).toEqual([
      "embodied", // T1: 2 -> 1
      "vanished", // T2: 1 -> 0, flips
      "vanished", // T3: 2 -> 1
      "embodied", // T4: 1 -> 0, flips
      "embodied", // T5: 2 -> 1
      "vanished", // T6: 1 -> 0, flips
      "vanished", // T7: 2 -> 1
      "embodied", // T8: 1 -> 0, flips
    ]);
    // back to the spawn shape after two full cycles
    expect(boss.phase).toBe("embodied");
    expect(boss.phaseTurnsLeft).toBe(2);
    expect(boss.extendedThisWindow).toBe(false);
  });
});

describe("isSilentFailureDefeated", () => {
  it("false while hp > 0", () => {
    expect(isSilentFailureDefeated(spawnSilentFailure())).toBe(false);
  });

  it("true once hp hits 0", () => {
    const dead: SilentFailureBoss = { ...spawnSilentFailure(), hp: 0 };
    expect(isSilentFailureDefeated(dead)).toBe(true);
  });
});
