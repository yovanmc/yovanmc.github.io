// The Silent Failure's scene module (M6 plan §Renderer strategy Silent
// Failure / §Scene generalization, PR-2 task 6). Mirrors
// scenes/alertStorm.ts's/scenes/cascade.ts's shape behind the same
// `BossSceneModule` interface (./types). Monolithic reels (no per-entity
// state, single boss): SIL_BODY/SIL_EMPTY selected by phase, SIL_DIE once
// defeated (forceBodyForDeath documents why that's still correct for a
// vanished-phase DoT kill), SIL_ATK on the vanished-phase ambush via the
// shell's existing fx.ripple signal (the same field Alert Storm's own
// boss-volley animation already drives — see composeBoss's own doc comment).
// SIL_DIE became reachable through the real shell render pipeline as of task
// 6b's death-reel gate fix (plan §D5a); SIL_HIT still has no fx signal to
// key off (see composeBoss's own comment) and stays unwired.
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

  it("reads flutter for SIL_BODY's two bob frames while embodied", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "embodied" }), false, 1, {});
    expect(g).toEqual(SIL_BODY[1]);
  });

  it("selects SIL_EMPTY (untargetable silhouette) while vanished, unmarked, no attack fx", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "vanished" }), false, 0, {});
    expect(g).toEqual(SIL_EMPTY[0]);
  });

  it("reads flutter for SIL_EMPTY's two bob frames while vanished", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "vanished" }), false, 1, {});
    expect(g).toEqual(SIL_EMPTY[1]);
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

  it("selects a SIL_ATK frame on the vanished-phase ambush when fx.ripple is set (the shell's own boss-volley signal)", () => {
    const g1 = silentFailureScene.composeBoss(bossOf({ phase: "vanished" }), false, 0, { ripple: 1 });
    expect(g1).toEqual(SIL_ATK[0][0]);
  });

  it("clamps the SIL_ATK index at the reel's last frame for a large ripple value", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "vanished" }), false, 0, { ripple: 999 });
    expect(g).toEqual(SIL_ATK[SIL_ATK.length - 1][0]);
  });

  it("never selects SIL_ATK while embodied, even with fx.ripple set (SIL_ATK is the vanished-phase ambush only)", () => {
    const g = silentFailureScene.composeBoss(bossOf({ phase: "embodied" }), false, 0, { ripple: 1 });
    expect(g).toEqual(SIL_BODY[0]);
  });

  it("selects a SIL_DIE frame once defeated, regardless of phase (fx={} -> deathFrame's frame 0, task 6c)", () => {
    const gEmbodiedDeath = silentFailureScene.composeBoss(bossOf({ phase: "embodied", hp: 0 }), false, 0, {});
    const gVanishedDeath = silentFailureScene.composeBoss(
      bossOf({ phase: "vanished", hp: 0, forceBodyForDeath: true }),
      false,
      0,
      {},
    );
    // fx={} is deathFrame's "no signal yet" case — frame 0 (the boss just
    // died, still whole), NOT the sparse terminal frame the pre-task-6c
    // code fell back to here (see deathFrame's own doc comment for why).
    expect(gEmbodiedDeath).toEqual(SIL_DIE[0][0]);
    expect(gVanishedDeath).toEqual(SIL_DIE[0][0]);
  });

  it("falls back to a blank grid for a non-silent-failure boss (defensive only — unreachable through the registry in practice)", () => {
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

describe("silentFailureScene.plate.labelFor (D3 — additive, phase-aware)", () => {
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

  it("falls back to the plain label for a non-silent-failure boss state (defensive only — unreachable through the registry in practice)", () => {
    const alertState = initBattle({ seed: 42 });
    expect(silentFailureScene.plate.labelFor?.(alertState)).toBe(silentFailureScene.plate.label);
  });
});

describe("silentFailureScene.banner", () => {
  it("is empty for a silent-failure state (no telegraph/banner mechanic on this boss)", () => {
    const s = initBattle({ seed: 42, boss: "silent-failure", defeatedBosses: ["alert-storm", "cascade"] });
    expect(silentFailureScene.banner(s)).toBe("");
  });

  it("is empty for a non-silent-failure boss state (defensive — the punctuation gate calls every registered module's banner against an ALERT-STORM state)", () => {
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

describe("composeBoss reachability: the signed DoT-kill-while-vanished ruling has a real render path now (M6 PR-2 task 6b)", () => {
  it("a Silent Failure killed by a DoT while vanished reaches composeBoss with forceBodyForDeath true, and composeBoss selects SIL_DIE for it", () => {
    // Same rig as engine.test.ts's own "vanished: forceBodyForDeath becomes
    // true" test (battleReduce, not a hand-built boss) — this test's whole
    // point is proving the ENGINE's output actually reaches this SCENE
    // function end to end, not re-testing either piece in isolation again.
    const base = initBattle({ seed: 42, defeatedBosses: ["alert-storm", "cascade"] });
    const boss: SilentFailureBoss = {
      ...spawnSilentFailure(),
      phase: "vanished",
      phaseTurnsLeft: 2,
      hp: 4,
      marked: true,
    };
    const s0: BattleState = { ...base, boss, dots: [{ batId: SF_TARGET_ID, ticksLeft: 2 }] };
    const s1 = battleReduce(s0, { type: "ct" }); // no direct damage — only the DoT tick touches boss HP
    if (s1.boss.kind !== "silent-failure") throw new Error("unreachable");
    expect(s1.boss.hp).toBe(0);
    expect(s1.boss.forceBodyForDeath).toBe(true);

    // fx={} at the moment of death is deathFrame's frame-0 case (task 6c) —
    // reachability at this instant is the point of this test, not the
    // specific frame index (that's deathFrame's own describe block below).
    const g = silentFailureScene.composeBoss(s1.boss, false, 0, {});
    expect(g).toEqual(SIL_DIE[0][0]);
  });
});

describe("deathFrame (M6 PR-2 task 6c, D5a follow-up — the fx.ripple dead-end bug)", () => {
  it("maps the no-signal case (fx={}) to frame 0 — the boss just died, still whole", () => {
    expect(deathFrame({})).toBe(0);
  });

  it("maps {ripple: 1} to frame 1", () => {
    expect(deathFrame({ ripple: 1 })).toBe(1);
  });

  it("maps {ripple: 3} to frame 3 — never the same frame as ripple:1, and never the terminal frame", () => {
    expect(deathFrame({ ripple: 3 })).toBe(3);
  });

  it("maps {fall: 4, dither: 2} to frame 4 — a substantial frame, not the sparse terminal one, even though fx.ripple is absent here", () => {
    expect(deathFrame({ fall: 4, dither: 2 })).toBe(4);
  });

  it("maps {fall: 10, dither: 3} — the shell's actual LAST fx step before the victory overlay takes over — to the terminal frame 6, and only that step", () => {
    expect(deathFrame({ fall: 10, dither: 3 })).toBe(6);
  });

  it("is monotonically increasing across the real victory-fx sequence in the order BattleScene.tsx actually produces it", () => {
    const sequence = [{}, { ripple: 1 }, { ripple: 3 }, { fall: 4, dither: 2 }, { fall: 10, dither: 3 }];
    const indices = sequence.map(deathFrame);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
    expect(indices).toEqual([0, 1, 3, 4, 6]);
  });

  it("treats fall values below 10 the same as fall:4 (threshold, not exact-equality, so a slightly different shell constant still lands correctly)", () => {
    expect(deathFrame({ fall: 5, dither: 2 })).toBe(4);
    expect(deathFrame({ fall: 9 })).toBe(4);
  });

  it("treats fall values at or above 10 as the terminal step regardless of the exact number", () => {
    expect(deathFrame({ fall: 10 })).toBe(6);
    expect(deathFrame({ fall: 25 })).toBe(6);
  });

  it("never returns the terminal frame for a ripple-only fx, no matter how large", () => {
    expect(deathFrame({ ripple: 999 })).toBe(3);
  });
});
