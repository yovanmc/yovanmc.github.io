import { describe, expect, it } from "vitest";
import { alertStormScene } from "./alertStorm";
import { cascadeScene } from "./cascade";
import { silentFailureScene } from "./silentFailure";
import { imposterScene } from "./imposter";
import { SCENE_MODULES, sceneFor } from "./index";

describe("scene-module registry", () => {
  it.each([
    ["alert-storm", alertStormScene],
    ["cascade", cascadeScene],
    ["silent-failure", silentFailureScene],
    ["imposter-syndrome", imposterScene],
  ] as const)("registers %s under its own id", (id, scene) => {
    expect(SCENE_MODULES[id]).toBe(scene);
  });

  it("sceneFor resolves a known boss id", () => {
    expect(sceneFor("alert-storm")).toBe(alertStormScene);
    expect(sceneFor("cascade")).toBe(cascadeScene);
    expect(sceneFor("silent-failure")).toBe(silentFailureScene);
    expect(sceneFor("imposter-syndrome")).toBe(imposterScene);
  });

  it("sceneFor falls back to Alert Storm for an unknown id rather than crashing", () => {
    expect(sceneFor("nonsense")).toBe(alertStormScene);
  });
});
