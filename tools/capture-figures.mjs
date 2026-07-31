// S3 PR-A task A6 — capture + geometry rig for the six case-study figures.
// (docs/superpowers/specs/2026-07-30-s3-case-study-visuals-plan.md, task A6,
// items 4/5/6.)
//
// Modelled on tools/measure-battle-layout.mjs and tools/measure-figure-type.mjs:
// same classic-CDP approach (raw WebSocket JSON-RPC client, no puppeteer
// dependency), same Windows process-tree traps. Differs from both in that it
// drives the REAL BUILT SITE (`npm run build` output under dist/, served
// statically) through real deep-link routes (`/work/<slug>/`), not a
// throwaway page and not the vite dev server — the share-shells plugin
// writes a real static index.html per slug under dist/work/<slug>/, and the
// app boots straight into the CaseStudyPage dialog for that slug from
// `window.location.pathname` (src/App.tsx's `decideBoot`/`pageForPath`).
//
// Output directory is an argv parameter and MUST be
// docs/design-labs/s3-figures/captures/ per the plan — never hardcoded, and
// never a docs/battle-prototypes/** directory. M12 hardcoded its rig's
// output path and silently overwrote all twelve of M7's baseline PNGs; the
// only signal was pre-existing binaries showing as modified in `git status`.
// This script refuses to run without an explicit output dir (no default),
// same discipline as tools/measure-figure-type.mjs.
//
// Machine traps (plan + repo history, all previously verified here):
//   - Classic `--headless`, never `--headless=new`, which exits 0 and
//     silently writes no PNG on this machine.
//   - Edge needs its own `--user-data-dir` or it delegates to an already-
//     running instance and writes nothing.
//   - Node here is v20.13.1, so the CDP WebSocket client needs
//     `--experimental-websocket` (this file re-execs itself with the flag).
//   - Writes are async — poll for each file rather than testing once.
//   - `msedge --headless --window-size=390,...` clamps layout to ~478px on
//     this machine; that caveat is about `--window-size` only. The
//     emulated-mobile set below uses `Emulation.setDeviceMetricsOverride`
//     BEFORE first paint instead, which lays out at the real requested width.
//   - Wait for `document.fonts.ready` before every capture or the shot is a
//     fallback typeface, not JetBrains Mono.
//
// This script does not judge the images (a separate pinned subagent does
// that) and does not run the confidentiality gate (orchestrator's step).

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
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

// Output directory is a required argv parameter — never a hardcoded path a
// later milestone's rig could silently overwrite (M12 lesson). No default.
const outDirArg = process.argv[2];
if (!outDirArg) {
  console.error(
    "capture-figures: usage: node tools/capture-figures.mjs <output-dir>\n" +
      "  e.g. node tools/capture-figures.mjs docs/design-labs/s3-figures/captures",
  );
  process.exit(1);
}
const OUT_DIR = resolve(root, outDirArg);
// Refuse to write into any docs/battle-prototypes/** directory (M12's own
// mistake, guarded here so this rig cannot repeat it even by a typo'd argv).
if (OUT_DIR.replace(/\\/g, "/").includes("/docs/battle-prototypes/")) {
  console.error(`capture-figures: refusing to write into a battle-prototypes directory: ${OUT_DIR}`);
  process.exit(1);
}
const GEOMETRY_JSON = resolve(OUT_DIR, "geometry.json");
const FRAMES_JSON = resolve(OUT_DIR, "frames.json");

console.log(`capture-figures: writing PNGs and geometry.json to ${OUT_DIR}`);

// ---------------------------------------------------------------------------
// Capture plan (plan task A6 items 4/5, dispatch prompt items 2/3/4).
// ---------------------------------------------------------------------------

// All six figure pages, desktop widths.
const DESKTOP_SLUGS = [
  "backend-harness",
  "observability-by-default",
  "mia",
  "curio",
  "the-failure-that-left-no-logs",
  "notification-dispatch",
];
const DESKTOP_WIDTHS = [1440, 800];

// Emulated-mobile (CDP) screenshot set: the stacked form is what the design
// lock exists to protect. Three actors named explicitly by the dispatch
// prompt (backend-harness, observability-by-default, one log page).
const MOBILE_SCREENSHOT_SLUGS = ["backend-harness", "observability-by-default", "the-failure-that-left-no-logs"];
const MOBILE_WIDTHS = [390, 320];

// Geometry probe runs on BOTH log pages (dispatch item 4), even though only
// one of them is also in the mobile screenshot set above.
const LOG_SLUGS_FOR_GEOMETRY = ["the-failure-that-left-no-logs", "notification-dispatch"];

// Union of slugs that need an emulated-mobile navigation at all (screenshot
// and/or geometry), so notification-dispatch gets measured without being
// photographed.
const MOBILE_NAV_SLUGS = Array.from(new Set([...MOBILE_SCREENSHOT_SLUGS, ...LOG_SLUGS_FOR_GEOMETRY]));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

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

/** Serves the already-built dist/ via `vite preview`. Requires `npm run
 * build` to have run first (this script does not build). Reads back an
 * explicit, freshly-bound port rather than trusting vite's default 4173,
 * which could collide with an unrelated running instance. */
async function startPreviewServer() {
  const port = await freePort();
  const viteEntry = resolve(root, "node_modules/vite/bin/vite.js");
  const proc = spawn(process.execPath, [viteEntry, "preview", "--port", String(port), "--strictPort"], {
    cwd: root,
  });
  proc.stdout.on("data", () => {});
  proc.stderr.on("data", () => {});
  proc.on("error", (e) => {
    throw e;
  });

  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      const res = await fetch(`http://localhost:${port}/`);
      if (res.ok || res.status === 404) return { proc, port };
    } catch {
      /* not up yet */
    }
    await sleep(150);
  }
  throw new Error(`vite preview did not respond on port ${port} within 20s`);
}

async function startEdge(cdpPort, userDataDir) {
  mkdirSync(userDataDir, { recursive: true });
  const proc = spawn(EDGE_PATH, [
    "--headless",
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1440,900",
    "about:blank",
  ]);
  proc.stderr.on("data", () => {});
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

/** Minimal CDP JSON-RPC-over-WebSocket client, same shape as the other two
 * rigs in this repo (no puppeteer-core/chrome-remote-interface/playwright/ws
 * dependency exists in node_modules). */
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

  once(method) {
    return new Promise((resolve) => {
      const handler = (params) => {
        const arr = this.eventHandlers.get(method);
        arr.splice(arr.indexOf(handler), 1);
        resolve(params);
      };
      if (!this.eventHandlers.has(method)) this.eventHandlers.set(method, []);
      this.eventHandlers.get(method).push(handler);
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

async function evalOn(client, expr, awaitPromise = false) {
  const res = await client.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise });
  if (res.exceptionDetails) throw new Error(`page evaluation threw: ${JSON.stringify(res.exceptionDetails)}`);
  return res.result.value;
}

const FONTS_READY_EXPR = `
(async () => {
  await document.fonts.ready;
  return { fontReady: document.fonts.check("11px 'JetBrains Mono'") };
})()
`;

async function navigateAndSettle(client, url) {
  const loaded = client.once("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  const fontsRes = await evalOn(client, FONTS_READY_EXPR, true);
  if (!fontsRes.fontReady) {
    throw new Error(
      `document.fonts.ready resolved but JetBrains Mono did not check ready at ${url} — ` +
        `capture would photograph a fallback typeface. STOP: do not capture anyway.`,
    );
  }
  // Settle: let the case-study dialog's paint finish and glints/animation
  // frames stabilise before capturing.
  await sleep(700);
}

/** Measures every log line's scrollWidth against its container's
 * clientWidth, both for the line wrapper (Figure.tsx's per-line div, which
 * carries the 2px left rule + 10px padding) and — in stacked mode
 * specifically — the value div one level deeper (which carries the FURTHER
 * 12px paddingLeft per Figure.tsx). Structural selection only (no test
 * attributes exist on Figure.tsx, out of scope for this task to add):
 *   [role="img"]                 -> the figure container (Figure.tsx's root)
 *   figure.children[0]           -> the log block (kind==="log" branch)
 *   logBlock.children[i]         -> one line wrapper
 *   lineWrapper.children.length === 2 with two DIV children => stacked mode;
 *     children[1] is the indented value div.
 *   lineWrapper.children.length === 1 (a <span>) => inline mode, no separate
 *     stacked value element exists.
 */
const GEOMETRY_EXPR = `
(() => {
  const fig = document.querySelector('[role="img"]');
  if (!fig) return { error: "no [role=img] figure found on page" };
  const logBlock = fig.children[0];
  if (!logBlock) return { error: "figure has no first child (expected the log block)" };
  const lines = Array.from(logBlock.children);
  if (lines.length === 0) return { error: "log block has no line children" };
  const results = lines.map((line, i) => {
    const lineWrapper = { scrollWidth: line.scrollWidth, clientWidth: line.clientWidth };
    let stackedValue = null;
    if (
      line.children.length === 2 &&
      line.children[0].tagName === "DIV" &&
      line.children[1].tagName === "DIV"
    ) {
      const valueEl = line.children[1];
      stackedValue = {
        scrollWidth: valueEl.scrollWidth,
        clientWidth: valueEl.clientWidth,
        text: valueEl.textContent,
      };
    }
    return {
      index: i,
      lineWrapper,
      lineWrapperOverflow: lineWrapper.scrollWidth > lineWrapper.clientWidth,
      stackedValue,
      stackedValueOverflow: stackedValue ? stackedValue.scrollWidth > stackedValue.clientWidth : null,
    };
  });
  return { count: lines.length, lines: results };
})()
`;

async function pollForFile(path, timeoutMs = 5000) {
  const start = Date.now();
  while (!existsSync(path) && Date.now() - start < timeoutMs) {
    await sleep(100);
  }
  if (!existsSync(path)) throw new Error(`capture-figures: expected file never appeared: ${path}`);
}

// ---------------------------------------------------------------------------
// Frame guard (fix pass): Page.captureScreenshot grabs only the current
// viewport at the current scroll position. On mobile the figure sits below
// the fold, so a capture taken without scrolling photographs the page header
// and contains no figure — all 18 files came out byte-identical across a
// change that provably altered the DOM, which is how this surfaced. Every
// screenshot capture below must scroll the figure into frame AND verify,
// from the figure's own measured rect, that it actually landed inside the
// captured viewport before any PNG is written. A valid image of the wrong
// region passes every other check this rig or Test-CaptureSane.ps1 runs, so
// the element rect at capture time is the only place this class of bug is
// visible at all.
// ---------------------------------------------------------------------------

// The case-study dialog (CaseStudyPage.tsx) scrolls its own internal
// [data-scroll] div (position:absolute + overflowY:auto) — the outer window
// never scrolls at all here, so window.scrollTo/scrollY are no-ops on this
// page. getBoundingClientRect() is still viewport-relative regardless of
// which element scrolls, so the rect measurement itself is unaffected; only
// the *scroll adjustment* has to target the real scroll container.
const MEASURE_FIGURE_EXPR = `
(() => {
  const fig = document.querySelector('[role="img"]');
  if (!fig) return { error: "no [role=img] figure found on page" };
  const scrollContainer = fig.closest('[data-scroll]') || document.scrollingElement || document.documentElement;
  const rect = fig.getBoundingClientRect();
  return {
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    scrollTop: scrollContainer.scrollTop,
  };
})()
`;

async function measureFigure(client) {
  const res = await evalOn(client, MEASURE_FIGURE_EXPR);
  if (res.error) throw new Error(res.error);
  return res;
}

/** Centers the figure element in the viewport by computing an explicit
 * scrollTop target on its real scroll container (the [data-scroll] dialog
 * div, not window) from the figure's measured rect, then re-measuring to
 * confirm where it actually landed — never trusts `scrollIntoView`'s own
 * notion of "centered" without checking. Centering (rather than a tight crop
 * of just the figure) is deliberate: the judge needs to see whether the
 * figure reads as part of the page or as something pasted in, which requires
 * surrounding page context to still be visible. */
let DISABLE_FIGURE_CENTERING = false; // Fix-3 verification toggle only — must be false for every real capture run.
async function centerFigureInViewport(client) {
  if (DISABLE_FIGURE_CENTERING) return measureFigure(client);
  const before = await measureFigure(client);
  const targetScrollTop = before.scrollTop + before.rect.top - (before.viewport.height - before.rect.height) / 2;
  await evalOn(
    client,
    `
    (() => {
      const fig = document.querySelector('[role="img"]');
      const scrollContainer = fig.closest('[data-scroll]') || document.scrollingElement || document.documentElement;
      scrollContainer.scrollTop = Math.max(0, ${targetScrollTop});
    })()
    `,
  );
  await sleep(50); // let the scroll (and any scroll-linked layout) settle before re-measuring.
  return measureFigure(client);
}

/** The guard: after scrolling, before writing any PNG, assert the figure's
 * measured rect is fully inside the captured viewport. Throws — and the
 * caller must not write a file — rather than returning a boolean, so a
 * missed call site fails loudly instead of silently capturing anyway. */
function assertFigureInFrame(slug, width, measured) {
  const { rect, viewport } = measured;
  const inFrame =
    rect.top >= 0 &&
    rect.bottom <= viewport.height &&
    rect.left >= 0 &&
    rect.right <= viewport.width &&
    rect.width > 0 &&
    rect.height > 0;
  if (!inFrame) {
    throw new Error(
      `capture-figures: figure out of frame for ${slug}@${width} — refusing to write a PNG. ` +
        `rect=${JSON.stringify(rect)} viewport=${JSON.stringify(viewport)}`,
    );
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { proc: previewProc, port: previewPort } = await startPreviewServer();
  console.log(`capture-figures: vite preview up on port ${previewPort} (pid ${previewProc.pid})`);

  const cdpPort = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), "s3-figures-edge-"));
  const edgeProc = await startEdge(cdpPort, userDataDir);
  console.log(`capture-figures: Edge headless up, CDP port ${cdpPort} (pid ${edgeProc.pid})`);

  const writtenFiles = [];
  const geometryResults = [];
  const frameResults = [];

  let client;
  try {
    await waitForCdpReady(cdpPort, 15000);
    const target = await getFirstPageTarget(cdpPort);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.waitOpen();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    // ---- Desktop set: all six figure pages, at 1440 and 800 wide. ----
    for (const width of DESKTOP_WIDTHS) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const slug of DESKTOP_SLUGS) {
        const url = `http://localhost:${previewPort}/work/${slug}/`;
        await navigateAndSettle(client, url);
        const measured = await centerFigureInViewport(client);
        assertFigureInFrame(slug, width, measured);
        const shot = await client.send("Page.captureScreenshot", { format: "png" });
        const filePath = resolve(OUT_DIR, `${slug}-${width}.png`);
        writeFileSync(filePath, Buffer.from(shot.data, "base64"));
        await pollForFile(filePath);
        writtenFiles.push(filePath);
        frameResults.push({ slug, width, mode: "desktop", rect: measured.rect, viewport: measured.viewport });
        console.log(`capture-figures: wrote ${filePath}`);
      }
    }
    // Reset to non-mobile default so the mobile block below always applies
    // its own explicit override rather than inheriting the last desktop one.
    await client.send("Emulation.clearDeviceMetricsOverride");

    // ---- Emulated-mobile set (CDP), 390 and 320. ----
    for (const width of MOBILE_WIDTHS) {
      const height = width === 390 ? 844 : 568;
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 2,
        mobile: true,
      });
      for (const slug of MOBILE_NAV_SLUGS) {
        const url = `http://localhost:${previewPort}/work/${slug}/`;
        await navigateAndSettle(client, url);

        if (MOBILE_SCREENSHOT_SLUGS.includes(slug)) {
          const measured = await centerFigureInViewport(client);
          assertFigureInFrame(slug, width, measured);
          const shot = await client.send("Page.captureScreenshot", { format: "png" });
          const filePath = resolve(OUT_DIR, `${slug}-${width}-emulated.png`);
          writeFileSync(filePath, Buffer.from(shot.data, "base64"));
          await pollForFile(filePath);
          writtenFiles.push(filePath);
          frameResults.push({ slug, width, mode: "mobile-emulated", rect: measured.rect, viewport: measured.viewport });
          console.log(`capture-figures: wrote ${filePath}`);
        }

        if (LOG_SLUGS_FOR_GEOMETRY.includes(slug)) {
          const geo = await evalOn(client, GEOMETRY_EXPR);
          if (geo.error) {
            throw new Error(`geometry probe failed for ${slug} at ${width}px: ${geo.error}`);
          }
          geometryResults.push({ slug, width, ...geo });
          console.log(
            `capture-figures: geometry ${slug}@${width} — ${geo.count} lines, ` +
              `lineWrapper overflow=${geo.lines.some((l) => l.lineWrapperOverflow)}, ` +
              `stackedValue overflow=${geo.lines.some((l) => l.stackedValueOverflow)}`,
          );
        }
      }
    }
  } finally {
    if (client) client.close();
    killTree(previewProc.pid, "vite preview server");
    killEdgeByProfile(userDataDir, "Edge headless");
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }

  // ---- Worst-case ratio across both the line-wrapper and stacked-value
  // measurements, over both log slugs and both widths. ----
  let worst = { ratio: 0 };
  for (const r of geometryResults) {
    for (const line of r.lines) {
      const wrapperRatio = line.lineWrapper.scrollWidth / line.lineWrapper.clientWidth;
      if (wrapperRatio > worst.ratio) {
        worst = { ratio: wrapperRatio, slug: r.slug, width: r.width, index: line.index, kind: "lineWrapper" };
      }
      if (line.stackedValue) {
        const valueRatio = line.stackedValue.scrollWidth / line.stackedValue.clientWidth;
        if (valueRatio > worst.ratio) {
          worst = { ratio: valueRatio, slug: r.slug, width: r.width, index: line.index, kind: "stackedValue" };
        }
      }
    }
  }
  const anyOverflow = geometryResults.some((r) =>
    r.lines.some((l) => l.lineWrapperOverflow || l.stackedValueOverflow),
  );

  const geometryFixture = {
    measuredAt: new Date().toISOString(),
    tool: "tools/capture-figures.mjs",
    task: "S3 PR-A task A6, item 6 (geometry probe)",
    widths: MOBILE_WIDTHS,
    logSlugs: LOG_SLUGS_FOR_GEOMETRY,
    results: geometryResults,
    worstCaseRatio: worst,
    anyOverflow,
  };
  writeFileSync(GEOMETRY_JSON, JSON.stringify(geometryFixture, null, 2) + "\n");
  await pollForFile(GEOMETRY_JSON);
  console.log(`capture-figures: wrote ${GEOMETRY_JSON}`);

  // ---- frames.json: the verified figure rect (post-scroll, pre-write) for
  // every screenshot, so a reviewer can confirm the frame guard actually ran
  // rather than trusting that it did. ----
  const framesFixture = {
    measuredAt: new Date().toISOString(),
    tool: "tools/capture-figures.mjs",
    task: "S3 PR-A task A6 (fix pass) — frame guard verification per capture",
    frames: frameResults,
  };
  writeFileSync(FRAMES_JSON, JSON.stringify(framesFixture, null, 2) + "\n");
  await pollForFile(FRAMES_JSON);
  console.log(`capture-figures: wrote ${FRAMES_JSON}`);
  console.log(
    `capture-figures: worst-case ratio ${worst.ratio.toFixed(4)} (${worst.kind ?? "n/a"} on ${worst.slug ?? "n/a"}@${worst.width ?? "n/a"}), anyOverflow=${anyOverflow}`,
  );
  console.log(`capture-figures: wrote ${writtenFiles.length} PNG(s)`);
  for (const f of writtenFiles) console.log(`  ${f}`);
}

function killTree(pid, label) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    console.log(`capture-figures: stopped ${label} (pid ${pid})`);
  } catch (e) {
    console.warn(`capture-figures: could not stop ${label} (pid ${pid}): ${e.message}`);
  }
}

/** Profile-scoped kill, same as tools/measure-battle-layout.mjs and
 * tools/measure-figure-type.mjs: Edge's headless launcher re-execs into a
 * real browser process whose crashpad/gpu/utility/renderer children sit
 * outside the launcher PID's own process tree, so a plain `taskkill /T` on
 * the launcher PID does not reap them. Enumerate msedge.exe processes via
 * WMI and match each one's own command line against this run's unique
 * --user-data-dir path, never by image name alone (the owner routinely runs
 * unrelated msedge.exe processes and killing by name would be destructive). */
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
      console.log(`capture-figures: ${label} — no msedge.exe processes matched profile ${userDataDir}`);
      return;
    }
    for (const pid of pids) {
      spawnSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
    }
    console.log(`capture-figures: ${label} — killed ${pids.length} PID(s): ${pids.join(", ")}`);
  } catch (e) {
    console.warn(`capture-figures: could not enumerate/kill ${label} by profile: ${e.message}`);
  }
}

main().catch((err) => {
  console.error("capture-figures: FAILED", err);
  process.exitCode = 1;
});
