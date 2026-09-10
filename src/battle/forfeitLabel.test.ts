// Forfeit lands the player in the play menu, not the gate (App.tsx
// onBattleForfeit), so every visible forfeit-trigger label has to say that
// rather than promise "back to the gate". landingCopy.skipToWork is the single
// source both the pause overlay (BattleScene.tsx) and every boss scene's
// defeatCopy.leaveCta read from, so the label cannot drift out of sync with
// the real behavior. The phase transition itself (onBattleForfeit lands in
// "play") has no DOM harness in this vitest config (node env, no jsdom) and is
// checked by hand in the running app instead.
import { describe, expect, it } from "vitest";
import { skipToWork } from "../landingCopy";
import { SCENE_MODULES } from "./scenes";

describe("forfeit control label", () => {
  it("landingCopy.skipToWork is the forfeit control text", () => {
    expect(skipToWork).toBe("Skip to the work");
  });

  it("every boss scene's defeatCopy.leaveCta matches the forfeit control text", () => {
    const scenes = Object.values(SCENE_MODULES);
    expect(scenes.length).toBeGreaterThan(0);
    for (const scene of scenes) {
      expect(scene.defeatCopy.leaveCta).toBe(skipToWork);
    }
  });
});
