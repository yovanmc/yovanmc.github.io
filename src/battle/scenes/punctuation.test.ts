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
  // D3 (M6 PR-2 task 6): plate.labelFor is optional and additive — Alert
  // Storm/Cascade don't implement it, so `plate.label` above already covers
  // them. When a module DOES implement it (Silent Failure), its output is a
  // different string per phase that `plate.label` alone would never surface
  // — without this, "VANISHED" is the one new copy string this gate never
  // sees (dissect D3's own warning). Sampled against the module's own boot
  // (`scene.id`), both phase values (the vanished one built by overriding
  // `phase` on the state).
  if (scene.plate.labelFor) {
    const boot = initBattle({ seed: 42, boss: scene.id, defeatedBosses: ["alert-storm", "cascade"] });
    out.push({ label: "plate.labelFor(embodied)", value: scene.plate.labelFor(boot) });
    // Named on the `kind` discriminant, not the generic `"phase" in boot.boss`
    // structural check this used to be: with a 4th BossState member
    // (Imposter, M6 PR-3) ALSO carrying a `phase` field (a different enum
    // entirely - "clones"/"pulse"/"vanish"/"mirror", never "vanished"),
    // the structural check stopped pinning the spread to SilentFailureBoss
    // unambiguously. Only Silent Failure implements `labelFor` today, so
    // this is a pure type-narrowing fix, not a behavior change.
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
