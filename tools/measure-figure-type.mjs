// S3 PR-A task A2a — measures the type/layout constants that
// src/figures/layout.ts (task A2, a LATER task) will consume.
// (docs/superpowers/specs/2026-07-30-s3-case-study-visuals-plan.md, task A2a.)
//
// Modelled on tools/measure-battle-layout.mjs (M7/M12): same classic-CDP
// approach (raw WebSocket JSON-RPC client, no puppeteer dependency), same
// Windows process-tree traps. Simpler than that rig in one respect: this
// task measures type metrics against a throwaway static page, not the real
// app, so no vite dev server is needed — Edge navigates a `file://` URL
// directly.
//
// This script writes ONLY the JSON fixture. It must NOT create or edit
// src/figures/layout.ts — that file does not exist yet; task A2 (a later,
// separate dispatch) creates it and takes its constants from this fixture,
// rounding UP for NODE_MIN_PX and MONO_CH_PX.
//
// Machine traps (plan task A2a + repo history):
//   - Classic `--headless`, never `--headless=new`, which exits 0 and
//     silently writes no file on this machine.
//   - Edge needs its own `--user-data-dir` or it delegates to an already-
//     running instance and writes nothing.
//   - Node here is v20.13.1, so the CDP WebSocket client needs
//     `--experimental-websocket` (this file re-execs itself with the flag,
//     same pattern as measure-battle-layout.mjs, so it stays correct if CI
//     later runs a Node version that has WebSocket natively).
//   - File writes are async — poll for the output file rather than testing
//     for it once.
//
// Font-readiness trap (the reason this task exists): index.html:10 loads
// JetBrains Mono from Google Fonts with `display=swap`, so text renders in
// a fallback monospace immediately and stays that way if the headless run
// has no network. A rig that measures before the real face has loaded
// produces confident wrong numbers. This script awaits `document.fonts.ready`
// and hard-fails on `document.fonts.check("11px 'JetBrains Mono'")` rather
// than falling back to whatever face is available.
//
// Output directory is an argv parameter, never hardcoded (M12 lesson: that
// rig once hardcoded its output path and silently overwrote all twelve of
// M7's baseline PNGs).

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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

// Output directory is a required argv parameter — never a hardcoded path
// that a later milestone's rig could silently overwrite (M12 lesson, see
// header comment). No default: an omitted argument is a usage error, not a
// silently-chosen path.
const outDirArg = process.argv[2];
if (!outDirArg) {
  console.error(
    "measure-figure-type: usage: node tools/measure-figure-type.mjs <output-dir>\n" +
      "  e.g. node tools/measure-figure-type.mjs docs/design-labs/s3-figures",
  );
  process.exit(1);
}
const OUT_DIR = resolve(root, outDirArg);
const OUT_JSON = resolve(OUT_DIR, "measured-figure-type.json");

console.log(`measure-figure-type: writing to ${OUT_JSON}`);

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
    "--window-size=320,900",
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

/** Minimal CDP JSON-RPC-over-WebSocket client, same shape as
 * tools/measure-battle-layout.mjs (this repo has no puppeteer-core/
 * chrome-remote-interface/playwright/ws dependency). */
class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP error: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
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

  close() {
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}

// ---------------------------------------------------------------------------
// Throwaway page. Structure replicates the real chain declared in the plan's
// "the width domain, declared once" section:
//   viewport -> CaseStudyPage's `data-page-content` (maxWidth 960, margin
//   0 auto, padding `clamp(20px,5vw,44px)` horizontal, box-sizing:border-box
//   from src/styles/tokens.css's `* { box-sizing: border-box }`)
//   -> figure container (task A4 spec: border 1px solid, padding 18px 20px,
//   box-sizing:border-box)
// At a 320px viewport, clamp(20px,5vw,44px) evaluates to 20px (5vw=16 < the
// 20px floor), matching ledger claim 12's arithmetic.
//
// Loads the SAME Google Fonts stylesheet as index.html (JetBrains Mono),
// so the font-readiness trap is exercised for real, not stubbed.
// ---------------------------------------------------------------------------
const THROWAWAY_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Marcellus&family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #070b18; }
</style>
</head>
<body>
  <div id="page-content" style="max-width:960px;margin:0 auto;padding:clamp(64px,9vw,84px) clamp(20px,5vw,44px) 120px;">
    <div id="figure" style="border:1px solid rgba(140,185,255,.22);border-radius:13px;padding:18px 20px;background:linear-gradient(160deg, rgba(20,40,78,.5), rgba(10,18,38,.45));">
      <div id="mono-run" style="display:inline-block;width:max-content;white-space:nowrap;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;">0123456789012345678901234567890123456789</div>
      <div id="node" style="display:inline-block;width:max-content;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;padding:9px 10px;border-radius:11px;text-align:center;">ORCHESTRATOR</div>
    </div>
  </div>
</body>
</html>
`;

// Font-readiness + measurement, evaluated in the page. Async IIFE so it can
// be run with Runtime.evaluate's awaitPromise:true.
const MEASURE_EXPR = `
(async () => {
  await document.fonts.ready;
  if (!document.fonts.check("11px 'JetBrains Mono'")) {
    return { fontReady: false };
  }
  const resolvedFamilies = [...document.fonts]
    .filter((f) => f.family.replace(/["']/g, "") === "JetBrains Mono" && f.status === "loaded")
    .map((f) => f.family);

  const monoRun = document.getElementById("mono-run");
  const monoChPx = monoRun.getBoundingClientRect().width / 40;

  const node = document.getElementById("node");
  const nodeMinPx = node.getBoundingClientRect().width;

  const figure = document.getElementById("figure");
  const narrowestContentPx = await new Promise((resolvePx) => {
    const ro = new ResizeObserver((entries) => {
      resolvePx(entries[0].contentRect.width);
      ro.disconnect();
    });
    ro.observe(figure);
  });

  return {
    fontReady: true,
    resolvedFontFamily: resolvedFamilies[0] ?? null,
    resolvedFontFamilies: resolvedFamilies,
    monoChPx,
    nodeMinPx,
    narrowestContentPx,
  };
})()
`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const tmpHtmlDir = mkdtempSync(join(tmpdir(), "figure-type-page-"));
  const htmlPath = join(tmpHtmlDir, "measure.html");
  writeFileSync(htmlPath, THROWAWAY_HTML);
  const fileUrl = pathToFileURL(htmlPath).toString();

  const cdpPort = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), "figure-type-edge-"));
  const edgeProc = await startEdge(cdpPort, userDataDir);
  console.log(`measure-figure-type: Edge headless up, CDP port ${cdpPort} (pid ${edgeProc.pid})`);

  let client;
  let result;
  try {
    await waitForCdpReady(cdpPort, 15000);
    const target = await getFirstPageTarget(cdpPort);
    client = new CdpClient(target.webSocketDebuggerUrl);
    await client.waitOpen();
    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const loaded = client.send("Page.navigate", { url: fileUrl }).then(() =>
      new Promise((res) => {
        const handler = () => res();
        client.ws.addEventListener("message", function onMsg(ev) {
          const msg = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString());
          if (msg.method === "Page.loadEventFired") {
            client.ws.removeEventListener("message", onMsg);
            handler();
          }
        });
      }),
    );
    await loaded;
    // Let the stylesheet <link> resolve and layout settle before evaluating.
    await sleep(300);

    // document.fonts.ready has no hard timeout on its own — if this run has
    // no network, the font never resolves and the promise can hang forever.
    // Race it against an explicit timeout so a no-network environment STOPs
    // with a clear report instead of hanging or (worse) silently falling
    // back to a measurement of the fallback face.
    const evalPromise = client.send("Runtime.evaluate", {
      expression: MEASURE_EXPR,
      returnByValue: true,
      awaitPromise: true,
    });
    const timeoutMs = 20000;
    const timedOut = Symbol("timeout");
    const raced = await Promise.race([
      evalPromise,
      sleep(timeoutMs).then(() => timedOut),
    ]);
    if (raced === timedOut) {
      throw new Error(
        `document.fonts.ready did not resolve within ${timeoutMs}ms — this looks like the ` +
          `no-network case the plan calls out explicitly. STOP: do not fall back to measuring ` +
          `whatever monospace face is available.`,
      );
    }
    const evalRes = raced;
    if (evalRes.exceptionDetails) {
      throw new Error(`page evaluation threw: ${JSON.stringify(evalRes.exceptionDetails)}`);
    }
    result = evalRes.result.value;
    if (!result || result.fontReady === false) {
      throw new Error(
        "document.fonts.check(\"11px 'JetBrains Mono'\") returned false after document.fonts.ready " +
          "resolved — the real face never became available. STOP: do not fall back to measuring " +
          "whatever face is available and do not stub the numbers.",
      );
    }
  } finally {
    if (client) client.close();
    killEdgeByProfile(userDataDir, "Edge headless");
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
    try {
      rmSync(tmpHtmlDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }

  const fixture = {
    measuredAt: new Date().toISOString(),
    tool: "tools/measure-figure-type.mjs",
    task: "S3 PR-A task A2a",
    resolvedFontFamily: result.resolvedFontFamily,
    resolvedFontFamilies: result.resolvedFontFamilies,
    monoChPx: result.monoChPx,
    nodeMinPx: result.nodeMinPx,
    narrowestContentPx: result.narrowestContentPx,
    // Ledger claim 13: ResizeObserver's contentRect is the content box
    // (padding and border already excluded). narrowestContentPx is measured
    // via ResizeObserver directly, so it is in the content box. monoChPx and
    // nodeMinPx are measured via getBoundingClientRect() on elements with no
    // border (box-sizing:border-box), where padding is part of the measured
    // box on purpose (NODE_MIN_PX is defined in layout.ts as including the
    // node's own padding).
    observedBox: "content",
    notes:
      "monoChPx and nodeMinPx are getBoundingClientRect() widths on borderless " +
      "box-sizing:border-box elements (node's width intentionally includes its " +
      "own 9px 10px padding, per layout.ts's NODE_MIN_PX contract). " +
      "narrowestContentPx is measured via ResizeObserver.contentRect, the same " +
      "API the real Figure component reads, which excludes padding and border.",
  };

  // Poll-free write: writeFileSync is synchronous, but keep the existence
  // check anyway since this fixture's presence gates task A2's file-ordering
  // requirement (fixture before layout.ts).
  writeFileSync(OUT_JSON, JSON.stringify(fixture, null, 2) + "\n");
  let waited = 0;
  while (!existsSync(OUT_JSON) && waited < 5000) {
    await sleep(100);
    waited += 100;
  }
  if (!existsSync(OUT_JSON)) {
    throw new Error(`measure-figure-type: wrote but could not confirm ${OUT_JSON} exists after ${waited}ms`);
  }

  console.log(`measure-figure-type: wrote ${OUT_JSON}`);
  console.log(`measure-figure-type: ${JSON.stringify(fixture, null, 2)}`);
}

/** Same profile-scoped kill as tools/measure-battle-layout.mjs: Edge's
 * headless launcher re-execs into a real browser process with its own
 * crashpad/gpu/utility/renderer children outside the launcher PID's own
 * process tree, so a plain `taskkill /T` on the launcher PID does not reap
 * them. Enumerate msedge.exe processes via WMI and match each one's own
 * command line against this run's unique --user-data-dir path, never by
 * image name alone (the owner routinely runs unrelated msedge.exe
 * processes). */
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
      console.log(`measure-figure-type: ${label} — no msedge.exe processes matched profile ${userDataDir}`);
      return;
    }
    for (const pid of pids) {
      spawnSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
    }
    console.log(`measure-figure-type: ${label} — killed ${pids.length} PID(s): ${pids.join(", ")}`);
  } catch (e) {
    console.warn(`measure-figure-type: could not enumerate/kill ${label} by profile: ${e.message}`);
  }
}

main().catch((err) => {
  console.error("measure-figure-type: FAILED", err);
  process.exitCode = 1;
});
