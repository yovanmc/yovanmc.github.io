import { describe, expect, it } from "vitest";
import { stationVisible } from "./stationVisible";

// The stained-glass station is the dive's landing geometry ONLY. It does not
// sit behind the play menu world (the post-battle "projects unlocked" screen),
// and it never appears on the gate/browse/build/battle surfaces.
describe("stationVisible", () => {
  it("shows the station only during the dive intro", () => {
    expect(stationVisible("intro")).toBe(true);
  });

  it.each(["gate", "play", "browse", "build", "battle"] as const)("hides the station on %s", (phase) => {
    expect(stationVisible(phase)).toBe(false);
  });
});
