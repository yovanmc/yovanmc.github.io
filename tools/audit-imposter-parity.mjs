// Imposter Syndrome parity audit: the generated bossImposter.js must produce
// frame data identical to the lab's own pure block, evaluated standalone. The
// Imposter lab's embedded hero half is a live dependency (remapOf recolors the
// hero's IDLE/ATK), so unlike the other bosses it gets a real drift guard.
//
// Two checks:
//   1. The lab's embedded hero half still matches canon heroBattle.js for the
//      symbols the slice imports (IDLE/ATK/ROWS/COLS). Otherwise the lab
//      renders against art the shipped module does not use.
//   2. Every exported IMP_* frame/reel set, lab-computed vs the generated
//      module (importing real heroBattle.js), deep-equal.
//
// Covers the extractor and import wiring only; render-layer correctness
// (composeBoss, mirrorOf, erosion stages) is checked in the browser.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const labHtml = readFileSync(resolve(root, "docs/battle-prototypes/boss-imposter-syndrome.html"), "utf8").replace(
  /\r\n/g,
  "\n",
);

// From the lab's `const PAL = {` through just before `function drawGrid`
// (the extractor's end anchor). Everything in between is pure; the DOM
// writes all come after.
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

// 2. Full IMP_* parity.
for (const key of ["IMP_IDLE", "IMP_SLASH", "GLITCH_A", "GLITCH_B", "IMP_REEL", "IMP_ATK", "IMP_HIT", "IMP_DIE"]) {
  check(key, lab[key], gen[key]);
}

if (failed) process.exit(1);
console.log(
  "audit-imposter-parity OK — hero-embed spot-check (IDLE/ATK/ROWS/COLS) + all 8 IMP_* sets byte-identical (lab vs generated)",
);
