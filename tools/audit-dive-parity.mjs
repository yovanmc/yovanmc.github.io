// Timeline parity audit (M3, plan v2 §Verification step 2): the generated
// diveTimeline module must produce byte-identical state to the lab's pure
// block, evaluated standalone, across the full timeline. This checks the
// EXTRACTOR only — the render port is verified separately in the browser
// (per-beat DOM assertions; see the M3 plan).

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const labHtml = readFileSync(resolve(root, "docs/battle-prototypes/dive-intro.html"), "utf8").replace(/\r\n/g, "\n");
const m = labHtml.match(/<script id="pure">\n([\s\S]*?)<\/script>/);
if (!m) {
  console.error("audit-dive-parity: pure block not found");
  process.exit(1);
}
// eslint-disable-next-line no-new-func
const labComputeState = new Function(m[1] + "\nreturn computeState;")();

const { computeState } = await import(pathToFileURL(resolve(root, "src/generated/diveTimeline.js")).href);

let checked = 0;
for (let t = 0; t <= 14400; t += 50) {
  const a = JSON.stringify(labComputeState(t));
  const b = JSON.stringify(computeState(t));
  if (a !== b) {
    console.error(`audit-dive-parity: MISMATCH at t=${t}`);
    process.exit(1);
  }
  checked++;
}
console.log(`audit-dive-parity OK — ${checked} timeline samples identical (lab vs generated)`);
