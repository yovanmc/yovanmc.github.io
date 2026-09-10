// The battle exit control lands on the landing page (App.tsx onBattleExit),
// so its label must not promise anything narrower. The phase transition has
// no DOM harness in this vitest config and is checked in the running app.
import { describe, expect, it } from "vitest";
import { battleExit } from "../landingCopy";

describe("battle exit control label", () => {
  it("landingCopy.battleExit is the exit control text", () => {
    expect(battleExit).toBe("Exit");
  });
});
