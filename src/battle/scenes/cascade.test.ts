// The Cascade's scene module (M6 plan §Renderer strategy Cascade, PR-1b task
// 4): banner telegraph threshold (incl. the CT extra-turn rule), composeBoss
// dispatch, and the static module shape (arena/plate/reels/copy).
import { describe, expect, it } from "vitest";
import { initBattle } from "../engine";
import { EROWS, ECOLS } from "../../generated/bossCascade";
import { SR, SC } from "../../generated/battlefieldScene";
import { cascadeScene } from "./cascade";

describe("cascadeScene.banner — storm telegraph (stormIn threshold, CT shows one turn earlier)", () => {
  it("is empty when the storm is more than 1 turn away, CT down", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    expect(s.boss.stormIn).toBe(2); // fresh spawn: 2 turns to storm
    expect(cascadeScene.banner(s)).toBe("");
  });

  it("shows the banner when the storm is 1 turn away, CT down", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    const oneAway = { ...s, boss: { ...s.boss, stormIn: 1 } };
    expect(cascadeScene.banner(oneAway)).toBe("THE CHAIN OVERLOADS · A STORM GATHERS");
  });

  it("shows the banner a turn earlier (stormIn 2) while CT is active", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    const ctd = { ...s, ctTurns: 2 }; // fresh spawn stormIn is already 2
    expect(cascadeScene.banner(ctd)).toBe("THE CHAIN OVERLOADS · A STORM GATHERS");
  });

  it("stays empty at stormIn 2 without CT (the CT rule only pulls the threshold in, never pushes it out)", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    expect(cascadeScene.banner(s)).toBe("");
  });

  it("is empty once the battle is no longer active, even mid-telegraph", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    if (s.boss.kind !== "cascade") throw new Error("unreachable");
    const overButTelegraphed = { ...s, status: "victory" as const, boss: { ...s.boss, stormIn: 1 } };
    expect(cascadeScene.banner(overButTelegraphed)).toBe("");
  });

  it("is empty for a non-cascade boss state (defensive — never reached through the registry in practice)", () => {
    const alertState = initBattle({ seed: 42 });
    expect(cascadeScene.banner(alertState)).toBe("");
  });
});

describe("cascadeScene.composeBoss", () => {
  it("composes an EROWS x ECOLS grid for a cascade boss", () => {
    const s = initBattle({ seed: 42, boss: "cascade" });
    const g = cascadeScene.composeBoss(s.boss, false, 0, {});
    expect(g.length).toBe(EROWS);
    expect(g[0].length).toBe(ECOLS);
    expect(g.some((row) => row.some((c) => c !== null))).toBe(true); // not blank
  });

  it("falls back to a blank grid for a non-cascade boss (defensive only)", () => {
    const s = initBattle({ seed: 42 }); // alert-storm
    const g = cascadeScene.composeBoss(s.boss, false, 0, {});
    expect(g.length).toBe(EROWS);
    expect(g.every((row) => row.every((c) => c === null || c === undefined))).toBe(true);
  });
});

describe("cascadeScene — static module shape", () => {
  it("id is \"cascade\" and arena has both flutter phases at full stage size", () => {
    expect(cascadeScene.id).toBe("cascade");
    expect(cascadeScene.arena).toHaveLength(2);
    for (const frame of cascadeScene.arena) {
      expect(frame.length).toBe(SR);
      expect(frame[0].length).toBe(SC);
    }
  });

  it("plate footer formats the living-node count", () => {
    expect(cascadeScene.plate.footer(4)).toBe("4/6 NODES");
  });

  it("exposes the CAS_ATK/CAS_HIT/CAS_DIE reels", () => {
    expect(cascadeScene.reels.attack.length).toBeGreaterThan(0);
    expect(cascadeScene.reels.hit.length).toBeGreaterThan(0);
    expect(cascadeScene.reels.die.length).toBeGreaterThan(0);
  });

  it("victoryCopy names Rollback as the forge (Cascade's kit unlock)", () => {
    expect(cascadeScene.victoryCopy.forgeLines.join(" ")).toContain("ROLLBACK");
  });
});
