// Imposter Syndrome parity audit (M6 PR-3 task 2, E5): the generated
// bossImposter.js module must produce byte-identical frame data to the lab's
// own pure block, evaluated standalone. This is the standing full guard E5
// calls for — Imposter is the one boss whose lab-embedded hero half is a
// LIVE dependency (remapOf recolors the hero's own IDLE/ATK), not a frozen
// inert reference like the other boss labs, so unlike Cascade/Silent
// Failure it gets a real drift guard here instead of none.
//
// Two checks:
//   1. Hero-embed parity spot-check: the lab's OWN embedded hero half must
//      still match canon heroBattle.js for exactly the symbols the slice
//      imports (IDLE/ATK/ROWS/COLS) — if these ever drift apart, the lab's
//      visual design was validated against art the shipped module no longer
//      uses.
//   2. Full IMP_* parity: every exported frame/reel set, lab-computed (off
//      its own embedded hero half) vs the generated module (importing REAL
//      canon heroBattle.js) — deep-equal, not just shape.
//
// This checks the EXTRACTOR + import wiring only — render-layer correctness
// (composeBoss, mirrorOf, erosion-stage mapping) is verified separately by
// the screenshot/interactive gates (plan §Verification).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const labHtml = readFileSync(resolve(root, "docs/battle-prototypes/boss-imposter-syndrome.html"), "utf8").replace(
  /\r\n/g,
  "\n",
);

// Full pure body: from the lab's own `const PAL = {` (top of its embedded
// hero half) through immediately before `function drawGrid` (same end anchor
// the extractor uses) — every function/const declaration in between is pure
// (no DOM touched); the DOM-writing looper()/getElementById() calls all live
// AFTER this slice, never inside it.
const startAnchor = "const PAL = {";
const endAnchor = "function drawGrid";
const a = labHtml.indexOf(startAnchor);
if (a < 0) {
  console.error("audit-imposter-parity: PAL anchor not found in boss-imposter-syndrome.html");
  process.exit(1);
}
let b = labHtml.indexOf(endAnchor, a);
if (b < 0) {
  console.error("audit-imposter-parity: drawGrid anchor not found in boss-imposter-syndrome.html");
  process.exit(1);
}
b = labHtml.lastIndexOf("\n", b) + 1;
const fullBody = labHtml.slice(a, b);

// eslint-disable-next-line no-new-func
const lab = new Function(
  fullBody +
    "\nreturn { IDLE, ATK, ROWS, COLS, IMP_IDLE, IMP_SLASH, GLITCH_A, GLITCH_B, IMP_REEL, IMP_ATK, IMP_HIT, IMP_DIE };",
)();

const gen = await import(pathToFileURL(resolve(root, "src/generated/bossImposter.js")).href);
const hero = await import(pathToFileURL(resolve(root, "src/generated/heroBattle.js")).href);

let failed = false;
function check(name, expected, actual) {
  const sa = JSON.stringify(expected);
  const sb = JSON.stringify(actual);
  if (sa !== sb) {
    console.error(`audit-imposter-parity: MISMATCH in ${name}`);
    failed = true;
  }
}

// 1. Hero-embed parity spot-check.
check("IDLE[0] (lab embed vs canon heroBattle.js)", lab.IDLE[0], hero.IDLE[0]);
check("IDLE[1] (lab embed vs canon heroBattle.js)", lab.IDLE[1], hero.IDLE[1]);
check("ATK (lab embed vs canon heroBattle.js)", lab.ATK, hero.ATK);
check("ROWS (lab embed vs canon heroBattle.js)", lab.ROWS, hero.ROWS);
check("COLS (lab embed vs canon heroBattle.js)", lab.COLS, hero.COLS);

// 2. Full IMP_* parity: lab-computed (off its own embedded hero half) vs the
// generated module (importing real canon heroBattle.js).
for (const key of ["IMP_IDLE", "IMP_SLASH", "GLITCH_A", "GLITCH_B", "IMP_REEL", "IMP_ATK", "IMP_HIT", "IMP_DIE"]) {
  check(key, lab[key], gen[key]);
}

if (failed) process.exit(1);
console.log(
  "audit-imposter-parity OK — hero-embed spot-check (IDLE/ATK/ROWS/COLS) + all 8 IMP_* sets byte-identical (lab vs generated)",
);
