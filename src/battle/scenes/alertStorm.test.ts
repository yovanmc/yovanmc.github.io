// M6 PR-1a task 6 — Alert Storm scene module (moved verbatim from
// BattleScene.tsx's inline composeSwarm + JSX copy literals).
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md
import { describe, expect, it } from "vitest";
import { initBattle } from "../engine";
import type { Bat } from "../engine";
import type { AlertStormBoss } from "../bosses/alertStorm";
import { newG, EROWS, ECOLS } from "../../generated/bossAlertStorm";
import { alertStormScene, plotMarkChevron } from "./alertStorm";

function makeBat(overrides: Partial<Bat> = {}): Bat {
  return { id: 0, hp: 60, maxHp: 60, real: true, marked: false, alive: true, pos: 0, ...overrides };
}

/** `composeBoss` takes the whole `BossState` as of M6 PR-1b — wraps a bare
 * bats array the same way `alertStormScene`'s own callers do. */
function bossOf(bats: Bat[]): AlertStormBoss {
  return { kind: "alert-storm", bats };
}

describe("alertStormScene.composeBoss", () => {
  it("returns an EROWS x ECOLS grid for an empty swarm", () => {
    const g = alertStormScene.composeBoss(bossOf([]), false, 0, {});
    expect(g.length).toBe(EROWS);
    expect(g[0].length).toBe(ECOLS);
  });

  it("draws the real bat red and a fake bat hollow while screaming, marks the fake, no jitter/fall/dither", () => {
    const bats = [
      makeBat({ id: 0, pos: 0, real: true, marked: false }),
      makeBat({ id: 1, pos: 1, real: false, marked: true }),
    ];
    const g = alertStormScene.composeBoss(bossOf(bats), true, 0, { jitter: true, fall: 0, dither: 0 });
    // pos 1 -> SWARM[1] = [4,30,1]; mark chevron at mr=4-2-2=0 (jr=JIT[1][0]=-2, dr=0), mc=30+1+6=37
    expect(g[0][37]).toBe("k");
    expect(g[1][38]).toBe("k");
    expect(g[0][39]).toBe("k");
  });

  it("skips the mark chevron for an unmarked bat and stitches the mouth when not screaming", () => {
    const bats = [makeBat({ id: 0, pos: 0, real: true, marked: false })];
    const withFallAndDither = alertStormScene.composeBoss(bossOf(bats), false, 1, { jitter: false, fall: 5, dither: 2 });
    const bare = alertStormScene.composeBoss(bossOf(bats), false, 1, {});
    expect(withFallAndDither.length).toBe(EROWS);
    // fall + dither changes the composed frame vs the bare call
    expect(JSON.stringify(withFallAndDither)).not.toBe(JSON.stringify(bare));
  });

  it("applies the scream ripple overlay on top of the composed frame", () => {
    const withRipple = alertStormScene.composeBoss(bossOf([]), false, 0, { ripple: 1 });
    const without = alertStormScene.composeBoss(bossOf([]), false, 0, {});
    expect(JSON.stringify(withRipple)).not.toBe(JSON.stringify(without));
  });

  it("falls back to an empty swarm if ever invoked with a non-alert-storm boss (defensive only — unreachable in practice)", () => {
    const cascadeBoss = initBattle({ seed: 42, boss: "cascade" }).boss;
    const g = alertStormScene.composeBoss(cascadeBoss, false, 0, {});
    expect(g.length).toBe(EROWS);
    expect(g.every((row) => row.every((c) => c === null || c === undefined))).toBe(true);
  });
});

describe("plotMarkChevron (mark-chevron bounds guard)", () => {
  it("plots all three cells when fully in bounds", () => {
    const g = newG();
    plotMarkChevron(g, 10, 10);
    expect(g[10][10]).toBe("k");
    expect(g[11][11]).toBe("k");
    expect(g[10][12]).toBe("k");
  });

  it("drops cells whose row goes negative", () => {
    const g = newG();
    plotMarkChevron(g, -5, 10);
    for (const row of g) expect(row.includes("k")).toBe(false);
  });

  it("drops cells whose row overflows EROWS", () => {
    const g = newG();
    plotMarkChevron(g, EROWS + 5, 10);
    for (const row of g) expect(row.includes("k")).toBe(false);
  });

  it("drops cells whose column goes negative", () => {
    const g = newG();
    plotMarkChevron(g, 10, -3);
    for (const row of g) expect(row.includes("k")).toBe(false);
  });

  it("drops cells whose column overflows ECOLS", () => {
    const g = newG();
    plotMarkChevron(g, 10, ECOLS + 5);
    for (const row of g) expect(row.includes("k")).toBe(false);
  });
});

describe("alertStormScene.plate", () => {
  it("labels the boss and formats the living-count footer", () => {
    expect(alertStormScene.plate.label).toBe("ALERT STORM");
    expect(alertStormScene.plate.hiddenLabel).toBe("?? · DEBUG THE SCREAMER");
    expect(alertStormScene.plate.footer(7)).toBe("7/10 SIGNALS");
  });
});

describe("alertStormScene.banner", () => {
  it("shows the scream banner only on an active scream turn", () => {
    let s = initBattle({ seed: 42 });
    s = { ...s, turn: 3, status: "active" }; // isScreamTurn: turn % 3 === 0
    expect(alertStormScene.banner(s)).toBe("THE SWARM SCREAMS · ONE VOICE RUNS RED");
  });

  it("is empty on a non-scream active turn", () => {
    let s = initBattle({ seed: 42 });
    s = { ...s, turn: 1, ctTurns: 0, status: "active" };
    expect(alertStormScene.banner(s)).toBe("");
  });

  it("is empty once the battle is no longer active, even on a scream-turn number", () => {
    let s = initBattle({ seed: 42 });
    s = { ...s, turn: 3, status: "victory" };
    expect(alertStormScene.banner(s)).toBe("");
  });
});
