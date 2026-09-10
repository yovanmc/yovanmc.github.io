import { describe, expect, it } from "vitest";
import { alertStormScene } from "./alertStorm";
import { cascadeScene } from "./cascade";
import { silentFailureScene } from "./silentFailure";
import { imposterScene } from "./imposter";
import { SCENE_MODULES, sceneFor } from "./index";

describe("scene-module registry", () => {
  it("registers Alert Storm under its own id", () => {
    expect(SCENE_MODULES["alert-storm"]).toBe(alertStormScene);
  });

  it("registers Cascade under its own id", () => {
    expect(SCENE_MODULES["cascade"]).toBe(cascadeScene);
  });

  it("registers Silent Failure under its own id", () => {
    expect(SCENE_MODULES["silent-failure"]).toBe(silentFailureScene);
  });

  it("registers Imposter Syndrome under its own id", () => {
    expect(SCENE_MODULES["imposter-syndrome"]).toBe(imposterScene);
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
