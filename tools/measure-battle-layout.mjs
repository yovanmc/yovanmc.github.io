// M7 PR-B task B1 — CDP-over-headless-Edge measurement + capture rig
// (docs/superpowers/specs/2026-07-29-m7-imposter-polish-plan.md, task B1).
//
// Why CDP, not the Browser pane, not `msedge --screenshot` (all recorded in
// ROADMAP gotchas at planning time):
//   - The pane's resize_window does not fire a page `resize` event, so
//     App.tsx's w/h state (only updated from the real `resize` listener,
//     App.tsx:516-521) would keep stale desktop values at a mobile viewport.
//     CDP's Emulation.setDeviceMetricsOverride changes the ACTUAL viewport
//     before first paint, so App.tsx's initial useState(window.innerWidth)
//     already reads the right numbers with no resize event needed at all.
//   - `--headless=new` + the `--screenshot` CLI flag writes no PNG on this
//     machine; CDP's Page.captureScreenshot sidesteps that flag entirely.
//   - The battle is a single <canvas>, so pixels are the only visual
//     evidence available for the B3 identical-port proof and the B4/B6
//     owner review.
//
// Node-version note: this machine runs Node 20.13.1, where the global
// WebSocket is undefined unless `--experimental-websocket` is passed; CI
// pins Node 22, which has it natively and would error on an unknown flag in
// some Node versions, so the flag is never hardcoded into the npm script —
// this file re-execs itself with the flag ONLY when the global is missing,
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
const OUT_DIR = resolve(root, "docs/battle-prototypes/m7-clip");
const MEASURED_JSON = resolve(OUT_DIR, "measured.json");
const FIXTURE_TS = resolve(root, "src/battle/__fixtures__/measuredLayout.ts");

// Which frame subdirectory this run captures into — "before" (B1/B3) or
// "after" (B6). Defaults to "before"; pass "after" as argv[2].
const CAPTURE_LABEL = process.argv[2] === "after" ? "after" : "before";
const FRAMES_DIR = resolve(OUT_DIR, CAPTURE_LABEL);

// Viewport sweep from the plan (task B1): both sides of MOBILE_BREAKPOINT
// (760) and several distinct `scale` steps, since scale is a step function.
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bind to port 0 to let the OS pick a free ephemeral port, then release it.
 * Used for BOTH the CDP remote-debugging port and letting vite pick its own
 * dev-server port from stdout — this function only serves the CDP port; the
 * dev server's actual bound port is read from its own stdout per the plan
 * ("read the actual port from its stdout — do not hardcode 5173"). */
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

/** Runs in-page via Runtime.evaluate. Returns viewport-relative and
 * container-relative rects, plus the raw signals the plan's B1 step 3
 * requires (window dims, mobile-chrome tell). `[data-cmd-panel]` is the
 * test-only attribute this task adds to BattleScene.tsx:880 for exactly
 * this selection (noted in the B1 commit). */
const MEASURE_EXPR = `
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

async function main() {
  console.log(`measure-battle-layout: capture label = ${CAPTURE_LABEL}`);
  mkdirSync(FRAMES_DIR, { recursive: true });
  mkdirSync(dirname(FIXTURE_TS), { recursive: true });

  const { proc: devProc, port: devPort } = await startDevServer();
  console.log(`measure-battle-layout: dev server up on port ${devPort} (pid ${devProc.pid})`);

  const cdpPort = await freePort();
  // Portable per-run profile dir under the OS temp root - never a path
  // hardcoded at authoring time. This repo is public: a baked-in scratch
  // path would leak the author's machine/username, and a session-specific
  // directory would not exist on a later run of this same rig (B5/B6).
  const userDataDir = mkdtempSync(join(tmpdir(), "m7-edge-"));
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

    const url = `http://localhost:${devPort}/?phase=battle&boss=imposter-syndrome&defeated=alert-storm,cascade,silent-failure`;

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

      const evalResult = await client.send("Runtime.evaluate", {
        expression: MEASURE_EXPR,
        returnByValue: true,
      });
      const m = evalResult.result.value;
      if (m.error) {
        throw new Error(
          `measurement failed at ${vw}x${vh}: ${m.error} (hasContainer=${m.hasContainer} hasCanvas=${m.hasCanvas} hasPanel=${m.hasPanel})`,
        );
      }

      const shot = await client.send("Page.captureScreenshot", { format: "png" });
      const label = `${vw}x${vh}`;
      const pngPath = resolve(FRAMES_DIR, `${label}.png`);
      writeFileSync(pngPath, Buffer.from(shot.data, "base64"));

      const isMobile = vw < 760;
      const containerHeight = m.containerRect.height;
      const containerEqualsVh = Math.abs(containerHeight - vh) < 0.5;

      const record = {
        vw,
        vh,
        isMobile,
        windowInnerWidth: m.windowInnerWidth,
        windowInnerHeight: m.windowInnerHeight,
        containerRect: m.containerRect,
        containerHeight,
        containerEqualsVh,
        canvasRect: m.canvasRect,
        canvasRectContainerRelative: m.canvasRectContainerRelative,
        panelRect: m.panelRect,
        panelRectContainerRelative: m.panelRectContainerRelative,
        panelHeight: m.panelRectContainerRelative.height,
        png: `${CAPTURE_LABEL}/${label}.png`,
      };
      results.push(record);
      console.log(
        `measure-battle-layout: ${label} — containerH=${containerHeight.toFixed(2)} vh=${vh} equalsVh=${containerEqualsVh} panelH=${record.panelHeight.toFixed(2)} canvas(containerRel)=${JSON.stringify(record.canvasRectContainerRelative)}`,
      );
    }
  } finally {
    if (client) client.close();
    killTree(devProc.pid, "vite dev server");
    killTree(edgeProc.pid, "Edge headless");
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }

  writeFileSync(MEASURED_JSON, JSON.stringify(results, null, 2) + "\n");
  console.log(`measure-battle-layout: wrote ${MEASURED_JSON}`);

  // Generated TS fixture (ORCHESTRATOR AMENDMENT, task B2): the human-readable
  // measured.json above cannot be imported from a src/**/*.test.ts file in
  // this repo (no resolveJsonModule; docs/ is outside tsconfig.app.json's
  // "include": ["src"]; and "types": ["vite/client"] excludes @types/node so
  // node:fs would not resolve inside src either). This generated .ts module
  // is the one B2's tests import. DO NOT HAND-EDIT — regenerate by re-running
  // `npm run measure:layout`.
  const fixtureRows = results.map(
    ({ vw, vh, isMobile, containerHeight, panelHeight, canvasRectContainerRelative }) =>
      `  { vw: ${vw}, vh: ${vh}, isMobile: ${isMobile}, containerHeight: ${containerHeight}, panelHeight: ${panelHeight}, canvasRect: ${JSON.stringify(canvasRectContainerRelative)} },`,
  );
  const fixtureSrc = `// GENERATED by tools/measure-battle-layout.mjs (M7 PR-B task B1/B2) — DO NOT
// HAND-EDIT. Regenerate with \`npm run measure:layout\`. Source of truth is
// docs/battle-prototypes/m7-clip/measured.json, written by the same rig run.
// Every row here comes from a real headless-Edge measurement at the
// corresponding viewport (see that file for the full raw data, including
// viewport-relative rects this module omits).
export interface MeasuredLayoutRow {
  vw: number;
  vh: number;
  isMobile: boolean;
  /** [data-battle]'s own rendered height in CSS px (the B1 finding: compare
   * against vh — see measured.json's containerEqualsVh per row). */
  containerHeight: number;
  /** The COMMAND panel's rendered height in CSS px — an input, not
   * derivable; see layout.ts's commandPanelRect doc comment. */
  panelHeight: number;
  /** The <canvas> rect, CONTAINER-relative (matches layout.ts's own
   * coordinate system, not viewport-relative getBoundingClientRect()). */
  canvasRect: { left: number; top: number; width: number; height: number };
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

main().catch((err) => {
  console.error("measure-battle-layout: FAILED", err);
  process.exitCode = 1;
});
