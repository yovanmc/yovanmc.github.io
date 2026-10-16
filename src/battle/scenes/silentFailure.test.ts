// The Silent Failure's scene module: SIL_BODY/SIL_EMPTY by phase, SIL_DIE
// once defeated, SIL_ATK on the ambush via fx.ripple.
import { describe, expect, it } from "vitest";
import { battleReduce, initBattle } from "../engine";
import type { BattleState } from "../engine";
import type { SilentFailureBoss } from "../bosses/silentFailure";
import { SF_TARGET_ID, spawnSilentFailure } from "../bosses/silentFailure";
import { EROWS, ECOLS, PIECES, SIL_ATK, SIL_BODY, SIL_DIE, SIL_EMPTY } from "../../generated/bossSilentFailure";
import { SR, SC } from "../../generated/battlefieldScene";
import { deathFrame, silentFailureScene } from "./silentFailure";

function bossOf(overrides: Partial<SilentFailureBoss> = {}): SilentFailureBoss {
  return { ...spawnSilentFailure(), ...overrides };
}

describe("silentFailureScene.composeBoss", () => {
  it("returns an EROWS x ECOLS grid, embodied SIL_BODY, for a fresh spawn", () => {
    const g = silentFailureScene.composeBoss(bossOf(), false, 0, {});
    expect(g.length).toBe(EROWS);
    expect(g[0].length).toBe(ECOLS);
    expect(g).toEqual(SIL_BODY[0]);
  });

  it.each([
    { name: "reads flutter for SIL_BODY's two bob frames while embodied", boss: { phase: "embodied" }, flutter: 1, fx: {}, expected: () => SIL_BODY[1] },
    { name: "selects SIL_EMPTY (untargetable silhouette) while vanished, unmarked, no attack fx", boss: { phase: "vanished" }, flutter: 0, fx: {}, expected: () => SIL_EMPTY[0] },
    { name: "reads flutter for SIL_EMPTY's two bob frames while vanished", boss: { phase: "vanished" }, flutter: 1, fx: {}, expected: () => SIL_EMPTY[1] },
  ] as const)("$name", ({ boss, flutter, fx, expected }) => {
    expect(silentFailureScene.composeBoss(bossOf(boss), false, flutter, fx)).toEqual(expected());
  });

  it("overlays purple motes on SIL_EMPTY when vanished AND marked (Debug betrays position, visual only)", () => {
    const marked = silentFailureScene.composeBoss(bossOf({ phase: "vanished", marked: true }), false, 0, {});
    const unmarked = silentFailureScene.composeBoss(bossOf({ phase: "vanished", marked: false }), false, 0, {});
    expect(JSON.stringify(marked)).not.toBe(JSON.stringify(unmarked));
    // motes use the same "k" palette key as Alert Storm's mark chevron
    expect(marked.some((row) => row.includes("k"))).toBe(true);
    expect(unmarked.some((row) => row.includes("k"))).toBe(false);
  });

  it("never overlays motes while embodied, marked or not (motes are a vanished-phase-only tell)", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "embodied", marked: true }), false, 0, {});
    expect(g).toEqual(SIL_BODY[0]);
    expect(g.some((row) => row.includes("k"))).toBe(false);
  });

  it.each([
    {
      name: "selects a SIL_ATK frame on the vanished-phase ambush when fx.ripple is set (the shell's own boss-volley signal)",
      boss: { phase: "vanished" },
      fx: { ripple: 1 },
      expected: () => SIL_ATK[0][0],
    },
    {
      name: "clamps the SIL_ATK index at the reel's last frame for a large ripple value",
      boss: { phase: "vanished" },
      fx: { ripple: 999 },
      expected: () => SIL_ATK[SIL_ATK.length - 1][0],
    },
    {
      name: "never selects SIL_ATK while embodied, even with fx.ripple set (SIL_ATK is the vanished-phase ambush only)",
      boss: { phase: "embodied" },
      fx: { ripple: 1 },
      expected: () => SIL_BODY[0],
    },
  ] as const)("$name", ({ boss, fx, expected }) => {
    expect(silentFailureScene.composeBoss(bossOf(boss), false, 0, fx)).toEqual(expected());
  });

  it("selects a SIL_DIE frame once defeated, regardless of phase (fx={} -> deathFrame's frame 0)", () => {
    const gEmbodiedDeath = silentFailureScene.composeBoss(bossOf({ phase: "embodied", hp: 0 }), false, 0, {});
    const gVanishedDeath = silentFailureScene.composeBoss(
      bossOf({ phase: "vanished", hp: 0, forceBodyForDeath: true }),
      false,
      0,
      {},
    );
    // fx={} is frame 0: the boss just died and is still whole.
    expect(gEmbodiedDeath).toEqual(SIL_DIE[0][0]);
    expect(gVanishedDeath).toEqual(SIL_DIE[0][0]);
  });

  it("falls back to a blank grid for a non-silent-failure boss", () => {
    const s = initBattle({ seed: 42 }); // alert-storm
    const g = silentFailureScene.composeBoss(s.boss, false, 0, {});
    expect(g.length).toBe(EROWS);
    expect(g.every((row) => row.every((c) => c === null || c === undefined))).toBe(true);
  });
});

describe("silentFailureScene — static module shape", () => {
  it("id is \"silent-failure\" and arena has both flutter phases at full stage size", () => {
    expect(silentFailureScene.id).toBe("silent-failure");
    expect(silentFailureScene.arena).toHaveLength(2);
    for (const frame of silentFailureScene.arena) {
      expect(frame.length).toBe(SR);
      expect(frame[0].length).toBe(SC);
    }
  });

  it("plate footer formats the single-entity living count (1/1 while alive, 0/1 dead)", () => {
    expect(silentFailureScene.plate.footer(1)).toBe("1/1 TARGET");
    expect(silentFailureScene.plate.footer(0)).toBe("0/1 TARGET");
  });

  it("victoryCopy names Root Cause as the forge (Silent Failure's kit unlock)", () => {
    expect(silentFailureScene.victoryCopy.forgeLines.join(" ")).toContain("ROOT CAUSE");
  });
});

describe("silentFailureScene.plate.labelFor (additive, phase-aware)", () => {
  it("shows the boss name while embodied", () => {
    const s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
    expect(silentFailureScene.plate.labelFor?.(s)).toBe(silentFailureScene.plate.label);
  });

  it("shows VANISHED while vanished", () => {
    const s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
    if (s.boss.kind !== "silent-failure") throw new Error("unreachable");
    const vanished = { ...s, boss: { ...s.boss, phase: "vanished" as const } };
    expect(silentFailureScene.plate.labelFor?.(vanished)).toBe("VANISHED");
  });

  it("falls back to the plain label for a non-silent-failure boss state", () => {
    const alertState = initBattle({ seed: 42 });
    expect(silentFailureScene.plate.labelFor?.(alertState)).toBe(silentFailureScene.plate.label);
  });
});

describe("silentFailureScene.banner", () => {
  it("is empty for a silent-failure state (no telegraph/banner mechanic on this boss)", () => {
    const s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
    expect(silentFailureScene.banner(s)).toBe("");
  });

  it("is empty for a non-silent-failure boss state", () => {
    const alertState = initBattle({ seed: 42 });
    expect(silentFailureScene.banner(alertState)).toBe("");
  });
});

describe("moteOverlay anchoring (uses PIECES[0], the helmet box, so motes read as hovering near the head)", () => {
  it("stays within EROWS x ECOLS bounds", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "vanished", marked: true }), false, 0, {});
    const [r1] = PIECES[0];
    expect(r1).toBeGreaterThanOrEqual(0); // sanity: PIECES[0] itself is in-bounds art data
    expect(g.length).toBe(EROWS);
    expect(g[0].length).toBe(ECOLS);
  });
});

describe("composeBoss reachability: a DoT kill while vanished has a real render path", () => {
  it("a Silent Failure killed by a DoT while vanished reaches composeBoss with forceBodyForDeath true, and composeBoss selects SIL_DIE for it", () => {
    // Drives battleReduce, proving the engine's output reaches this scene
    // function end to end.
    const base = initBattle({ seed: 42, defeatedBosses: ["alert-storm", "cascade"] });
    const boss: SilentFailureBoss = {
      ...spawnSilentFailure(),
      phase: "vanished",
      phaseTurnsLeft: 2,
      hp: 4,
      marked: true,
    };
    const s0: BattleState = { ...base, boss, dots: [{ batId: SF_TARGET_ID, ticksLeft: 2, tick: 4 }] };
    const s1 = battleReduce(s0, { type: "ct" }); // no direct damage — only the DoT tick touches boss HP
    if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(0);
    expect(s1.boss.forceBodyForDeath).toBe(true);

    // Checks reachability at the instant of death, not the frame index
    // (deathFrame's own tests cover that).
    const g = silentFailureScene.composeBoss(s1.boss, false, 0, {});
    expect(g).toEqual(SIL_DIE[0][0]);
  });
});

describe("deathFrame", () => {
  it.each([
    { name: "maps the no-signal case (fx={}) to frame 0 — the boss just died, still whole", fx: {}, frame: 0 },
    { name: "maps {ripple: 1} to frame 1", fx: { ripple: 1 }, frame: 1 },
    { name: "maps {ripple: 3} to frame 3 — never the same frame as ripple:1, and never the terminal frame", fx: { ripple: 3 }, frame: 3 },
    {
      name: "maps {fall: 4, dither: 2} to frame 4 — a substantial frame, not the sparse terminal one, even though fx.ripple is absent here",
      fx: { fall: 4, dither: 2 },
      frame: 4,
    },
    {
      name: "maps {fall: 10, dither: 3} — the shell's actual LAST fx step before the victory overlay takes over — to the terminal frame 6, and only that step",
      fx: { fall: 10, dither: 3 },
      frame: 6,
    },
    { name: "treats fall values below 10 the same as fall:4 (threshold, not exact-equality): fall 5 with dither 2", fx: { fall: 5, dither: 2 }, frame: 4 },
    { name: "treats fall values below 10 the same as fall:4 (threshold, not exact-equality): fall 9", fx: { fall: 9 }, frame: 4 },
    { name: "treats fall values at or above 10 as the terminal step regardless of the exact number: fall 10", fx: { fall: 10 }, frame: 6 },
    { name: "treats fall values at or above 10 as the terminal step regardless of the exact number: fall 25", fx: { fall: 25 }, frame: 6 },
    { name: "never returns the terminal frame for a ripple-only fx, no matter how large", fx: { ripple: 999 }, frame: 3 },
  ])("$name", ({ fx, frame }) => {
    expect(deathFrame(fx)).toBe(frame);
  });
});
