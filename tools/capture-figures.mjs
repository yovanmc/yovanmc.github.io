// Capture and geometry rig for the six case-study figures.
//
// Same raw-CDP approach and Windows process traps as the other two rigs, but
// drives the built site (dist/, served statically) through real deep-link
// routes (`/work/<slug>/`): the share-shells plugin writes an index.html per
// slug, and the app boots straight into that slug's CaseStudyPage.
//
// The output dir is a required argv, never a docs/battle-prototypes/** dir:
// a hardcoded output path can silently overwrite baseline PNGs.
//
// Machine traps:
//   - Classic `--headless`, never `--headless=new`, which exits 0 and
//     silently writes no PNG on this machine.
//   - Edge needs its own `--user-data-dir` or it delegates to an already-
//     running instance and writes nothing.
//   - Node 20 needs `--experimental-websocket` for the CDP client (this file
//     re-execs itself with the flag).
//   - Writes are async, so poll for each file rather than testing once.
//   - `msedge --headless --window-size=390,...` clamps layout to ~478px. The
//     mobile set uses `Emulation.setDeviceMetricsOverride` before first
//     paint instead, which lays out at the real requested width.
//   - Wait for `document.fonts.ready` before every capture or the shot is a
//     fallback typeface, not JetBrains Mono.

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

const outDirArg = process.argv[2];
if (!outDirArg) {
  console.error(
    "capture-figures: usage: node tools/capture-figures.mjs <output-dir>\n" +
      "  e.g. node tools/capture-figures.mjs docs/design-labs/s3-figures/captures",
  );
  process.exit(1);
}
const OUT_DIR = resolve(root, outDirArg);
// Refuse to write into any docs/battle-prototypes/** directory, so a typo'd
// argv cannot overwrite the design labs' own captures.
if (OUT_DIR.replace(/\\/g, "/").includes("/docs/battle-prototypes/")) {
  console.error(`capture-figures: refusing to write into a battle-prototypes directory: ${OUT_DIR}`);
  process.exit(1);
}
const GEOMETRY_JSON = resolve(OUT_DIR, "geometry.json");
const FRAMES_JSON = resolve(OUT_DIR, "frames.json");

console.log(`capture-figures: writing PNGs and geometry.json to ${OUT_DIR}`);

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

// The narrow viewport is where figures stack, so three representative pages
// are captured there.
const MOBILE_SCREENSHOT_SLUGS = ["backend-harness", "observability-by-default", "the-failure-that-left-no-logs"];
const MOBILE_WIDTHS = [390, 320];

const LOG_SLUGS_FOR_GEOMETRY = ["the-failure-that-left-no-logs", "notification-dispatch"];

// Slugs needing a mobile navigation at all, so notification-dispatch is
// measured without being photographed.
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

/** Serves the built dist/ via `vite preview` (run `npm run build` first). Uses
 * a freshly bound port, not vite's default 4173, to avoid collisions. */
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

/** Minimal CDP JSON-RPC client, same as the other rigs. */
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
  // Let the dialog paint and animations settle before capturing.
  await sleep(700);
}

/** Measures each log line's scrollWidth against its container's clientWidth,
 * for the line wrapper (2px rule + 10px padding) and, in stacked mode, the
 * value div inside it (a further 12px). Figure.tsx has no test attributes,
 * so selection is structural:
 *   [role="img"]                 -> the figure root
 *   figure.children[0]           -> the log block
 *   logBlock.children[i]         -> one line wrapper
 *   two DIV children             => stacked; children[1] is the value div
 *   one <span> child             => inline, no separate value element
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

// Frame guard: Page.captureScreenshot grabs only the current viewport. On
// mobile the figure is below the fold, so an unscrolled capture holds no
// figure and every file comes out identical even when the DOM changed. Every
// capture scrolls the figure into frame and verifies its measured rect is
// inside the viewport before writing.

// The dialog scrolls its own [data-scroll] div; the window never scrolls, so
// window.scrollTo is a no-op here. getBoundingClientRect is viewport-relative
// either way, so only the scroll adjustment targets the real container.
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

// centerFigureInViewport sets an explicit scrollTop on the [data-scroll]
// container and re-measures, rather than trusting scrollIntoView. Centered,
// not cropped, so the figure is judged in page context.
let DISABLE_FIGURE_CENTERING = false; // Tests the guard itself; must be false for every real capture run.
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
  await sleep(50); // let the scroll settle before re-measuring
  return measureFigure(client);
}

/** Asserts the figure's rect is fully inside the captured viewport. Throws,
 * so a missed call site fails loudly instead of capturing anyway. */
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
    // Reset so the mobile block applies its own override, not the last desktop one.
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

  // Worst ratio across line-wrapper and stacked-value measurements, both log
  // slugs and both widths.
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
    kind: "log-line geometry probe",
    widths: MOBILE_WIDTHS,
    logSlugs: LOG_SLUGS_FOR_GEOMETRY,
    results: geometryResults,
    worstCaseRatio: worst,
    anyOverflow,
  };
  writeFileSync(GEOMETRY_JSON, JSON.stringify(geometryFixture, null, 2) + "\n");
  await pollForFile(GEOMETRY_JSON);
  console.log(`capture-figures: wrote ${GEOMETRY_JSON}`);

  // The verified post-scroll rect for every screenshot, so the frame guard's
  // result can be inspected after the run.
  const framesFixture = {
    measuredAt: new Date().toISOString(),
    tool: "tools/capture-figures.mjs",
    kind: "per-capture frame guard result",
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

/** Profile-scoped Edge kill, same as the other rigs: `taskkill /T` misses the
 * re-exec'd browser's children, and killing by image name would take out
 * unrelated Edge processes. */
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
