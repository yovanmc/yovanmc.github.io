// M6 PR-2 task 6b (plan §D5a) — the death-reel gate predicate, unit-tested
// directly because the bug it fixes was invisible to every other gate for
// two milestones (buried inside a useEffect, never independently assertable).
import { describe, expect, it } from "vitest";
import { shouldComposeBoss } from "./sceneGate";
import type { ComposeGateMode } from "./sceneGate";

const NON_VICTORY_MODES: ComposeGateMode[] = ["menu", "target", "anim", "pause", "defeat"];

describe("shouldComposeBoss", () => {
  it("is false while descending, regardless of mode (the descend gate is untouched by this fix)", () => {
    for (const mode of [...NON_VICTORY_MODES, "victory"] as ComposeGateMode[]) {
      expect(shouldComposeBoss({ descend: true, mode })).toBe(false);
    }
  });

  it("is false once the victory overlay is showing", () => {
    expect(shouldComposeBoss({ descend: false, mode: "victory" })).toBe(false);
  });

  it("is true for every non-victory mode once descended — including through the whole death-animation window, which stays in \"anim\" until the overlay takes over", () => {
    for (const mode of NON_VICTORY_MODES) {
      expect(shouldComposeBoss({ descend: false, mode })).toBe(true);
    }
  });

  it("is true during defeat specifically (the boss survives a defeat turn, so the layer must never stop for it)", () => {
    expect(shouldComposeBoss({ descend: false, mode: "defeat" })).toBe(true);
  });
});
