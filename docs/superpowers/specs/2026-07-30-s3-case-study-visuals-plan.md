# S3 — case-study visuals (design-locked)

> **Written for builder-subagent execution. If something does not match what this plan says, STOP and report rather than guess.**
>
> Design lock: `docs/design-system.md` (layout D, figure style 4 house / style 2 override). Owner picked both in the 2026-07-30 design phase. Do not re-open either decision.

## Blast radius: HIGH

Raised from MEDIUM at the pass-1 critique gate. The data axis is clean (no persisted data, no serialized types, no migrations, no cross-process contracts), and on that axis alone this reads as MEDIUM. It is HIGH on the irreversibility axis instead, and the decisive evidence is this repo's own history rather than a rubric bullet: in July 2026 the public docs enumerated the confidentiality landmine list, and the only available remedy was deleting the GitHub repo and recreating it from a single scrubbed commit, losing every PR discussion. A leak here is not "caught in review and reverted," it is that again. Two of the six figures describe UWM systems and every node label, channel and value in them is a publish-once surface.

Gates that therefore apply: claim ledger + measured baseline, preflight recheck before the first builder, **two dissect passes with the second pinned to a non-author model**, and fixed-lens diff review on **every** commit, not only the risky ones. No schema-evolution guard test is owed (no serialized type changes).

**Substitution, stated so it can be attacked rather than quietly skipped:** HIGH normally requires a synthetic-corpus dry run before deploy. There is no data corpus in this milestone. The equivalent composition check is the A6 capture sweep, which drives the real page through the real renderer at real viewports and judges the result visually. If a reviewer thinks that is not equivalent, say so rather than accepting it.

## Claim ledger

| # | Claim | Verified at (commit) | Recheck (pwsh, exit 0 = holds) |
|---|-------|----------------------|--------------------------------|
| 1 | Baseline: 805 tests across 21 files, all green (measured in-session, `npm test -- --run`, 1.91s) | `5b5bbb4` | `npm test -- --run` |
| 2 | `vitest.config.ts` `test.include` is `["src/battle/**/*.test.ts","src/progress/**/*.test.ts"]` \| a new dir is invisible until added | `5b5bbb4` | `Select-String -Path vitest.config.ts -Pattern 'src/battle/\*\*/\*.test.ts' -Quiet` |
| 3 | The placeholder banner is `CaseStudyPage.tsx` lines 134-156, gated on `isProject`, text `PROJECT SHOT / DIAGRAM` | `5b5bbb4` | `Select-String -Path src/components/CaseStudyPage.tsx -Pattern 'PROJECT SHOT / DIAGRAM' -Quiet` |
| 4 | `content.ts` holds exactly 6 project items, slugs: `mia`, `backend-harness`, `the-failure-that-left-no-logs`, `observability-by-default`, `notification-dispatch`, `curio` | `5b5bbb4`, re-inspected `835c228` | `Select-String -Path src/content.ts -Pattern 'slug: "curio"' -Quiet` |
| 5 | `vite.config.ts` errors the build if the slug-shell count is not 8 (6 projects + 2 experience) | `5b5bbb4` | `Select-String -Path vite.config.ts -Pattern 'count !== 8' -Quiet` |
| 6 | Repo has zero `.test.tsx`, no jsdom, no happy-dom, no testing-library \| component logic must live in `.ts` to be testable | `5b5bbb4` | `if ((Get-ChildItem -Recurse src -Filter *.test.tsx).Count -eq 0) { exit 0 } else { exit 1 }` |
| 7 | Coverage thresholds are per-glob aggregates at 95 branches for `src/battle/**` and `src/progress/**` | `5b5bbb4` | `Select-String -Path vitest.config.ts -Pattern 'branches: 95' -Quiet` |
| 8 | Route prefixes are `/work/<slug>/` and `/experience/<slug>/`, never `/projects/` | `5b5bbb4` | `Select-String -Path src/router.ts -Pattern '/work/' -Quiet` |
| 9 | Every caption string below is a verbatim substring of that item's `summary` in `content.ts` | `5b5bbb4`, re-inspected `835c228` | — (enforced by the A3 registry test, not by a grep) |
| 10 | **UNVERIFIED.** `MONO_CH_PX = 6.6` is the advance width of one JetBrains Mono character at 11px with `.08em` letter-spacing | not measured | — (task A2a measures it before anything trusts it) |
| 11 | **UNVERIFIED.** `NODE_MIN_PX = 96` is wide enough to render a 12-character label without breaking the word | not measured | — (task A2a measures it before anything trusts it) |
| 12 | **UNVERIFIED.** The figure's **content-box** width at a 320px viewport is ~238px: 320 − 2×20 (page padding at the `clamp` floor) − 2×20 (figure padding) − 2 (border) | derived, not measured | — (task A2a measures it and records which box it measured) |
| 13 | `ResizeObserver` `entry.contentRect.width` is the **content box**: padding and border already excluded | spec behaviour, not measured here | — (A2a records the observed box explicitly so the domain is checkable) |

**Ledger-format correction, build session 2026-07-31.** The first preflight run FAILed six rows (4, 9, 10, 11, 12, 13) because their recheck cells carried prose (`**none — task A2a measures it**`, `enforced by the A3 test`) where the workflow's parser expects either a runnable command or a bare `—`. It executed the prose as a shell command, so every one of those FAILs was a formatting defect, not a stale claim. **A recheck cell is a command or `—`, never an explanation** — put the explanation in parentheses after the dash, where it is readable but not executed. The unautomatable rows were then verified by inspection at `835c228` before any builder ran: claim 4 by grepping `src/content.ts` (exactly the 6 named project slugs, plus `software-engineer` and `arizona-state-university`), and claim 9 by reading all six summaries and confirming each caption is a character-for-character substring. Claim 4 also got a real recheck command, since one anchoring slug grep is cheap and catches a roster change. Claims 10 to 13 stay `—` on purpose: they are the UNVERIFIED rows A2a exists to measure.

**Claims 10 to 13 were reasoned, not measured, and the pass-1 critic was right to call that out.** They are labelled UNVERIFIED on purpose. Task A2a measures them against a real render before any downstream task treats them as facts, and the plan expects the numbers to move. Do not silently adjust a constant to make a test pass: if a measurement contradicts one of these rows, report the measured value and STOP, because the caps in task A3 are derived from them.

### The width domain, declared once

Every width in `src/figures/` is a **content-box** width, because that is what `ResizeObserver` hands the renderer. The page's own chain is: viewport → content column (border-box, `min(960, vw) − 2 × clamp(20px,5vw,44px)`) → figure container content box (that, minus `2 × 20px` padding and `2 × 1px` border). Pass 2 caught the original plan subtracting the figure's padding a second time inside `logTextWidthPx`, after `contentRect` had already excluded it, which understated the available text width by about 42px. **Never subtract `FIGURE_PAD_PX` in a layout function.** If a number in this plan is not a content-box width, it says so.

## Scope

Three PRs. **Only PR-A is builder-executable today.** PR-B needs screenshots that do not exist yet, and PR-C needs a design loop with owner approval per emblem.

- **PR-A — the figure system.** Kills the placeholder banner and gives all six case studies a real figure. Independently shippable and is the milestone's substance.
- **PR-B — Curio screenshots.** Owner captures, per-shot confidentiality gate, added alongside Curio's PR-A figure.
- **PR-C — the six leaded-glass sigils** plus the identity mark slot in the head.

### Decisions taken in this plan (owner can overturn any of them in a sentence)
- **PR-A ships no identity mark.** Direction D showed one, but a placeholder mark would sit inches from the `03 / 06` rail the head already renders, and it would be built only to be replaced in PR-C. The mark slot arrives with the sigils. This is a stated narrowing, not a silent one.
- **Curio gets a flow figure in PR-A, and keeps it in PR-B.** Its story is the self-hosted companion, which is linear and true; the 4-apps-into-1 story is already carried by its metric cards, so the screenshots add evidence rather than replace the figure.
- **S3 creates an obligation for S3b, recorded here so its planner meets it in the plan rather than in a red test.** Registry test 2 asserts bidirectional slug coverage, and `vite.config.ts:78` errors the build if the shell count is not 8. So the sanctioned 7th roster entry ("Building this site") cannot ship without its own figure, whose caption must be a verbatim substring of prose that does not exist yet and can only come from an owner interview. That is correct behaviour and a real coupling.
- **Per-project `og:image` is out of scope.** Every share shell currently points at `/og-station.png` (`vite.config.ts:20`). Rendering each figure to a 1200x630 OG card is a natural follow-on and a real improvement to link previews, and it is a separate milestone with its own asset pipeline. Recorded here so it is a deferral, not an oversight.

---

# PR-A — the figure system

Branch: `feat/s3-case-study-figures`.

## Architecture, and why it is shaped this way

`vitest.config.ts` collects only `src/battle/**` and `src/progress/**`, there is no DOM test environment, and zero `.test.tsx` exist. So a figure component dropped into `src/components/` would be untested and silently uncollected. The work therefore splits the way `battle/layout.ts` was carved out of `BattleScene.tsx` in M7: **all decisions live in pure `.ts` modules under `src/figures/`, and the `.tsx` renders what they return.**

The reflow decision is driven by a `ResizeObserver` reading the figure container's real width, never by replicating the CSS `clamp()` in JS. Predicting a rendered dimension is how M12 lost 12px of margin it thought it had. Before the first measurement lands, the component renders the stacked orientation, because stacked is always legible and horizontal is not.

## Task A1 — make the new directory visible to vitest

Edit `vitest.config.ts` only. Add `src/figures/` to all three lists:

```ts
export default defineConfig({
  test: {
    include: ["src/battle/**/*.test.ts", "src/progress/**/*.test.ts", "src/figures/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/battle/**/*.ts", "src/progress/**/*.ts", "src/figures/**/*.ts"],
      thresholds: {
        "src/battle/**/*.ts": { branches: 95 },
        "src/progress/**/*.ts": { branches: 95 },
        "src/figures/**/*.ts": { branches: 95 },
      },
    },
  },
});
```

Run `npm test -- --run`. Expected: still 805 passed, 21 files. If the count moved, STOP and report.

Commit: `test: collect src/figures in vitest`.

## Task A2a — measure the three constants before anything trusts them

Ledger claims 10 to 12 are reasoned, not measured. This task turns them into measurements, and it comes first because tasks A2 and A3 derive their caps from them. **Expect the numbers to move.**

Write `tools/measure-figure-type.mjs`, modelled on the existing `tools/measure-battle-layout.mjs`. It must take its output directory as an argv parameter and write to `docs/design-labs/s3-figures/` — never a hardcoded path, and never a directory a previous milestone owns. M12 silently overwrote all twelve of M7's clip baselines that way, and the only signal was pre-existing binaries showing as modified in the diff.

**Font readiness is the trap that would make this whole task worthless.** `index.html:10` loads JetBrains Mono from Google Fonts with `display=swap`, so text renders and is measurable in a fallback monospace before the real face arrives, and forever if the headless run has no network. A rig that does not wait produces confident numbers for the wrong typeface, and test 5 then pins them with 1px authority. The script must therefore, before measuring anything:

```js
await document.fonts.ready;
if (!document.fonts.check("11px 'JetBrains Mono'")) {
  throw new Error("JetBrains Mono did not load — measurement would record a fallback face");
}
```

and record the resolved font family in the fixture so a reviewer can see which face was measured.

The script renders a throwaway page carrying the site's real font stack and the figure's real type spec (JetBrains Mono, 11px, `letterSpacing: .08em`), then measures and writes a JSON fixture containing:

1. `monoChPx` — the advance width of a 40-character mono run divided by 40.
2. `nodeMinPx` — the width of a node box containing the literal `ORCHESTRATOR` (12 characters, the longest single word in the registry and the exact boundary the legibility cap guards) with the node's real `9px 10px` padding, measured at **`width: max-content`**. Measure it at max-content, do not search for the width at which the word stops wrapping: a search seeded near the placeholder would measure the value it exists to correct.
3. `narrowestContentPx` — the figure container's content-box width at a 320px viewport, driven through the real `CaseStudyPage` padding chain rather than computed.
4. `observedBox` — the literal string `"content"` or `"border"`, naming which box each measurement is in. Ledger claim 13 is only checkable if the fixture says.

Traps: use classic `--headless`, not `--headless=new`, which exits 0 and writes no PNG on this machine. Give Edge its own `--user-data-dir` or it delegates to a running instance and writes nothing. The writes are async, so poll for the file rather than testing for it immediately.

**This task writes the fixture and nothing else.** It does not edit `src/figures/layout.ts`, which does not exist yet — task A2 creates it and takes its constants from this fixture, rounding **up** for `NODE_MIN_PX` and `MONO_CH_PX` (a too-generous floor stacks a row that would have fitted, which is safe; a too-tight one ships an unreadable node, which is not).

If a measured value differs from claims 10 to 13 by more than 15%, report it and STOP before continuing — the task A3 caps are derived from these. **Expect `NODE_MIN_PX` to land near 100 rather than 96**: 12 characters of text plus the node's own `2 × 10px` padding exceeds 96 on the placeholder numbers alone.

Commit: `test(figures): measure the type metrics the layout constants rest on`.

## Task A2 — figure types and layout (TDD)

**Write `src/figures/layout.test.ts` first and watch it fail before writing the module.**

`src/figures/types.ts`:

```ts
export type Tone = "default" | "fix" | "fault" | "muted";

export interface FigureNode {
  label: string;
  tone: Tone;
}

export interface FlowRow {
  nodes: FigureNode[];
}

export interface LogLine {
  channel: string;
  value: string;
  tone: Tone;
}

export interface FlowFigure {
  kind: "flow";
  rows: FlowRow[];
  caption: string;
}

export interface LogFigure {
  kind: "log";
  lines: LogLine[];
  caption: string;
}

export type Figure = FlowFigure | LogFigure;

export type Orientation = "row" | "column";
export type LogMode = "inline" | "stacked";
```

`src/figures/layout.ts`:

```ts
import type { FlowFigure, LogFigure, Orientation, LogMode } from "./types";

/**
 * Narrowest a node may render and still hold its longest word on one line.
 * MEASURED in task A2a against a real render of "ORCHESTRATOR" and asserted
 * against the recorded fixture. 96 is the pre-measurement placeholder; replace
 * it with the measured value rounded up, do not leave this literal in place.
 */
export const NODE_MIN_PX = 96;
/** Gap + arrow glyph + gap between two nodes. */
export const CONNECTOR_PX = 22;
/** Node's own horizontal padding, one side. Task A4 renders `9px 10px`. */
export const NODE_PAD_PX = 10;
/**
 * Figure container padding, one side. Reference only: it is already excluded
 * from every width in this module, because ResizeObserver reports the content
 * box. Do not subtract it in a layout function.
 */
export const FIGURE_PAD_PX = 20;
/** Left rule (2px) plus the stacked-mode value indent. */
export const LOG_INDENT_PX = 12;
/**
 * Advance width of one JetBrains Mono char at the figure's 11px + .08em.
 * MEASURED in task A2a. 6.6 is the pre-measurement placeholder.
 */
export const MONO_CH_PX = 6.6;

/** Text width available to a log line. `contentPx` is already padding-free. */
export function logTextWidthPx(contentPx: number): number {
  return contentPx - LOG_INDENT_PX;
}

/** Longest log value, in characters, that fits at the narrowest real container. */
export function maxLogValueChars(narrowestContentPx: number): number {
  return Math.floor(logTextWidthPx(narrowestContentPx) / MONO_CH_PX);
}

/** Longest single word, in characters, a node can hold on one line. */
export function maxLabelWordChars(): number {
  return Math.floor((NODE_MIN_PX - 2 * NODE_PAD_PX) / MONO_CH_PX);
}

/** Page padding at a viewport width. Replicates `clamp(20px, 5vw, 44px)`. */
export function pagePadPx(vw: number): number {
  return Math.min(Math.max(20, vw * 0.05), 44);
}

/**
 * Figure content-box width at a viewport width. This is a REPLICATION of the
 * CSS chain, not a measurement, and it exists so the viewport sweep can assert
 * in the domain the layout functions actually consume. It is pinned to reality
 * at one point: a test asserts it agrees with the A2a fixture at 320px. If the
 * page's padding or the figure's chrome changes, that test is what fails.
 */
export function contentWidthForViewport(vw: number): number {
  return Math.min(960, vw) - 2 * pagePadPx(vw) - 2 * FIGURE_PAD_PX - 2;
}

export function rowFits(nodeCount: number, availablePx: number): boolean {
  if (nodeCount <= 1) return true;
  return nodeCount * NODE_MIN_PX + (nodeCount - 1) * CONNECTOR_PX <= availablePx;
}

export function nodeWidthPx(nodeCount: number, availablePx: number): number {
  if (nodeCount <= 0) return 0;
  const connectors = (nodeCount - 1) * CONNECTOR_PX;
  return (availablePx - connectors) / nodeCount;
}

/**
 * The one width at which EVERY flow figure in the registry flips orientation.
 * Deriving a single threshold across the whole registry is what makes the
 * uniformity claim true. A per-figure `rows.every(rowFits)` test would let a
 * 3-node figure render horizontally while a 4-node one stacked, on the same
 * device, in a real band of viewport widths. Pass 2 caught that: the original
 * `STACK_BELOW_PX = 420` constant claimed uniformity it did not deliver.
 */
export function uniformRowThresholdPx(figures: FlowFigure[]): number {
  let widest = 0;
  for (const f of figures) {
    for (const r of f.rows) {
      const n = r.nodes.length;
      if (n <= 1) continue;
      widest = Math.max(widest, n * NODE_MIN_PX + (n - 1) * CONNECTOR_PX);
    }
  }
  return widest;
}

export function orientationFor(thresholdPx: number, availablePx: number): Orientation {
  if (!Number.isFinite(availablePx)) return "column";
  return availablePx >= thresholdPx ? "row" : "column";
}

export function logLineWidthPx(line: { channel: string; value: string }): number {
  return (line.channel.length + 2 + line.value.length) * MONO_CH_PX;
}

export function logModeFor(figure: LogFigure, availablePx: number): LogMode {
  if (!Number.isFinite(availablePx)) return "stacked";
  const widest = figure.lines.reduce((m, l) => Math.max(m, logLineWidthPx(l)), 0);
  return widest <= logTextWidthPx(availablePx) ? "inline" : "stacked";
}
```

Required tests in `layout.test.ts`:

1. `rowFits` boundary is exact both ways, with the boundary **computed from the constants**, never hardcoded: `const b = 4 * NODE_MIN_PX + 3 * CONNECTOR_PX;` then assert `rowFits(4, b)` is true and `rowFits(4, b - 1)` is false. Writing the literal `450` here would encode the pre-measurement placeholder and go red the moment task A2a does its job, which is how a builder ends up quietly restoring 96.
2. `rowFits(1, 0)` and `rowFits(0, 0)` are true.
3. `uniformRowThresholdPx` over the registry's flow figures equals the widest single row requirement, and every figure returns the same orientation at any given width. Assert the second part directly: for each width in the sweep, the set of orientations across all flow figures has exactly one member. That is the uniformity property, stated as a test rather than as a comment.
4. `orientationFor` returns `"column"` for `NaN` and for `Infinity`. (`Infinity` is finite-false, so it stacks. That is deliberate: an unmeasured container must never render horizontal.)
4b. `contentWidthForViewport(320)` is within 1px of the A2a fixture's `narrowestContentPx`. This is the only thing pinning the CSS replication to reality, so if it fails the replication is wrong and the sweeps below are meaningless.
5. **The constants match their measurements.** `NODE_MIN_PX` and `MONO_CH_PX` are each within 1px of the value recorded in the task A2a fixture. This is the test that gives the constants their authority, and without it everything below is decoration.
6. `logModeFor` returns `"stacked"` when the widest line exceeds `logTextWidthPx(width)`, `"inline"` when it exactly equals it. Note it compares against the **text** width, not the container width: the figure's own `20px` padding either side and the `12px` rule-and-indent do not hold text.

**Do not write the test that says "`nodeWidthPx` is at or above `NODE_MIN_PX` whenever `orientationFor` returned `row`."** It looks like the legibility invariant and it is a tautology: `nodeWidthPx` and `rowFits` are algebraic rearrangements of the same inequality, so it passes for any value of `NODE_MIN_PX`, including absurd ones. The pass-1 critic caught this and it is the M12 vacuous-gate lesson repeating. The real chain is test 5 above (the constant is measured) plus the A6 capture (a human-judged render), and neither is replaceable by arithmetic.

Run `npm test -- --run`. Expected: 805 + your new tests, all green, and `src/figures/**` at or above 95% branches. **Run the discrimination probe before moving on**: comment out one test, confirm coverage drops, restore it. A `/* v8 ignore */` on a line carrying live logic read as 100% in M6 and suppressed a real branch.

Commit: `feat(figures): pure layout module with the legibility invariant`.

## Task A3 — the figure registry (TDD)

**Write `src/figures/registry.test.ts` first.**

`src/figures/registry.ts` maps a project slug to its figure. Slugs must match `content.ts` exactly.

```ts
import type { Figure } from "./types";

export const FIGURES: Record<string, Figure> = {
  mia: {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "VOICE OR TEXT", tone: "default" },
          { label: "DEDICATED NUMBER", tone: "default" },
          { label: "PERSONAL MIA", tone: "fix" },
        ],
      },
    ],
    caption: "You cannot do that with a shared short code",
  },
  "backend-harness": {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "ORCHESTRATOR", tone: "default" },
          { label: "IMPLEMENTER", tone: "default" },
          { label: "EVALUATOR", tone: "default" },
          { label: "MUTATION GATE", tone: "fix" },
        ],
      },
      {
        nodes: [
          { label: "OSCILLATION", tone: "fault" },
          { label: "ESCALATE", tone: "fix" },
        ],
      },
    ],
    caption: "the implementer cannot pass by grading its own work",
  },
  "the-failure-that-left-no-logs": {
    kind: "log",
    lines: [
      { channel: "topic.orders", value: "delivered", tone: "muted" },
      { channel: "topic.orders.retry", value: "attempt 1", tone: "muted" },
      { channel: "topic.orders.retry", value: "error 400 html body", tone: "fault" },
      { channel: "app.ingress", value: "no entry", tone: "muted" },
      { channel: "app.handler", value: "no entry", tone: "muted" },
    ],
    caption: "just because every tool says everything is fine does not mean it is",
  },
  "observability-by-default": {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "MANUAL SETUP", tone: "muted" },
          { label: "PER TEAM", tone: "muted" },
          { label: "SKIPPED", tone: "fault" },
        ],
      },
      {
        nodes: [
          { label: "API AUTOMATION", tone: "fix" },
          { label: "GOLDEN SIGNALS", tone: "default" },
          { label: "HEALTH PICTURE", tone: "default" },
        ],
      },
    ],
    caption: "Observability became a one-button setup, realistic to roll out across many services.",
  },
  "notification-dispatch": {
    kind: "log",
    lines: [
      { channel: "stream.notify", value: "queued", tone: "muted" },
      { channel: "stream.notify", value: "attempt 1 failed", tone: "default" },
      { channel: "stream.notify", value: "attempt 2 failed", tone: "fault" },
      { channel: "stream.notify.dead", value: "held for inspection", tone: "fix" },
      { channel: "metrics.dispatch", value: "depth and lag exported", tone: "muted" },
    ],
    caption: "routes anything that ultimately fails into a dead-letter queue",
  },
  curio: {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "ONE LIBRARY", tone: "default" },
          { label: "DESKTOP APP", tone: "default" },
          { label: "SELF HOSTED", tone: "default" },
          { label: "PHONE COMPANION", tone: "fix" },
        ],
      },
    ],
    caption: "The desktop app self-hosts as the server for that companion.",
  },
};

export function figureFor(slug: string | undefined): Figure | null {
  if (!slug) return null;
  return FIGURES[slug] ?? null;
}
```

Required tests in `registry.test.ts`. These are the constraint gates, and they are the reason this milestone can add user-facing strings without triggering the owner-voice interview requirement.

1. **Caption provenance.** For every slug in `FIGURES`, find the matching item in `CATS` and assert `caption` is a substring of `item.summary ?? item.body`. This is what keeps hard constraint 1 untriggered: no caption is new prose, every one is Yovan's own sentence reused. A caption that fails this test is not fixed by editing the test.
2. **Slug coverage.** Every project item in `CATS` with a slug has an entry in `FIGURES`, and `FIGURES` has no key that is not a project slug. Guards against a roster change silently leaving a case study figureless.
3. **Punctuation rule.** No figure string (label, channel, value, caption) contains an em dash, an en dash, or a semicolon. Assert over every string in the registry, not a sample.
4. **Legibility cap, derived.** Every node label's longest whitespace-delimited word is at most `maxLabelWordChars()`. **Call the function, do not inline a number.** The plan originally justified a hardcoded 12 with "12 chars at `MONO_CH_PX` is 79px, inside the 96px floor," which forgot the node's own `2 × 10px` padding — 79px of text needs a ~99px node, so the placeholder floor was already too small by its own arithmetic. Pass 2 caught it. The derived cap moves with the measured constants instead.
5. **Log line cap, derived.** Assert every `channel` is at most 24 chars and every `value` at most `maxLogValueChars(NARROWEST_CONTENT_PX)`, where `NARROWEST_CONTENT_PX` is read from the A2a fixture's `narrowestContentPx` (roughly 238, the figure's **content box** at a 320px viewport). **Call the function, do not inline the number.** The plan first hardcoded 42 against the wrong box twice over, and pass 1 and pass 2 each corrected one of those errors.
6. **Tone discipline.** `fault` appears at most once per figure. It means "this is where it broke" and loses that meaning if it is used for emphasis.
7. **Flow viewport sweep, in the container domain.** Export a `VIEWPORTS` array covering at least `[320, 360, 390, 480, 510, 560, 768, 800, 1024, 1280, 1440]` and map each through `contentWidthForViewport` before calling any layout function. **Never pass a viewport width straight into `orientationFor`** — it consumes content-box widths, and at a 768 viewport the real content box is around 649, so a sweep over raw viewport numbers asserts behaviour at widths that never occur. Assert: `"column"` at 320, 360 and 390; `"row"` at 768 and above; and identical orientation across all figures at every width (the uniformity property from layout test 3). 510 is in the list specifically because it sits in the band where the old per-figure rule would have disagreed between `mia` and `curio`.
8. **Log viewport sweep, in the container domain.** Same mapping. For every log figure at every viewport, assert `logModeFor` returns `"inline"` only when the widest line genuinely fits `logTextWidthPx(content)`, and that every stacked value fits the text width at 320. The flow kind had a sweep and the log kind did not, which is the M7 lesson: an invariant only guards the actors you named.
9. **No prose in labels.** Every node label matches `/^[A-Z0-9 ]+$/` and contains no article or conjunction (`A`, `AN`, `THE`, `AND`, `OR` as standalone words — except `OR` in `VOICE OR TEXT`, which is a channel enumeration and is the one allowed exception; encode it as an explicit allowlist entry so a future addition has to justify itself). Every log `channel` matches `/^[a-z0-9.]+$/`. This automates design-system binding rule 1's "bare technical noun, not a sentence" clause, which was the only sub-rule with no test.

Expected: all green. Note that `registry.ts` is mostly data, so watch the branch threshold on the `src/figures/**` aggregate. If it fails because a data file reports zero branches, report the number and STOP rather than lowering the threshold.

Commit: `feat(figures): the six case-study figures with constraint gates`.

## Task A4 — the renderer

`src/components/Figure.tsx`. Thin. All decisions come from `src/figures/layout.ts`.

- Takes `{ figure: Figure }`.
- Holds a `ref` on its outer container and a `ResizeObserver` writing `entry.contentRect.width` into state. **This is the content box, padding and border already excluded, and it is the domain every function in `layout.ts` expects.** Do not subtract the figure's padding again anywhere in this component. Initial state is `0`, which makes `orientationFor` and `logModeFor` return the stacked forms, so the first paint is always legible. Disconnect the observer on unmount.
- Compute the threshold once with `uniformRowThresholdPx(flowFigures)` over the registry, not per figure, so every case study flips orientation at the same width.
- Known and accepted: a font swap can transiently wrap a 12-character label, because the orientation decision does not re-fire on `document.fonts` load. It is one frame on first visit and self-corrects on the next resize. Do not add a font-load listener for it.
- Renders the tone table from `docs/design-system.md` exactly. Do not invent values: `default` is `rgba(80,150,255,.1)` / `rgba(140,185,255,.24)` / `#aec6ee`; `fix` is the emphasis gradient `linear-gradient(100deg, rgba(80,150,255,.26), rgba(80,150,255,.06))` / `rgba(140,185,255,.4)` / `#eaf2ff`; `fault` is `rgba(255,110,80,.12)` / `rgba(255,139,107,.5)` / `#ffb9a3`; `muted` is `rgba(80,150,255,.04)` / `rgba(140,185,255,.12)` / `#5f7196`.
- Flow nodes: `borderRadius: 11px`, mono `11px`, `letterSpacing: .08em`, padding `9px 10px`, `textAlign: center`. Connector is `▸` in `#7fb0ff` for a row and `▾` for a column.
- Log block: mono `11px`, `lineHeight: 2`. A non-`muted` line carries a 2px left rule in its tone's border colour with `borderRadius: 0` (the design system forbids rounded corners on single-sided borders). `inline` mode puts channel and value on one line with the value at `#7f93b8`; `stacked` mode puts the value on its own indented line.
- Caption: mono `9.5px`, `#7f93b8`, `marginTop: 11px`.
- Container: `border: 1px solid rgba(140,185,255,.22)`, `borderRadius: 13px`, `padding: 18px 20px`, `background: linear-gradient(160deg, rgba(20,40,78,.5), rgba(10,18,38,.45))` (the existing metric-card fill, so the figure reads as a sibling of the metrics).
- Accessibility: the container gets `role="img"` and an `aria-label` built from the caption. Screen readers get the sentence, which is his own prose, rather than a pile of disconnected labels.

No test file for this component (the repo has no DOM test environment, and adding one is out of scope). Its correctness is covered by the pure module plus the visual verdict in A6. **If you find yourself putting a conditional in this file that is not a direct read of a `layout.ts` return value, that logic belongs in `layout.ts` instead.**

Commit: `feat(figures): figure renderer`.

## Task A5 — case-study page surgery

`src/components/CaseStudyPage.tsx`, three edits:

1. **Delete the placeholder banner** — the whole `{isProject && (...)}` block currently at lines 134-156, including the `PROJECT SHOT / DIAGRAM` span. The `isProject` const stays if it is still used; if the deletion leaves it unused, delete it too and confirm `npm run build` stays green (`tsconfig.app.json` type-checks all of `src`, so an unused const surfaces there, not at runtime).
2. **Import and mount the figure** directly after the OVERVIEW prose block and before the `STACK` label. Resolve it with `figureFor(item?.slug)`, and put the spacing wrapper **inside** the conditional:

   ```tsx
   {fig && (
     <div style={{ marginBottom: "46px" }}>
       <Figure figure={fig} />
     </div>
   )}
   ```

   The wrapper must not be unconditional. `CaseStudyPage` also renders the two experience entries (`software-engineer`, `arizona-state-university`), neither of which has a registry entry, and an unconditional wrapper would give both of them an empty 46px spacer and shift the OVERVIEW-to-STACK gap. Those two pages are the graceful-degradation case direction D was chosen for, and the property has to be literally true, not nearly true.
3. **No other change to the head.** The meta line, title, period chip and metric cards keep their current order and styling. The identity-mark slot arrives in PR-C.

Verify: `npm run build` (not `npx tsc --noEmit`, which is a no-op in this repo because the root tsconfig is solution-style) and `npm test -- --run`.

Commit: `feat(case-study): replace the placeholder banner with the figure system`.

## Task A6 — verification

1. `npm run build` green, and the build's own guard prints `share-shells: wrote 8 slug shells` with no error.
2. `npm test -- --run` green, `src/figures/**` at or above 95 branches.
3. `npm run verify:canon` green (nothing here touches generated canon, so a failure means something unrelated broke and must be reported, not worked around).
4. **Captures.** Headless Edge, desktop widths, at 1440 and 800 each. Enumerate every actor, per the M7 lesson, which means **all six figure pages, not five**:
   - `/work/backend-harness/` — two-row flow, and the only page carrying the 12-character `ORCHESTRATOR` boundary label.
   - `/work/observability-by-default/` — the only page where `fault` and `muted` render as **flow nodes** rather than as a log rule. Pass 2 caught this page missing from a list that claimed to enumerate every actor, which is the M7 lesson landing on the fix for the M7 lesson.
   - `/work/mia/` — single-row flow, three nodes.
   - `/work/curio/` — single-row flow, four nodes, and the thinnest page in the set.
   - `/work/the-failure-that-left-no-logs/` — log with a `fault` line.
   - `/work/notification-dispatch/` — log with `fault` and `fix` in one block.

   Classic `--headless`, not `--headless=new`, which exits 0 and silently writes no PNG on this machine, and pass its own `--user-data-dir` or Edge delegates to a running instance and writes nothing.
5. **Mobile IS capturable, via CDP — do not skip it.** `msedge --headless --window-size=390,...` lays out at ~478px on this machine, so a `--window-size` capture at 390 is a lie. That caveat is about `--window-size` only, and the repo has owned the way around it since M6: drive Edge's `--remote-debugging-port`, apply `Emulation.setDeviceMetricsOverride` before first paint, then `Page.captureScreenshot`. `tools/measure-battle-layout.mjs` is a working example to model on. Two traps recorded with it: Edge delegates to a running instance without its own `--user-data-dir`, and Node 20 needs `--experimental-websocket`.

   Capture **`backend-harness`, `observability-by-default` and one log page at 390 and at 320** this way, and put them through the same judge as the desktop set. This is the stacked form, which is the form the entire design lock exists to protect, and geometry cannot see whether it is ugly, whether the caption collides with the rule, or whether `fault` still draws the eye. That is the M6 lesson: a green suite cannot see a defect that only exists in the rendering.

6. **Then the geometry check, which is a different question from the visual one.** At emulated 320 and 390, measure every log line's `scrollWidth` against its container's `clientWidth` on both log pages. A line whose `scrollWidth` exceeds `clientWidth` is overflowing, and that is the exact defect the original 42-character cap would have shipped. If you use the Browser pane rather than CDP for this, dispatch `new Event("resize")` first or the app keeps rendering desktop chrome at a 390px viewport. The `ResizeObserver` fires on element size change independently of the page `resize` event, so the figure itself is more reliable to verify than the surrounding app chrome.
6. **Sanity-check every capture before judging it**: `pwsh -NoProfile -File ~\.claude\skills\roadmap\helpers\Test-CaptureSane.ps1 <png1> <png2> ...` with bare space-separated paths. A FAIL means fix the capture, not judge it.
7. **Then dispatch a pinned subagent to judge the captures and return a text verdict.** Never load the PNGs into the orchestrator. The verdict must answer: does the figure read as part of the page or as something pasted in; is every label legible; does the eye land on the `fault` line without being told to; and does the page still look finished on Curio, whose figure is the thinnest.
8. **Confidentiality gate before the PR (this is item 9 in the rendered list; references elsewhere say "the confidentiality gate," not a number).** Run the `confidentiality-review` skill over the full diff, with specific attention to every node label, channel and value in `registry.ts`.

   **Three figures describe UWM systems, not two:** `mia`, `observability-by-default`, and `the-failure-that-left-no-logs`, which is a UWM production incident and whose log channels are the most incident-shaped strings in the milestone. An earlier draft of this plan said "the two UWM figures are the ones that matter," which steered the reviewer away from the third. Assert for all three that nothing names an internal service, a team, or a count, and that each would be true of any company. The log channels (`topic.orders`, `topic.orders.retry`, `app.ingress`, `app.handler`, `stream.notify`, `stream.notify.dead`, `metrics.dispatch`) are illustrative synthetic names and must not resemble any real internal naming convention. No regex can judge that, which is why it is a human gate.

## PR-A definition of done

Placeholder banner gone from all six case studies, every project renders its figure, suite green with the legibility invariant enforced, captures judged PASS, confidentiality gate clean, merged via `gh pr merge --merge --delete-branch`.

---

## Critique gate — pass 1 dispositions (sonnet dissect-critic, 2026-07-30)

Verdict FIX-THEN-SHIP. Every finding has an explicit disposition; none were silently dropped.

| Finding | Severity | Disposition |
|---|---|---|
| Blast radius should not be MEDIUM | framing | **Accepted, tier raised to HIGH** — though on different grounds. The critic argued from the rubric's `security/secrets` bullet, which is about code that handles secrets rather than about published content, and confidentiality here already has its own mandatory gate. The decisive argument it did not make is this repo's own July 2026 purge: a public-exposure leak here has already once cost the entire repo. Second dissect pass added, per-commit diff review added, dry-run substitution stated. |
| `NODE_MIN_PX` / `MONO_CH_PX` are unmeasured guesses presented as facts | MAJOR | **Accepted.** Added as UNVERIFIED ledger rows 10 to 12, and task A2a now measures all three against a real render before any downstream task trusts them, with a fixture-backed test asserting the constants match. |
| The legibility invariant is a tautology | MAJOR | **Accepted, and this was the sharpest finding.** The test is deleted and the plan now explicitly forbids writing it, with the reason. Replaced by the measured-constant test plus an intent-based orientation sweep plus the capture gate. |
| Log-line cap arithmetic omits the figure's own padding | MAJOR | **Accepted, my error.** The 42-character cap was measured against the 280px content column and ignored `2×20px` figure padding plus the 12px rule and indent, so it was roughly 40px looser than claimed. The cap is now derived by `maxLogValueChars()` rather than hardcoded, and A6 adds a real `scrollWidth` overflow check at 320 and 390px. The shipped data was never in breach (longest value is 22 characters), so this was a loose guard rather than a live defect. **Pass 2 then found the fix was still wrong in the other direction** (double-subtracting padding that `contentRect` had already excluded); see the pass-2 table. |
| Log kind had no per-viewport sweep | MAJOR (same finding) | **Accepted.** Registry test 8 added. |
| Binding rule 1's "bare technical noun" clause has no test | MINOR | **Accepted, and the fix is partial by design.** Registry test 9 automates the label and channel halves, with `VOICE OR TEXT` as an explicit allowlisted exception so a future addition has to justify itself. The log **values** clause ("synthetic technical output rather than a sentence") stays gate-only: `held for inspection` and `depth and lag exported` are judgement calls a shape regex would either wave through or wrongly reject. Rule 1 is therefore two-thirds automated, not automated. |
| Log channel names have no automated confidentiality backstop | MINOR | **Accepted as stated, no code change.** A regex cannot know what resembles a real internal name; that judgement is the `confidentiality-review` gate in A6, which now names every one of these strings. Recorded so the absence is a decision rather than an oversight. |
| Captures never exercise a single-row flow figure | MINOR | **Accepted, and the first fix was itself incomplete.** A6.4 was rewritten to enumerate "every actor" and then listed five of six pages, omitting `observability-by-default`. Pass 2 caught it. Now all six. |
| No shipped label reaches the 12-character boundary the cap guards | MINOR | **Rejected, the finding is factually wrong.** `ORCHESTRATOR` is exactly 12 characters and ships in `backend-harness`, which was already in the capture list and is now also the measured string in task A2a. |

## Critique gate — pass 2 dispositions (fable dissect-critic, non-author model, 2026-07-30)

Verdict FIX-THEN-SHIP, HIGH tier affirmed after attacking it downward. Eleven new findings, none overlapping pass 1, six gating. All eleven accepted; two were outright bugs in the design rather than gaps in its verification.

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | `ResizeObserver.contentRect` is the content box, but `logTextWidthPx` subtracted the figure's padding again, understating available text width by ~42px, while the registry cap certified against a border-box number | MAJOR | **Accepted.** The width domain is now declared once, before any code: every width in `src/figures/` is a content-box width. `logTextWidthPx` subtracts only the indent, `FIGURE_PAD_PX` is marked reference-only with an explicit "do not subtract this in a layout function," claim 12 is restated in content-box terms (~238, not 280), and A2a records which box it measured. |
| F2 | The "enumerate every actor" capture fix listed five of six pages, omitting the only figure where `fault` and `muted` render as flow nodes | MAJOR | **Accepted.** `observability-by-default` added, and the pass-1 disposition corrected. The M7 lesson landing on the fix for the M7 lesson is worth remembering. |
| F3 | A2a could measure a fallback font's metrics and look successful, because the font loads with `display=swap` | MAJOR | **Accepted, verified independently** at `index.html:10`. A2a now awaits `document.fonts.ready`, hard-fails on `document.fonts.check`, records the resolved family, and measures at `max-content` rather than searching near the placeholder value. |
| F4 | A2's test literals (`rowFits(4, 450)`) are derived from the placeholder constants A2a exists to replace, guaranteeing a red test and tempting a builder to restore 96 | MAJOR | **Accepted.** Test 1's boundary is now computed from the constants. A2a's file-ordering wrinkle is fixed too: it writes the fixture only, and A2 creates `layout.ts` consuming it. |
| F5 | The viewport sweeps pass viewport widths into functions that consume container widths, and `STACK_BELOW_PX = 420` claimed a uniformity it did not deliver in a real band | MAJOR | **Accepted, and it changed the design.** `contentWidthForViewport` maps the sweep into the right domain and is pinned to the A2a measurement at 320. `STACK_BELOW_PX` is deleted in favour of `uniformRowThresholdPx`, a single threshold derived across the whole registry, which makes uniformity true by construction rather than by comment. 510 is added to the sweep because it sits in the band the old rule broke. |
| F6 | The HIGH-tier dry-run substitution gives the stacked form zero visual judgment, while the repo already owns a CDP rig that can capture it | MAJOR | **Accepted, and this is the finding that made the substitution honest.** A6.5 said "mobile is not capturable," which is true only of `--window-size`. Emulated-mobile CDP captures at 390 and 320 are now required and judged by the same subagent, with the geometry check kept as a separate item because it answers a different question. |
| F7 | A5's spacing wrapper is unconditional, so the two experience pages render an empty spacer and the claimed graceful degradation is not literally true | MINOR | **Accepted.** Wrapper moved inside the conditional, with the exact JSX given and the experience pages named as the degradation case. |
| F8 | Registry test 4's rationale repeats the forgotten-padding error one level down: 12 chars of text needs a ~99px node, not 96 | MINOR | **Accepted.** The label cap is now derived by `maxLabelWordChars()` from `NODE_MIN_PX`, `NODE_PAD_PX` and `MONO_CH_PX`. |
| F9 | "Two of the six figures describe UWM systems" undercounts; it is three, and the gate text steered the reviewer away from the third | MINOR | **Accepted.** The gate now names all three slugs and every log channel string. |
| F10 | If droppable PR-C drops, `design-system.md` permanently describes a head the site never ships, and no PR owns the head compaction | MINOR | **Accepted.** See the design-system amendment and PR-C's drop path below. |
| F11 | S3b silently inherits an S3-created obligation: registry test 2 means the meta entry cannot ship without a figure whose caption is a verbatim substring of interview-drafted prose | MINOR | **Accepted.** Recorded under Scope so the S3b planner meets it in the plan rather than in a red test. |

---

# PR-B — Curio screenshots (owner in the loop)

Not builder-executable until the captures exist. Definition of done, so a later session can plan it cheaply:

- Owner captures Curio's desktop app and phone companion showing **demo or sample data only**, never his real library. Memory records a working method for this: force WPF software rendering, because hardware `PrintWindow` returns blank white.
- Each shot passes the confidentiality checklist individually. Library names, file paths, personal media titles and window titles are all leak surfaces.
- Shots land under `public/shots/curio/`, are referenced by a third figure kind (`shots`) added to `src/figures/types.ts` with the same caption-provenance and punctuation gates, and sit **alongside** Curio's flow figure rather than replacing it.
- Owner approves each shot visually before commit.

# PR-C — the six leaded-glass sigils

Not builder-executable until the design loop runs. Definition of done:

- Six emblems in the station's glass vocabulary (`2026-07-27-station-glass-design.md`), one per project, produced through the SVG render-and-critique loop.
- **Deviation from canon extraction, stated so it is attacked rather than assumed:** these ship as authored `.tsx` SVG components under `src/figures/sigils/`, not through `tools/extract-canon.mjs`. Canon extraction exists to keep art byte-identical between a standalone lab and the app when both consume it. These emblems have no lab counterpart and no second consumer, and they need theme tokens rather than a canvas painter. If the critic disagrees, the fallback is a `docs/design-labs/case-study-sigils.html` lab plus hand-port, which is what `station-glass.html` does today.
- The identity-mark slot is added to the case-study head in the same PR that first uses it.
- Owner approves each emblem; each passes the confidentiality checklist.
- **This PR is droppable, with one obligation on the drop path.** If the design loop stalls, S3 still ships PR-A and PR-B and the head keeps its current shape. **Dropping PR-C then requires amending `docs/design-system.md`**, whose layout-D description names an identity mark the site would never ship. A design doc that describes a head reality does not have is exactly the divergence the ROADMAP's own decision log records the cost of, when a summary block declared S3 frozen and stood as the board's headline for a day.
- **Nobody owns a "head compaction" beyond this, and that is deliberate.** Direction D's compact head is satisfied by the existing meta-line-above-title stack with the banner removed. The only thing PR-C adds is the mark beside it. There is no third restructuring pending.
