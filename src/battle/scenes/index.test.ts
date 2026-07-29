// M6 PR-1a task 6 — scene-module registry.
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md
import { describe, expect, it } from "vitest";
import { alertStormScene } from "./alertStorm";
import { cascadeScene } from "./cascade";
import { silentFailureScene } from "./silentFailure";
import { SCENE_MODULES, sceneFor } from "./index";

describe("scene-module registry", () => {
  it("registers Alert Storm under its own id", () => {
    expect(SCENE_MODULES["alert-storm"]).toBe(alertStormScene);
  });

  it("registers Cascade under its own id (M6 PR-1b task 4)", () => {
    expect(SCENE_MODULES["cascade"]).toBe(cascadeScene);
  });

  it("registers Silent Failure under its own id (M6 PR-2 task 6)", () => {
    expect(SCENE_MODULES["silent-failure"]).toBe(silentFailureScene);
  });

  it("sceneFor resolves a known boss id", () => {
    expect(sceneFor("alert-storm")).toBe(alertStormScene);
    expect(sceneFor("cascade")).toBe(cascadeScene);
    expect(sceneFor("silent-failure")).toBe(silentFailureScene);
  });

  it("sceneFor falls back to Alert Storm for an unimplemented/unknown id (never a crash path)", () => {
    // M6 PR-2 task 6 reconciliation (authorized table): re-pointed from
    // "silent-failure" (now registered above) to "imposter-syndrome".
    expect(sceneFor("imposter-syndrome")).toBe(alertStormScene);
    expect(sceneFor("nonsense")).toBe(alertStormScene);
  });
});
