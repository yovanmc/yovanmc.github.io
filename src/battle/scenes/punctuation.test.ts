// The owner punctuation rule, automated (M6 plan section "Tests + tooling",
// dissect F16): no em dash, en dash, or semicolon in any scene module's
// exported copy strings (middle dots stay legal). Banned chars are
// unicode-escaped throughout so this file never contains a banned literal
// itself, in the detection pattern or anywhere else (test titles included).
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-1a task 6.
import { describe, expect, it } from "vitest";
import { initBattle } from "../engine";
import { SCENE_MODULES } from "./index";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";
const SEMICOLON = "\u003B";
const BANNED = new RegExp(`[${EM_DASH}${EN_DASH}${SEMICOLON}]`);

function copyStringsFor(scene: (typeof SCENE_MODULES)[string]): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [
    { label: "plate.label", value: scene.plate.label },
    { label: "plate.hiddenLabel", value: scene.plate.hiddenLabel },
    { label: "victoryCopy.eyebrow", value: scene.victoryCopy.eyebrow },
    { label: "victoryCopy.title", value: scene.victoryCopy.title },
    { label: "victoryCopy.rematchLine", value: scene.victoryCopy.rematchLine },
    { label: "victoryCopy.footer", value: scene.victoryCopy.footer },
    { label: "victoryCopy.cta", value: scene.victoryCopy.cta },
    { label: "defeatCopy.eyebrow", value: scene.defeatCopy.eyebrow },
    { label: "defeatCopy.title", value: scene.defeatCopy.title },
    { label: "defeatCopy.retryCta", value: scene.defeatCopy.retryCta },
    { label: "defeatCopy.leaveCta", value: scene.defeatCopy.leaveCta },
  ];
  scene.victoryCopy.forgeLines.forEach((line, i) => out.push({ label: `victoryCopy.forgeLines[${i}]`, value: line }));
  // banner text, sampled on a known scream-turn state
  let s = initBattle({ seed: 42 });
  s = { ...s, turn: 3, status: "active" };
  out.push({ label: "banner(scream turn)", value: scene.banner(s) });
  return out;
}

describe("scene module copy - punctuation gate", () => {
  for (const scene of Object.values(SCENE_MODULES)) {
    describe(scene.id, () => {
      for (const { label, value } of copyStringsFor(scene)) {
        it(`${label} has no em dash, en dash, or semicolon`, () => {
          expect(BANNED.test(value)).toBe(false);
        });
      }
    });
  }
});
