// CDP-over-headless-Edge measurement and capture rig for the battle screen.
// Measures all three command-menu levels (top/skills/spells), walking every
// cursor position within each level and keeping the max panel height per
// level: panel height is cursor-dependent, because the footer renders the
// active row's description and a long one wraps to a second line, so the
// landing cursor alone reports a best case rather than the worst case a
// player can actually hit.
//
// Why CDP, not a browser automation pane, not `msedge --screenshot`:
//   - A pane's resize does not fire a page `resize` event, so App.tsx's w/h
//     state (only updated from the real `resize` listener, App.tsx:516-521)
//     would keep stale desktop values at a mobile viewport.
//     CDP's Emulation.setDeviceMetricsOverride changes the ACTUAL viewport
//     before first paint, so App.tsx's initial useState(window.innerWidth)
//     already reads the right numbers with no resize event needed at all.
//   - `--headless=new` + the `--screenshot` CLI flag writes no PNG on this
//     machine; CDP's Page.captureScreenshot sidesteps that flag entirely.
//   - The battle is a single <canvas>, so pixels are the only visual evidence
//     available for comparing renders.
//
// CDP key-name note: always dispatch the full key name
// ("ArrowDown"/"Enter"/"Escape"), never a short form like "Down"/"Return".
// Short forms have been observed to produce an EMPTY `e.key` on this machine
// when replayed through some automation surfaces, silently dropping the
// keystroke. This rig uses full names throughout.
//
// Node-version note: this machine runs Node 20.13.1, where the global
// WebSocket is undefined unless `--experimental-websocket` is passed; CI
// pins Node 22, which has it natively and would error on an unknown flag in
// some Node versions, so the flag is never hardcoded into the npm script.
// This file re-execs itself with the flag ONLY when the global is missing,
// which makes it correct on both.
import { spawn, spawnSync, execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (typeof WebSocket === "undefined") {
  const { status } = spawnSync(
    process.execPath,
    ["--experimental-websocket", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  process.exit(status ?? 1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

// Output root, chosen per run. This rig used to hardcode a single output
// directory, which meant a later run silently overwrote an earlier run's
// baseline frames and measured.json. Pass the docs/battle-prototypes/<dir>
// name to write into as argv[2]; keep the default below pointing at the
// directory currently in use, never at one whose captures still matter.
const MILESTONE_DIR = process.argv[2] || process.env.MEASURE_MILESTONE_DIR || "m12-menu";
const OUT_DIR = resolve(root, "docs/battle-prototypes", MILESTONE_DIR);
const MEASURED_JSON = resolve(OUT_DIR, "measured.json");
const FIXTURE_TS = resolve(root, "src/battle/__fixtures__/measuredLayout.ts");

// Optional before/after capture-label subdirectory, for when a rig run
// happens BEFORE a fix lands and needs a second AFTER pass to compare
// against. Output goes flat into OUT_DIR by default; pass "before" or
// "after" as argv[3] to opt into the subdirectory scheme instead.
const CAPTURE_LABEL = process.argv[3] === "before" || process.argv[3] === "after" ? process.argv[3] : null;
const FRAMES_DIR = CAPTURE_LABEL ? resolve(OUT_DIR, CAPTURE_LABEL) : OUT_DIR;

console.log(
  `measure-battle-layout: writing to ${OUT_DIR} (milestone=${MILESTONE_DIR}, label=${CAPTURE_LABEL ?? "flat, no before/after subdir"})`,
);

// Viewport sweep: both sides of MOBILE_BREAKPOINT (760) and several distinct
// `scale` steps, since scale is a step function.
const VIEWPORTS = [
  { vw: 1920, vh: 1080 },
  { vw: 1600, vh: 900 },
  { vw: 1440, vh: 900 },
  { vw: 1440, vh: 720 },
  { vw: 1280, vh: 800 },
  { vw: 1280, vh: 620 },
  { vw: 1024, vh: 768 },
  { vw: 800, vh: 600 },
  { vw: 759, vh: 900 },
  { vw: 430, vh: 932 },
  { vw: 390, vh: 844 },
  { vw: 360, vh: 640 },
];

// Fixed row counts for the full 8-ability kit (the boot URL below unlocks all
// of them). top = Attack/Skills/Spells (always 3); skills = Critical
// Thinking/Power Through/Debug (3); spells = Fan Out/Rollback/Root
// Cause/Conviction (4). If a kit change makes this wrong, the rig's own
// data-cmd-level mismatch check (below) fails loudly rather than silently
// walking the wrong number of rows.
const LEVEL_ROW_COUNTS = { top: 3, skills: 3, spells: 4 };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bind to port 0 to let the OS pick a free ephemeral port, then release it.
 * Used for BOTH the CDP remote-debugging port and letting vite pick its own
 * dev-server port from stdout. This function only serves the CDP port; the
 * dev server's actual bound port is read from its own stdout rather than
 * assumed to be 5173. */
function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on("error", rej);
  });
}

function startDevServer() {
  return new Promise((resolvePort, reject) => {
    // Invoke vite's own JS entry point directly with `node`, bypassing the
    // node_modules/.bin/vite(.cmd) shim entirely: on Windows, spawn() without
    // shell:true cannot exec a .cmd shim (EINVAL), and shell:true would add
    // a cmd.exe layer between us and the real vite/node process, complicating
    // clean-shutdown PID tracking for no benefit.
    const viteEntry = resolve(root, "node_modules/vite/bin/vite.js");
    const proc = spawn(process.execPath, [viteEntry], { cwd: root });
    let buf = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) reject(new Error("vite dev server did not print a Local: URL within 20s"));
    }, 20000);
    const onData = (chunk) => {
      buf += chunk.toString();
      // Strip ANSI colour codes before matching.
      const plain = buf.replace(/\x1b\[[0-9;]*m/g, "");
      const m = plain.match(/Local:\s+https?:\/\/localhost:(\d+)\//);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        proc.stdout.off("data", onData);
        resolvePort({ proc, port: Number(m[1]) });
      }
    };
    proc.stdout.on("data", onData);
    proc.stderr.on("data", (d) => process.stderr.write(`[vite stderr] ${d}`));
    proc.on("error", reject);
  });
}

async function startEdge(cdpPort, userDataDir) {
  mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(EDGE_PATH, [
    "--headless=new",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1920,1080",
    "about:blank",
  ]);
  proc.stderr.on("data", () => {}); // Edge logs verbosely to stderr; not needed
  return proc;
}

async function waitForCdpReady(port, timeoutMs) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return;
    } catch (e) {
      lastErr = e;
    }
    await sleep(200);
  }
  throw new Error(`Edge CDP endpoint on port ${port} not ready after ${timeoutMs}ms: ${lastErr}`);
}

async function getFirstPageTarget(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page");
  if (!page) throw new Error("no page-type target found on Edge's CDP endpoint");
  return page;
}

/** Minimal CDP JSON-RPC-over-WebSocket client — this repo has no CDP/Puppeteer
 * dependency (verified: no puppeteer-core/chrome-remote-interface/playwright/ws
 * in node_modules), so a raw client using the global WebSocket is the whole
 * dependency footprint (zero new devDependencies). */
class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.eventHandlers = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP error: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      } else if (msg.method) {
        const handlers = this.eventHandlers.get(msg.method);
        if (handlers) for (const h of [...handlers]) h(msg.params);
      }
    });
  }

  waitOpen() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === 1) return resolve();
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", (e) => reject(e), { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, []);
    this.eventHandlers.get(method).push(handler);
  }

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const arr = this.eventHandlers.get(method);
        arr.splice(arr.indexOf(handler), 1);
        resolve(params);
      };
      this.on(method, handler);
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

/** Base geometry snapshot: viewport-relative and container-relative rects,
 * plus the raw window dimensions and the mobile-chrome tell. Independent of
 * command-menu state, since the canvas never moves when the menu navigates.
 * `[data-cmd-panel]` / `[data-cmd-level]` are the test-only attributes
 * BattleScene.tsx carries for exactly this selection. */
const BASE_MEASURE_EXPR = `
(() => {
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  };
  const container = document.querySelector('[data-battle]');
  const canvas = document.querySelector('[data-battle] canvas');
  const panel = document.querySelector('[data-cmd-panel]');
  if (!container || !canvas || !panel) {
    return { error: 'missing element', hasContainer: !!container, hasCanvas: !!canvas, hasPanel: !!panel };
  }
  const containerRect = rectOf(container);
  const canvasRect = rectOf(canvas);
  const panelRect = rectOf(panel);
  return {
    windowInnerWidth: window.innerWidth,
    windowInnerHeight: window.innerHeight,
    containerRect,
    canvasRect,
    panelRect,
    canvasRectContainerRelative: {
      left: canvasRect.left - containerRect.left,
      top: canvasRect.top - containerRect.top,
      width: canvasRect.width,
      height: canvasRect.height,
    },
    panelRectContainerRelative: {
      left: panelRect.left - containerRect.left,
      top: panelRect.top - containerRect.top,
      width: panelRect.width,
      height: panelRect.height,
    },
  };
})()
`;

/** Per-cursor level measurement. `panel.children[1]` is the scrollable row
 * container in menu mode (children[0] = header, children[1] = row container,
 * children[2] = footer when present): a positional selector, safe here
 * because this rig only ever measures menu mode, never target mode, which
 * has a different children[1] shape. Also asserts `data-cmd-level` matches
 * what the rig expects to be showing, so a silent wrong-level read fails
 * loudly instead of being recorded as a measurement. */
const LEVEL_MEASURE_EXPR = `
(() => {
  const panel = document.querySelector('[data-cmd-panel]');
  if (!panel) return { error: 'no panel' };
  const level = panel.getAttribute('data-cmd-level');
  const body = panel.children[1];
  const panelHeight = panel.getBoundingClientRect().height;
  const bodyScrollHeight = body ? body.scrollHeight : null;
  const bodyClientHeight = body ? body.clientHeight : null;
  return { level, panelHeight, bodyScrollHeight, bodyClientHeight };
})()
`;

async function dispatchKey(client, type, key, code, keyCode) {
  await client.send("Input.dispatchKeyEvent", {
    type,
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    nativeVirtualKeyCode: keyCode,
  });
}

/** rawKeyDown + keyUp for a named key. ALWAYS pass the full key name
 * ("ArrowDown", never "Down"); see the CDP key-name note at the top of this
 * file. */
async function pressKey(client, key, code, keyCode) {
  await dispatchKey(client, "rawKeyDown", key, code, keyCode);
  await dispatchKey(client, "keyUp", key, code, keyCode);
  await sleep(60);
}

const KEY_CODES = {
  ArrowDown: ["ArrowDown", 40],
  ArrowUp: ["ArrowUp", 38],
  ArrowLeft: ["ArrowLeft", 37],
  ArrowRight: ["ArrowRight", 39],
  Enter: ["Enter", 13],
  Escape: ["Escape", 27],
};
async function press(client, name) {
  const [code, kc] = KEY_CODES[name];
  await pressKey(client, name, code, kc);
}

async function evalOn(client, expr) {
  const res = await client.send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return res.result.value;
}

/** Walk every row of the CURRENTLY SHOWING level (cursor already at row 0),
 * pressing ArrowDown between measurements, and return the max panelHeight
 * plus whether any row was scrollable. Panel height is cursor-dependent
 * because the footer renders the active row's description and long ones
 * wrap, so only walking every row and keeping the max reports the true
 * worst case. */
async function walkLevel(client, expectedLevel, rowCount) {
  let maxPanelHeight = -Infinity;
  let scrollable = false;
  for (let i = 0; i < rowCount; i++) {
    const m = await evalOn(client, LEVEL_MEASURE_EXPR);
    if (m.error) throw new Error(`level measurement failed at row ${i}: ${m.error}`);
    if (m.level !== expectedLevel) {
      throw new Error(
        `rig walked to row ${i} expecting level "${expectedLevel}" but data-cmd-level reads "${m.level}" — ` +
          `silent wrong-level measurement, failing loudly rather than recording a bogus number`,
      );
    }
    if (m.panelHeight > maxPanelHeight) maxPanelHeight = m.panelHeight;
    if (m.bodyScrollHeight !== null && m.bodyClientHeight !== null && m.bodyScrollHeight > m.bodyClientHeight + 0.5) {
      scrollable = true;
    }
    if (i < rowCount - 1) await press(client, "ArrowDown");
  }
  return { panelHeight: maxPanelHeight, scrollable };
}

async function main() {
  mkdirSync(FRAMES_DIR, { recursive: true });
  mkdirSync(dirname(FIXTURE_TS), { recursive: true });

  const { proc: devProc, port: devPort } = await startDevServer();
  console.log(`measure-battle-layout: dev server up on port ${devPort} (pid ${devProc.pid})`);

  const cdpPort = await freePort();
  // Portable per-run profile dir under the OS temp root, never a path
  // hardcoded at authoring time: a baked-in path would leak the author's
  // machine and username into a public repo, and a machine-specific directory
  // would not exist on a later run of this rig anyway.
  const userDataDir = mkdtempSync(join(tmpdir(), "battle-edge-"));
  const edgeProc = await startEdge(cdpPort, userDataDir);
  console.log(`measure-battle-layout: Edge headless up, CDP port ${cdpPort} (pid ${edgeProc.pid})`);

  let client;
  const results = [];
  try {
    await waitForCdpReady(cdpPort, 15000);
    const target = await getFirstPageTarget(cdpPort);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.waitOpen();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    // Boot straight into the battle with the full 8-ability kit unlocked.
    const url =
      `http://localhost:${devPort}/?phase=battle&boss=imposter-syndrome` +
      `&defeated=alert-storm,cascade,silent-failure,imposter-syndrome`;

    for (const { vw, vh } of VIEWPORTS) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vw,
        height: vh,
        deviceScaleFactor: 1,
        mobile: false,
      });

      const loaded = client.once("Page.loadEventFired");
      await client.send("Page.navigate", { url });
      await loaded;
      // Settle: let the .9s descend-in animation and initial React effects
      // finish before measuring/capturing.
      await sleep(1400);

      // ---- base geometry (container/canvas/panel rects at TOP, cursor 0) ----
      const base = await evalOn(client, BASE_MEASURE_EXPR);
      if (base.error) {
        throw new Error(
          `measurement failed at ${vw}x${vh}: ${base.error} (hasContainer=${base.hasContainer} hasCanvas=${base.hasCanvas} hasPanel=${base.hasPanel})`,
        );
      }

      const label = `${vw}x${vh}`;
      const shot0 = await client.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(FRAMES_DIR, `${label}.png`), Buffer.from(shot0.data, "base64"));

      // ---- Walk every command-menu level ----
      // TOP: already showing, cursor at row 0 (fresh mount).
      const top = await walkLevel(client, "top", LEVEL_ROW_COUNTS.top);
      // TOP's cursor is now on its last row (Spells, index 2) after the walk.
      const shotTop = await client.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(FRAMES_DIR, `${label}-top.png`), Buffer.from(shotTop.data, "base64"));

      // Descend into Skills: move cursor from Spells(2) to Skills(1), Enter.
      await press(client, "ArrowUp");
      await press(client, "Enter");
      const skills = await walkLevel(client, "skills", LEVEL_ROW_COUNTS.skills);
      const shotSkills = await client.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(FRAMES_DIR, `${label}-skills.png`), Buffer.from(shotSkills.data, "base64"));

      // Ascend (Escape -> back -> "top", cursor there still Skills(1)).
      await press(client, "Escape");
      // Descend into Spells: move cursor from Skills(1) to Spells(2), Enter.
      await press(client, "ArrowDown");
      await press(client, "Enter");
      const spells = await walkLevel(client, "spells", LEVEL_ROW_COUNTS.spells);
      const shotSpells = await client.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(resolve(FRAMES_DIR, `${label}-spells.png`), Buffer.from(shotSpells.data, "base64"));

      const isMobile = vw < 760;
      const containerHeight = base.containerRect.height;
      const containerEqualsVh = Math.abs(containerHeight - vh) < 0.5;
      // The `panelHeight` column is the max over the three levels, so the
      // clip invariant consumes the worst case unchanged.
      const panelHeight = Math.max(top.panelHeight, skills.panelHeight, spells.panelHeight);

      const record = {
        vw,
        vh,
        isMobile,
        windowInnerWidth: base.windowInnerWidth,
        windowInnerHeight: base.windowInnerHeight,
        containerRect: base.containerRect,
        containerHeight,
        containerEqualsVh,
        canvasRect: base.canvasRect,
        canvasRectContainerRelative: base.canvasRectContainerRelative,
        panelRect: base.panelRect,
        panelRectContainerRelative: base.panelRectContainerRelative,
        panelHeight,
        levels: { top, skills, spells },
        png: CAPTURE_LABEL ? `${CAPTURE_LABEL}/${label}.png` : `${label}.png`,
      };
      results.push(record);
      console.log(
        `measure-battle-layout: ${label} — containerH=${containerHeight.toFixed(2)} vh=${vh} equalsVh=${containerEqualsVh} ` +
          `panelH(max)=${panelHeight.toFixed(2)} top=${top.panelHeight.toFixed(2)}/${top.scrollable} ` +
          `skills=${skills.panelHeight.toFixed(2)}/${skills.scrollable} spells=${spells.panelHeight.toFixed(2)}/${spells.scrollable}`,
      );
    }
  } finally {
    if (client) client.close();
    killTree(devProc.pid, "vite dev server");
    killEdgeByProfile(userDataDir, "Edge headless");
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }

  writeFileSync(MEASURED_JSON, JSON.stringify(results, null, 2) + "\n");
  console.log(`measure-battle-layout: wrote ${MEASURED_JSON}`);

  // Generated TS fixture: the human-readable measured.json above cannot be
  // imported from a src/**/*.test.ts file in this repo (no resolveJsonModule;
  // docs/ is outside tsconfig.app.json's "include": ["src"]; and "types":
  // ["vite/client"] excludes @types/node so node:fs would not resolve inside
  // src either). This generated .ts module is what the tests import. Do not
  // hand-edit it; regenerate by re-running `npm run measure:layout`.
  const levelLit = (l) => `{ panelHeight: ${l.panelHeight}, scrollable: ${l.scrollable} }`;
  const fixtureRows = results.map(
    ({ vw, vh, isMobile, containerHeight, panelHeight, canvasRectContainerRelative, levels }) =>
      `  { vw: ${vw}, vh: ${vh}, isMobile: ${isMobile}, containerHeight: ${containerHeight}, panelHeight: ${panelHeight}, canvasRect: ${JSON.stringify(canvasRectContainerRelative)}, levels: { top: ${levelLit(levels.top)}, skills: ${levelLit(levels.skills)}, spells: ${levelLit(levels.spells)} } },`,
  );
  const fixtureSrc = `// GENERATED by tools/measure-battle-layout.mjs. Do not edit by hand;
// regenerate with \`npm run measure:layout\`. The full raw data lives in the
// measured.json that the same rig run writes, including the viewport-relative
// rects this module omits. Every row here comes from a real headless-Edge
// measurement at the corresponding viewport.
export interface LevelMeasure {
  /** Max rendered panel height (CSS px) across every cursor position within
   * this level. The footer renders the active row's description, and long ones
   * wrap to a second line, so panel height is cursor-dependent and only
   * walking every row and keeping the max reports the true worst case. */
  panelHeight: number;
  /** True if body.scrollHeight > body.clientHeight at ANY walked cursor
   * position within this level. */
  scrollable: boolean;
}

export interface MeasuredLayoutRow {
  vw: number;
  vh: number;
  isMobile: boolean;
  /** [data-battle]'s own rendered height in CSS px; compare against vh via
   * measured.json's containerEqualsVh per row. */
  containerHeight: number;
  /** The COMMAND panel's rendered height in CSS px: the MAX over the three
   * levels' own \`levels.*.panelHeight\`, which the clip invariant consumes
   * unchanged. An input, not derivable; see layout.ts's commandPanelRect doc
   * comment. */
  panelHeight: number;
  /** The <canvas> rect, CONTAINER-relative (matches layout.ts's own
   * coordinate system, not viewport-relative getBoundingClientRect()). */
  canvasRect: { left: number; top: number; width: number; height: number };
  /** Per-level worst-case measurement. */
  levels: { top: LevelMeasure; skills: LevelMeasure; spells: LevelMeasure };
}

export const MEASURED_LAYOUT: readonly MeasuredLayoutRow[] = [
${fixtureRows.join("\n")}
];
`;
  writeFileSync(FIXTURE_TS, fixtureSrc);
  console.log(`measure-battle-layout: wrote ${FIXTURE_TS}`);
}

function killTree(pid, label) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    console.log(`measure-battle-layout: stopped ${label} (pid ${pid})`);
  } catch (e) {
    console.warn(`measure-battle-layout: could not stop ${label} (pid ${pid}): ${e.message}`);
  }
}

/** `taskkill /pid X /T /F` on Edge's launcher PID does not reap its children
 * on this machine: Edge's headless launcher
 * re-execs into the real browser process, which then owns
 * crashpad-handler/gpu-process/utility/renderer children outside the
 * launcher PID's own process-tree, so `/T` never reaches them and every run
 * leaked a full orphan subtree. Fix: enumerate `msedge.exe` processes via
 * WMI (`Win32_Process`) and match each one's OWN command line against this
 * run's unique `--user-data-dir` path (created fresh per run by
 * `mkdtempSync`, so the match is unambiguous to this invocation), then kill
 * each matched PID individually with `taskkill /PID <pid> /F`. Deliberately
 * NEVER filters on image name alone: unrelated msedge.exe processes are
 * usually running, and killing by name would take them out too. */
function killEdgeByProfile(userDataDir, label) {
  const psLiteral = userDataDir.replace(/'/g, "''");
  const psScript =
    `Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" | ` +
    `Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${psLiteral}') } | ` +
    `Select-Object -ExpandProperty ProcessId`;
  try {
    const res = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
      encoding: "utf8",
    });
    const pids = (res.stdout || "")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));
    if (pids.length === 0) {
      console.log(
        `measure-battle-layout: ${label} — no msedge.exe processes matched profile ${userDataDir} (already exited?)`,
      );
      return;
    }
    for (const pid of pids) {
      // Exact-PID kill only, never by image name. A non-zero exit here just
      // means the process already exited between enumeration and kill.
      spawnSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
    }
    console.log(
      `measure-battle-layout: ${label} — killed ${pids.length} PID(s) matched to profile ${userDataDir}: ${pids.join(", ")}`,
    );
  } catch (e) {
    console.warn(`measure-battle-layout: could not enumerate/kill ${label} by profile: ${e.message}`);
  }
}

main().catch((err) => {
  console.error("measure-battle-layout: FAILED", err);
  process.exitCode = 1;
});
