// Forfeit lands in the play menu, not the gate, so every forfeit label must
// say so. landingCopy.skipToWork is the single source for the pause overlay
// and every scene's defeatCopy.leaveCta. The phase transition itself has no
// DOM harness here and is checked by hand in the running app.
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
