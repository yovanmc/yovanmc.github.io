// No em dash, en dash or semicolon in any scene module's copy (middle dots
// are fine). Banned chars are unicode-escaped so this file never contains
// one, test titles included.
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
  // labelFor surfaces per-phase strings ("VANISHED") that plate.label never
  // shows, so sample both phases from the module's own boot.
  if (scene.plate.labelFor) {
    const boot = initBattle({ seed: 42, boss: scene.id, defeatedBosses: ["alert-storm", "cascade"] });
    out.push({ label: "plate.labelFor(embodied)", value: scene.plate.labelFor(boot) });
    // Narrowed on `kind`, not `"phase" in boss`: the Imposter also has a
    // `phase` field with a different enum.
    const vanishedBoss =
      boot.boss.kind === "silent-failure" ? { ...boot.boss, phase: "vanished" as const } : boot.boss;
    const vanished = { ...boot, boss: vanishedBoss };
    out.push({ label: "plate.labelFor(vanished)", value: scene.plate.labelFor(vanished) });
  }
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
