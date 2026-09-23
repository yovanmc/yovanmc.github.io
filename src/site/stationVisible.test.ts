import { describe, expect, it } from "vitest";
import { stationVisible } from "./stationVisible";

describe("stationVisible", () => {
  it("shows the station only during the dive intro", () => {
    expect(stationVisible("intro")).toBe(true);
  });

  it.each(["gate", "play", "browse", "build", "battle"] as const)("hides the station on %s", (phase) => {
    expect(stationVisible(phase)).toBe(false);
  });
});
