// M6 PR-1a task 6 — scene-module registry.
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md
import { describe, expect, it } from "vitest";
import { alertStormScene } from "./alertStorm";
import { SCENE_MODULES, sceneFor } from "./index";

describe("scene-module registry", () => {
  it("registers Alert Storm under its own id", () => {
    expect(SCENE_MODULES["alert-storm"]).toBe(alertStormScene);
  });

  it("sceneFor resolves a known boss id", () => {
    expect(sceneFor("alert-storm")).toBe(alertStormScene);
  });

  it("sceneFor falls back to Alert Storm for an unimplemented/unknown id (never a crash path)", () => {
    expect(sceneFor("cascade")).toBe(alertStormScene);
    expect(sceneFor("nonsense")).toBe(alertStormScene);
  });
});
