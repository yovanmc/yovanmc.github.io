import { describe, expect, it } from "vitest";
import {
  isTargetable,
  livingTargets,
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
  it.each([
    { name: "is [0] on a fresh boss", boss: spawnSilentFailure(), expected: [SF_TARGET_ID] },
    { name: "is [] once hp hits 0", boss: { ...spawnSilentFailure(), hp: 0 } as SilentFailureBoss, expected: [] },
  ])("$name", ({ boss, expected }) => {
    expect(livingTargets(boss)).toEqual(expected);
  });
});

describe("isTargetable: the armor stays selectable, but only embodied is targetable", () => {
  it.each([
    { name: "true while embodied", boss: spawnSilentFailure(), expected: true },
    { name: "false while vanished", boss: { ...spawnSilentFailure(), phase: "vanished" } as SilentFailureBoss, expected: false },
  ])("$name", ({ boss, expected }) => {
    expect(isTargetable(boss)).toBe(expected);
  });
});

describe("resolveSilentFailureBossTurn: swing 12 (CT -> 9), ambush 18 (CT -> 14)", () => {
  const vanishedBoss: SilentFailureBoss = { ...spawnSilentFailure(), phase: "vanished", phaseTurnsLeft: 2 };

  it.each([
    { name: "embodied, uncT'd: swing 12, phaseTurnsLeft ticks down, stays embodied", boss: spawnSilentFailure(), ct: false, conviction: false, outcome: "swing", damage: 12, phase: "embodied" },
    { name: "embodied, CT'd: takenDamage(12, true, false) = round(9) = 9", boss: spawnSilentFailure(), ct: true, conviction: false, outcome: "swing", damage: 9, phase: "embodied" },
    { name: "vanished, uncT'd: ambush 18, phaseTurnsLeft ticks down, stays vanished", boss: vanishedBoss, ct: false, conviction: false, outcome: "ambush", damage: 18, phase: "vanished" },
    { name: "vanished, CT'd: takenDamage(18, true, false) = round(13.5) = 14", boss: vanishedBoss, ct: true, conviction: false, outcome: "ambush", damage: 14, phase: "vanished" },
    { name: "Conviction alone (no CT) changes nothing on the taken side (Conviction only ever replaces CT's percentage)", boss: spawnSilentFailure(), ct: false, conviction: true, outcome: "swing", damage: 12, phase: "embodied" },
    { name: "CT + Conviction: takenDamage(12, true, true) = round(6) = 6 (0.5 taken mult)", boss: spawnSilentFailure(), ct: true, conviction: true, outcome: "swing", damage: 6, phase: "embodied" },
  ])("$name", ({ boss, ct, conviction, outcome, damage, phase }) => {
    const result = resolveSilentFailureBossTurn(boss, ct, conviction);
    expect(result.outcome).toBe(outcome);
    expect(result.heroDamage).toBe(damage);
    expect(result.boss.phase).toBe(phase);
    expect(result.boss.phaseTurnsLeft).toBe(1);
  });
});

describe("cycle resolution — the CT-extension rule (window-end check reads ct BEFORE the engine's own end-of-turn decrement)", () => {
  it("CT cast on the LAST vanish turn: ct is still active at the following window's natural end -> extends to a 3rd embodied turn", () => {
    // The last base embodied turn. Models CT cast on the last vanish turn: it
    // is still active when this window-end check runs.
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
