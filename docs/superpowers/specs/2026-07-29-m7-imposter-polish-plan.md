# M7 — Imposter polish: clone/COMMAND clip + phase-aware TARGET footer

> **Written for builder-subagent execution.** Every file path, signature, literal and
> command below was read at HEAD `cf3e3d23d9c159f93b2ca3d6b6898bbff3d1c846` on
> 2026-07-29. **If something doesn't match what you find, STOP and report rather
> than guess.** Do not "fix" a mismatch by adapting the plan silently — a mismatch
> means the plan is stale and the orchestrator must reconcile it.

**Milestone:** M7. **Two PRs**, independent, either order (PR-A is smaller and has no
owner gate — do it first). **Repo:** `C:\Agent Projects\portfolio-rpg`.

## Blast radius: MEDIUM overall, but the two PRs differ — gates are declared PER PR

Neither PR changes a persisted or serialized format (`yrpg.progress` is untouched,
`ScenePlate` is never serialized), touches a delete/replace path, a migration, a
cross-process contract, or a secret. So no schema-evolution guard test is required, and
no synthetic-corpus dry run is required (that is a HIGH gate). Beyond that the two PRs
are not the same risk, and dissect pass 1 was right that one blended paragraph hid it:

**PR-A (footer copy) — LOW-shaped.** Purely additive: a new optional interface member, one
new implementation, one call site gaining a `?? ` fallback. It reuses a mechanism already
live in production since M6 PR-2 (`plate.labelFor?.(state) ?? plate.label`,
`BattleScene.tsx:849`). Gates: claim ledger + preflight, one dissect pass (this one),
cursory diff review, full suite + `tsc -b` + coverage table, and the task A4 `--stat`
check that proves the other three scenes are untouched.

**PR-B (clip fix) — MEDIUM, and this is where the tier is earned.** It refactors
`scale`/`stageW`/`stageH`/`stageLeft`/`stageTop`/`cellPx` out of `BattleScene.tsx`. That
is the **sole positioning math for every sprite, damage float, and target cursor of all
four bosses**, and it currently has **zero test coverage** (`.tsx` is not matched by the
`src/battle/**/*.ts` coverage globs, ledger #10). A pure transcription slip in the port —
independent of the clip fix itself — could silently misplace on-screen elements across the
whole game at every viewport. Gates, all mandatory:

1. **Fixed-lens diff review on EVERY commit in PR-B**, not just risky ones. The
   load-bearing lenses here are *cross-file invariants* (does every consumer of the moved
   math still get identical numbers?) and *ordering/ordinals* (row/col vs x/y, and the
   `[r0, c0]` top-left convention).
2. **Pixel-identical before/after captures at every sweep viewport for task B3** — the
   refactor must be provably invisible before any behaviour change lands.
3. **The viewport sweep**, not a single frame (see framing correction (b)).
4. **Zero-skipped-tests check at B6**, closing the B2→B5 skip/re-enable loop.

Provenance note on the M6 precedent: the ROADMAP records at `ROADMAP.md:82` that two
defects in the **Imposter fight work** shipped past two dissect passes in M6 PR-3 (a
phase-boundary timing illegality and a `realIndex`-dependent oracle line). Dissect pass 1
correctly flagged that those were reducer/fight-derivation defects, and that
`git log -- src/battle/scenes/imposter.ts` shows a single commit — so do **not** read that
history as "this scene file is defect-prone." It is a reason to distrust *hand-derived
numbers about this boss*, which is exactly why every geometry figure in this plan is
either ledger-verified or explicitly marked illustrative.

---

## Context: what M6 PR-3 left behind

Two owner design calls were deferred out of M6 and ruled into M7 on 2026-07-29:

1. **`1/1 TARGET` during CLONES is wrong copy.** The Imposter's plate footer reads
   `1/1 TARGET` at all times, including the CLONES phase where the player has **three**
   targetable slots. The owner ruled it becomes a targetable-slot count, matching how
   Cascade (`n/6 NODES`) and Alert Storm (`n/10 SIGNALS`) use that footer.
2. **The COMMAND panel's corner clips the leftmost clone's foot.** Fix approach is
   owner-ruled *from rendered frames plus measurements*, not guessed. Candidates on the
   table: shrink the spread, shift the stamp origin, or move the panel.

### Two framing corrections that change the shape of this milestone

**(a) The footer fix is NOT a four-scene contract widening.** The carried scope note
said phase-awareness "widens the shared `Scene` type everywhere ... across all four
scenes and their tests." It does not have to. `ScenePlate`/`BossSceneModule`
(`src/battle/scenes/types.ts`) already carries **three** documented optional per-boss
override seams — `arenaFor?` (`types.ts:63-71`), `stampOrigin?` (`types.ts:72-82`),
`labelFor?` (`types.ts:47-55`) — each with the identical contract comment: *"Shipped
modules don't implement this, so their output stays byte-identical."* Adding
`footerFor?(state: BattleState): string` follows that established idiom exactly. Result:
`alertStorm.ts`, `cascade.ts`, `silentFailure.ts` and **all four existing footer tests
stay byte-identical**. The change is three files, not eight.

The accepted cost is that `imposterScene.plate.footer` becomes dead once `footerFor`
exists. That cost is already precedented **twice inside this very object literal**:
`arena` (`scenes/imposter.ts:226-229`, "Never actually read at runtime ... structural
only") and `hiddenLabel` (`scenes/imposter.ts:235-239`, "Never shown by today's shell
... structural only"). Keep `footer` and document it the same way.

**Rejected alternative: widening `footer(livingCount: number, total: number)`.** The
rationale below was corrected after dissect pass 1 refuted two of its three original legs
— read the corrected version, and do not resurrect the refuted claims:

- **(i) The decisive reason.** The denominator is scene knowledge (`/10 SIGNALS`,
  `/6 NODES`, `/1 TARGET`). Passing `total` in from `BattleScene.tsx` moves per-boss
  constants into the shared shell, which is backwards — the whole point of
  `BossSceneModule` (`types.ts:1-8`) is that "everything boss-flavored" lives in the scene
  module. This leg stands on its own and is the reason for the decision, together with the
  three-fold precedent above.
- **(ii) A secondary, weaker reason: swap risk at an untested call site.** Two positional
  numbers admit `footer(total, living)`, which compiles. Pass 1 correctly refuted the
  original wording ("`living === total` in every Imposter state") — the `0/3` case has
  `living=0, total=3`, so a swap would render `3/0` and *would* be distinguishable. The
  surviving concern is narrower: the sole production call site is
  `BattleScene.tsx:859`, and `BattleScene.tsx` has **zero** test coverage, so no test
  drives the swap. Treat this as a mild argument, not a proof.
- **(iii) Corrected cost, measured this session.** The original claim that the three
  ignoring scenes "cannot simply declare it" was misleading. Empirically probed with
  `npx tsc --strict --noUnusedParameters --noEmit`: an implementation with **fewer**
  declared parameters satisfies a member declaring more (parameter covariance), so
  `alertStorm.ts`/`cascade.ts`/`silentFailure.ts` would need **no edits**. But the *call*
  side does: `alertStorm.footer(7)` against a two-parameter member fails with
  `TS2554: Expected 2 arguments, but got 1`. Since `tsconfig.app.json` type-checks all of
  `src` (ledger #11), that is a hard build failure, and there are **six** such call sites
  (ledger #8). So the real cost of widening is six mandatory test edits and zero scene
  edits — smaller than originally stated, still strictly worse than zero, and still
  bought nothing that leg (i) does not already rule out.

**Considered and deferred: consolidating the four optional seams.** `arenaFor?`,
`stampOrigin?`, `labelFor?` and now `footerFor?` all carry near-identical boilerplate, and
a generalized per-boss override mechanism is the obvious refactor a reviewer would raise.
Deferred on YAGNI grounds: four seams with distinct signatures and distinct call-site
fallbacks is still cheaper to read than an abstraction over them. **Treat a fifth seam as
the trigger to generalize** — record that here so the next milestone does not re-litigate
it from scratch.

**(b) The clip is a cross-coordinate-space, viewport-dependent collision — one rendered
frame cannot validate a fix.** The clones are canvas pixels in a 256×144 logical stage
grid blitted at a viewport-derived `scale`; the COMMAND panel is a **DOM `<div>`** in CSS
pixels (`BattleScene.tsx:880`). The overlap is therefore a function of `vw`, `vh`,
`isMobile`, the `scale` step function, and the panel's rendered height. Worked example
from the verbatim formulas at `BattleScene.tsx:194-201`:

| viewport | `scale` | `stageW` | `stageLeft` | `stageTop` | leftmost clone x (px) | canvas bottom y (px) |
|---|---|---|---|---|---|---|
| 1440×900 | 4.5 | 1152 | `(1440-1152)/2` = 144 | 63 | `144 + 14*4.5` = **207** | `63 + 125*4.5` = **625.5** |
| 1440×720 | 3.5 | 896 | `(1440-896)/2` = 272 | 57.6 | `272 + 14*3.5` = **321** | `57.6 + 125*3.5` = **495.1** |

Desktop panel right edge is `38 + 262` = **300**. At 1440×900 the leftmost clone sits
**inside** the panel's column band (207 < 300); at 1440×720 — *same width, only the height
changed* — it sits **clear of it** (321 > 300), because a shorter viewport drops `scale`
from 4.5 to 3.5, shrinks the centred stage, and pushes its left edge right by 128px.
**The horizontal collision condition inverts on a viewport-height change alone.** That is
the whole argument for a sweep: a fix validated on one frame is unvalidated.

Caveats, stated so nobody over-reads this table: (1) row 125 is the clone **canvas**
bottom (origin row 66 + `ROWS` 60 - 1), not the painted foot — the painted bound is ≤ that
and is measured in B1/derived by `paintedBounds` in B2. (2) The **vertical** condition
needs the panel's rendered height, which no pure function can know, so no vertical claim
is made here. (3) These numbers are hand-derived from the formulas and are *illustrative*.
Task B1 measures the real ones; **no task in this plan consumes a literal from this
table** — B2's test 4 derives everything through `imposterScene.stampOrigin!` and
`composeBoss`, precisely so that a stale figure here cannot mislead a builder.

So this milestone extracts the layout math into a pure, covered module and asserts
non-intersection across a **viewport sweep**, with rendered frames as the owner's
decision input and as confirmation — not as the only evidence. This directly answers the
M6 PR-2 lesson (a green suite cannot see layout, because JSDOM has no layout engine):
`BattleScene.tsx` is `.tsx` and so is **not** matched by `vitest.config.ts`'s
`src/battle/**/*.ts` coverage globs, which is exactly why this math is untested today.
A new `src/battle/layout.ts` **is** matched, and inherits the 95%-branches threshold.

---

## Claim ledger

Every recheck is a pwsh one-liner run from the repo root; exit 0 = claim holds.

**ORCHESTRATOR AMENDMENT (build session 2026-07-29): five rows were re-pointed after PR-A
and tasks B1-B3 landed.** A ledger exists so a later session can prove the plan is still
current, but this plan's own tasks deliberately invalidate part of it — B3's entire purpose
is to *move* the formulas rows 18/19 pin, B1 adds the 4th `tools/*.mjs`, B2 creates the
first `paintedBounds`, and the suite grows past the row-1 baseline. Left alone, the
preflight for tasks B5-B7 would report five FAILs, and a FAIL is a hard stop that would
send the next session off to re-plan a plan that is fine. So rows **1, 18, 19, 26 and 28**
now carry post-B3 rechecks, with the original cf3e3d2 claim preserved in the Claim text
rather than deleted. The "Verified at" cell names which stage the recheck targets. Rows
2-17 and 20-25 are untouched and still assert their original cf3e3d2 facts.

| # | Claim | Verified at (commit) | Recheck (pwsh, exit 0 = holds) |
|---|-------|----------------------|--------------------------------|
| 1 | Original baseline: 526 tests / 18 files green (measured in-session 2026-07-29, not copied). **Post-PR-A + B1-B3 the suite is 555 passed / 12 skipped (567) across 19 files**, measured independently by the orchestrator on branch `fix/m7-pr-b-clone-clip` at `2f607f1`. The 12 skips are the `it.skip.each` invariant rows, one per swept viewport, which **task B5 re-enables — after B5 the expected state is 567 passed / 0 skipped**, so re-point this row again then | 2f607f1 | `if (-not ((npm test 2>&1) -match 'Tests\s+555 passed \| 12 skipped')) { exit 1 }` |
| 2 | `ScenePlate.footer` signature is `footer(livingCount: number): string;` | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/types.ts -Pattern 'footer\(livingCount: number\): string;' -Quiet)) { exit 1 }` |
| 3 | `types.ts` already imports `BattleState` (no new import needed) | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/types.ts -Pattern 'import type \{ BattleState, BossState \} from "../engine";' -Quiet)) { exit 1 }` |
| 4 | The optional-seam precedent `labelFor?(state: BattleState): string;` exists in `ScenePlate` | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/types.ts -Pattern 'labelFor\?\(state: BattleState\): string;' -Quiet)) { exit 1 }` |
| 5 | Imposter footer literal is `` footer: (livingCount) => `${livingCount}/1 TARGET` `` | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/imposter.ts -Pattern 'livingCount\}/1 TARGET' -Quiet)) { exit 1 }` |
| 6 | `livingTargets(boss)` returns `[0,1,2]` in clones, `[0]` otherwise, `[]` if dead | cf3e3d2 | `if (-not (Select-String -Path src/battle/bosses/imposter.ts -Pattern 'boss.phase === "clones" \? \[0, 1, 2\] : \[0\]' -Quiet)) { exit 1 }` |
| 7 | `ImposterPhase` = `"clones" \| "pulse" \| "vanish" \| "mirror"` | cf3e3d2 | `if (-not (Select-String -Path src/battle/bosses/imposter.ts -Pattern 'export type ImposterPhase = "clones" . "pulse" . "vanish" . "mirror";' -Quiet)) { exit 1 }` |
| 8 | Exactly ONE production footer call site (`BattleScene.tsx:859`) and exactly SIX test call sites, spread over 4 `it(...)` blocks — Alert Storm 1, Cascade 1, Silent Failure 2, Imposter 2. **Measured 2026-07-29; only the two Imposter ones may change in PR-A** | cf3e3d2 | `$p = (Select-String -Path src/battle/BattleScene.tsx -Pattern 'plate\.footer\(').Count; $f = (Get-ChildItem src/battle -Recurse -Include *.test.ts).FullName; $t = (Select-String -Path $f -Pattern 'plate\.footer\(').Count; if ($p -ne 1 -or $t -ne 6) { exit 1 }` |
| 9 | `livingCount = state.boss.hp > 0 ? 1 : 0` appears exactly twice (Silent Failure + Imposter branches) | cf3e3d2 | `if ((Select-String -Path src/battle/BattleScene.tsx -Pattern 'livingCount = state.boss.hp > 0 \? 1 : 0;').Count -ne 2) { exit 1 }` |
| 10 | Coverage globs are `*.ts` only, thresholds 95 branches — `.tsx` is uncovered, a new `src/battle/layout.ts` is covered | cf3e3d2 | `if (-not (Select-String -Path vitest.config.ts -Pattern '"src/battle/\*\*/\*.ts": \{ branches: 95 \}' -Quiet)) { exit 1 }` |
| 11 | `tsconfig.app.json` includes all of `src` and sets `noUnusedParameters: true` (tests ARE type-checked by `tsc -b`) | cf3e3d2 | `$t = Get-Content tsconfig.app.json -Raw; if (-not ($t -match '"noUnusedParameters": true' -and $t -match '"include": \["src"\]')) { exit 1 }` |
| 12 | `CLONE_GAP = 20` | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/imposter.ts -Pattern 'const CLONE_GAP = 20;' -Quiet)) { exit 1 }` |
| 13 | `cloneLocalCol(slot) = slot * CLONE_GAP` | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/imposter.ts -Pattern 'return slot \* CLONE_GAP;' -Quiet)) { exit 1 }` |
| 14 | Clones stamp origin is `[BOSS_AT[0], BOSS_AT[1] - CLONE_GAP]` | cf3e3d2 | `if (-not (Select-String -Path src/battle/scenes/imposter.ts -Pattern 'BOSS_AT\[1\] - CLONE_GAP\] : BOSS_AT' -Quiet)) { exit 1 }` |
| 15 | Clone canvas is `COLS + 2*CLONE_GAP` wide × `ROWS` tall (88 × 60); `COLS=48, ROWS=60` | cf3e3d2 | `$a = Select-String -Path src/battle/scenes/imposter.ts -Pattern 'const width = COLS \+ 2 \* CLONE_GAP;' -Quiet; $b = Select-String -Path src/generated/heroBattle.js -Pattern 'ROWS = 60, COLS = 48' -Quiet; if (-not ($a -and $b)) { exit 1 }` |
| 16 | `BOSS_AT = [66, 34]`, stage grid `SR = 144, SC = 256` | cf3e3d2 | `$g = Get-Content src/generated/battlefieldScene.js -Raw; if (-not ($g -match 'BOSS_AT = \[66, ?34\]' -and $g -match 'SR = 144' -and $g -match 'SC = 256')) { exit 1 }` |
| 17 | `stampGrid(g, art, r0, c0)` treats `[r0,c0]` as TOP-LEFT (`const rr = r0 + r;`) | cf3e3d2 | `if (-not (Select-String -Path src/battle/BattleScene.tsx -Pattern 'const rr = r0 \+ r;' -Quiet)) { exit 1 }` |
| 18 | Stage metrics formula: `scale = isMobile ? vw/SC : Math.max(2, Math.floor(fit*2)/2)`. **Post-B3 the formula lives in `src/battle/layout.ts`** (verbatim-ported out of `BattleScene.tsx` by task B3, which is the whole point of PR-B); recheck re-pointed there | cf3e3d2 claim, B3 location | `if (-not (Select-String -Path src/battle/layout.ts -Pattern 'Math.max\(2, Math.floor\(fit \* 2\) / 2\)' -Quiet)) { exit 1 }` |
| 19 | `cellPx(r,c) = { left: stageLeft + c*scale, top: stageTop + r*scale }`. **Post-B3 this is `cellRect` in `src/battle/layout.ts`**, same arithmetic against a `StageMetrics` argument; recheck re-pointed there | cf3e3d2 claim, B3 location | `if (-not (Select-String -Path src/battle/layout.ts -Pattern 'left: m.stageLeft \+ c \* m.scale,' -Quiet)) { exit 1 }` |
| 20 | COMMAND panel geometry: `left: isMobile ? 10 : 38, bottom: isMobile ? 10 : 38, width: isMobile ? "auto" : 262` | cf3e3d2 | `if (-not (Select-String -Path src/battle/BattleScene.tsx -Pattern 'left: isMobile \? 10 : 38, bottom: isMobile \? 10 : 38, width: isMobile \? "auto" : 262' -Quiet)) { exit 1 }` |
| 21 | Panel renders only when `mode === "menu" \|\| mode === "target"` | cf3e3d2 | `if (-not (Select-String -Path src/battle/BattleScene.tsx -Pattern 'mode === "menu" .. mode === "target"' -Quiet)) { exit 1 }` |
| 22 | `vw`/`vh`/`isMobile` are `BattleScene` **props**; `w`/`h` come from a real `resize` listener in `App.tsx`; `MOBILE_BREAKPOINT = 760` | cf3e3d2 | `$a = Select-String -Path src/App.tsx -Pattern 'window.addEventListener\("resize", onResize\)' -Quiet; $b = Select-String -Path src/App.tsx -Pattern 'const MOBILE_BREAKPOINT = 760;' -Quiet; if (-not ($a -and $b)) { exit 1 }` |
| 23 | Dev boot params are gated on `import.meta.env.DEV \|\| loc.hostname === "localhost"` | cf3e3d2 | `if (-not (Select-String -Path src/App.tsx -Pattern 'import.meta.env.DEV .. loc.hostname === "localhost"' -Quiet)) { exit 1 }` |
| 24 | `spawnImposter` seeds `phase: "clones"` — `?phase=battle&boss=imposter-syndrome` boots INSIDE the CLONES window with no `actions=` | cf3e3d2 | `if (-not (Select-String -Path src/battle/bosses/imposter.ts -Pattern 'phase: "clones",' -Quiet)) { exit 1 }` |
| 25 | `vite.config.ts` sets no `base`, so the dev server serves the app at `/` | cf3e3d2 | `if (Select-String -Path vite.config.ts -Pattern '^\s*base:' -Quiet) { exit 1 }` |
| 26 | Originally: no browser-driving tool existed and `tools/` held exactly 3 `.mjs` audit scripts. **Task B1 adds the 4th** (`measure-battle-layout.mjs`), so the count is 4 post-B1 and the original claim is spent by design | cf3e3d2 claim, B1 count | `if ((Get-ChildItem tools -Filter *.mjs).Count -ne 4) { exit 1 }` |
| 27 | `Grid = (string \| null)[][]`; empty cell sentinel is `null` | cf3e3d2 | `if (-not (Select-String -Path src/generated/heroBattle.d.ts -Pattern 'export type Grid = \(string . null\)\[\]\[\];' -Quiet)) { exit 1 }` |
| 28 | Originally: no painted-bounds / foot-row helper existed. **Task B2 adds the first**, exported from `src/battle/layout.ts`, so post-B2 the claim inverts by design and the recheck asserts its presence instead | cf3e3d2 claim, B2 presence | `if (-not (Select-String -Path src/battle/layout.ts -Pattern 'export function paintedBounds' -Quiet)) { exit 1 }` |
| 29 | **Fixture seam (footer tests):** `fresh(overrides: Partial<ImposterBoss>)` at `scenes/imposter.test.ts:17-19` builds a phase-overridden boss; `initBattle({ seed, boss: IMPOSTER_ID })` builds a full `BattleState`. Both already used together in the `banner` describe block | cf3e3d2 | `$t = Get-Content src/battle/scenes/imposter.test.ts -Raw; if (-not ($t -match 'function fresh\(overrides: Partial<ImposterBoss> = \{\}\)' -and $t -match 'initBattle\(\{ seed: 1, boss: IMPOSTER_ID \}\)')) { exit 1 }` |
| 30 | **Fixture seam (layout tests):** the measured panel-height fixture does NOT exist yet — task B1 creates it. Any B2 test needing it must consume B1's committed JSON, never a hardcoded guess. Unautomatable by design (asserts the absence of a file the milestone creates); enforced by task ordering and left to the critic | cf3e3d2 | — |

---

## PR-A — phase-aware TARGET footer

Branch: `fix/m7-pr-a-target-footer`. Four tasks, one commit each.

### A1 (RED) — tests for `plate.footerFor`

Append a `describe("plate.footerFor - phase-aware targetable-slot count")` block to
`src/battle/scenes/imposter.test.ts`. Build states with the existing seam (ledger #29):

```ts
const base = initBattle({ seed: 1, boss: IMPOSTER_ID });
const withBoss = (o: Partial<ImposterBoss>) => ({ ...base, boss: fresh(o) });
```

Assert:

| state | expected footer |
|---|---|
| `withBoss({ phase: "clones" })` | `"3/3 TARGET"` |
| `withBoss({ phase: "pulse" })` | `"1/1 TARGET"` |
| `withBoss({ phase: "vanish" })` | `"1/1 TARGET"` |
| `withBoss({ phase: "mirror" })` | `"1/1 TARGET"` |
| `withBoss({ phase: "mirror", hp: 0 })` | `"0/1 TARGET"` |
| `withBoss({ phase: "clones", hp: 0 })` | `"0/3 TARGET"` |

Also assert the seam is actually wired: `expect(typeof imposterScene.plate.footerFor).toBe("function")`.

**Semantics, stated so you don't invent them:** numerator = `livingTargets(boss).length`
(the existing selector, ledger #6). Denominator = the count of slots that *exist* in this
phase (3 during clones, 1 otherwise), independent of alive/dead. Hence `0/3 TARGET` for a
boss that dies during clones — the slots still exist, none is targetable. This string is
**owner-overridable with a one-line ruling** if he prefers `0/1` there; the default is
chosen for internal consistency with the numerator/denominator meaning.

**`0/3 TARGET` is NOT a defensive corner — it is the normal display after a fast kill, and
it is player-visible.** Dissect pass 1 traced this and the plan was wrong to hedge it:
`resolveImposterHit`/`damageImposter` (`bosses/imposter.ts:163-198`) never advance the
phase on a hit — the phase only advances on the boss's own turn (`tickPhase`/
`advancePhase`) — and CLONES is the **opening** phase (`spawnImposter`, ledger #24). So any
killing blow landed during CLONES leaves `hp <= 0` with `phase === "clones"`, and the plate
keeps rendering through the death-animation window (`composeBoss` checks
`isImposterDefeated` before phase and plays `IMP_DIE`, `scenes/imposter.ts:172-186`). The
player will see this string.

Two consequences: (1) do **not** label this case "defensive" in a test comment — write it
as the ordinary fast-kill outcome; (2) the `0/3` vs `0/1` choice is a **real player-facing
copy decision**, not an internal-consistency footnote. The default stays `0/3` (denominator
= slots that exist, matching Cascade's and Alert Storm's fixed denominators at
`cascade.ts:52`, `alertStorm.ts:88`), and it is owner-overridable with a one-line ruling.
Surface it in the PR-A ping so he sees it rather than discovering it in play.

Run `npm test`. Expected: **new tests fail** (`footerFor` is `undefined`, so
`typeof` is `"undefined"` and the calls throw). Commit the red step? **No** — this repo
commits per task with a green suite. Instead, do A1 and A2 in one commit but write A1's
tests first and observe them fail before writing A2. Record the observed failure output in
the commit body.

### A2 (GREEN) — add the seam and implement it

**`src/battle/scenes/types.ts`** — add to `ScenePlate`, immediately after the
`labelFor?` member (keep the file's comment style; this is the fourth optional seam):

```ts
  /** M7 task A2 — OPTIONAL, additive (the D3/E4/E9 pattern). `BattleScene`
   * renders `plate.footerFor?.(state) ?? plate.footer(livingCount)`. The
   * static `footer(livingCount)` signature can't express a phase-dependent
   * DENOMINATOR (the Imposter has 3 targetable clone slots during CLONES and
   * 1 in every other phase), and the denominator is scene knowledge that must
   * not leak into the shared shell. Alert Storm, Cascade and Silent Failure do
   * not implement this, so their rendered output and all four existing
   * `plate.footer(n)` tests stay byte-identical. */
  footerFor?(state: BattleState): string;
```

**`src/battle/scenes/imposter.ts`** — extend the existing import block at lines 10-15
with `livingTargets`:

```ts
import {
  erosionStage as bossErosionStage,
  IMPOSTER_ID,
  isImposterDefeated,
  livingTargets,
  type ImposterBoss,
} from "../bosses/imposter";
```

Add a module-level helper above `imposterScene` (keep it tiny — it is one branch, and
it must be covered):

```ts
/** Slots that EXIST in this phase, alive or not: the clone spread shows three
 * targetable positions during CLONES, one entity in every other phase. The
 * plate footer's denominator. */
function targetSlots(boss: ImposterBoss): number {
  return boss.phase === "clones" ? 3 : 1;
}
```

Then in the `plate` object literal, keep `footer` exactly as it is and document it,
and add `footerFor`:

```ts
    // Never read at runtime once `footerFor` below is defined — structural
    // only, the same accepted pattern as `arena` and `hiddenLabel` above.
    footer: (livingCount) => `${livingCount}/1 TARGET`,
    footerFor: (state) =>
      state.boss.kind === IMPOSTER_ID
        ? `${livingTargets(state.boss).length}/${targetSlots(state.boss)} TARGET`
        : `0/1 TARGET`,
```

The `kind` check is the codebase's standard inline discriminated-union narrowing (there
is no `isImposter` guard helper — see `engine.ts:72`, `bosses/imposter.ts:37`). The
non-Imposter arm is unreachable in practice (`sceneFor` only hands this module its own
boss) — if it costs you the 95% branch threshold, cover it with a direct call passing an
Alert Storm state, exactly as `imposter.test.ts:47,80,189` already do. **Do not add a
`/* v8 ignore */` annotation** — see the M6 lesson in ROADMAP about an ignore comment
swallowing a real branch.

Run `npm test` and `npx tsc -b`. Both must pass. (Bare `npx tsc --noEmit` is a NO-OP in
this repo — solution-style root tsconfig. Use `tsc -b` or `npm run build`.)

### A3 — wire the call site

**`src/battle/BattleScene.tsx:859`**, change:

```tsx
          {scene.plate.footer(livingCount)}
```

to:

```tsx
          {scene.plate.footerFor?.(state) ?? scene.plate.footer(livingCount)}
```

This mirrors line 849's `{scene.plate.labelFor?.(state) ?? scene.plate.label}` exactly.
Leave `livingCount` and the whole `BattleScene.tsx:702-717` Imposter branch **untouched**
— `livingCount` still feeds nothing else for this boss but the fallback, and touching it
would widen the diff for no gain.

### A4 — prove the blast radius

Run, and paste the output into the commit body:

```bash
npm test && npx tsc -b && git diff --stat main...HEAD
```

The `--stat` must show **exactly three** source files changed (`types.ts`,
`scenes/imposter.ts`, `BattleScene.tsx`) plus `scenes/imposter.test.ts`. If
`alertStorm.ts`, `cascade.ts`, `silentFailure.ts`, or any of their `.test.ts` files
appear, you have taken the rejected widening approach — STOP and report.

Also confirm coverage still clears 95% branches for `src/battle/**` (it prints in the
`npm test` table) and that `npm run verify:canon` still passes (no generated module was
touched, so it must).

Then push, open the PR, watch checks in the foreground, merge `--merge --delete-branch`,
sync main.

---

## PR-B — clone/COMMAND clip

Branch: `fix/m7-pr-b-clone-clip`. **Contains an explicit owner decision gate at B4.**
Tasks B1-B3 are gate-independent; do them all before pinging.

### B1 — build the measurement + capture rig

New file `tools/measure-battle-layout.mjs`, plus an npm script
`"measure:layout": "node tools/measure-battle-layout.mjs"`.

**Technology: CDP over headless Edge.** Not the Browser pane, and not
`msedge --screenshot`. Reasons, all recorded in ROADMAP gotchas:

- The pane's `resize_window` does **not** fire a page `resize` event, and `w`/`h` in
  `App.tsx:227-228` only update from the `resize` listener at `App.tsx:517-521`. Without
  a real event the app keeps rendering desktop chrome at a 390px viewport and you measure
  the wrong layout. CDP's `Emulation.setDeviceMetricsOverride` fires a real resize, so
  the gotcha disappears rather than being worked around.
- `--headless=new` exits 0 while writing **no PNG** on this machine. CDP
  `Page.captureScreenshot` sidesteps `--screenshot` entirely.
- The pane also fails with "not compositing frames" in some sessions (M6 PR-3), and the
  battle is a single `<canvas>`, so pixels are the only visual evidence.

Two CDP traps to respect: give Edge its own `--user-data-dir` (otherwise it silently
delegates to a running instance and your flags are ignored), and note CI pins Node 22
(`.github/workflows/check.yml`), which has stable `WebSocket` — the
`--experimental-websocket` flag needed under Node 20 is not required here. Verify your
local `node -v` before assuming.

The rig must:

1. Start the dev server (`npm run dev`) and read the actual port from its stdout — do not
   hardcode 5173. The app is served at `/` (no `base` in `vite.config.ts`, ledger #25).
   The boot params are dev-gated on `import.meta.env.DEV || hostname === "localhost"`
   (ledger #23), so `localhost` is mandatory.
2. Navigate to
   `http://localhost:<port>/?phase=battle&boss=imposter-syndrome&defeated=alert-storm,cascade,silent-failure`.
   `spawnImposter` opens the fight already **in** the CLONES phase (ledger #24), so no
   `actions=` is needed. The `defeated=` prefix gives the realistic post-rush hero
   stats — it must be the exact rush-order prefix or `parseDefeatedBosses` rejects it.
3. For each viewport in the sweep below: `Emulation.setDeviceMetricsOverride`, wait for a
   frame, then read and record via `Runtime.evaluate`:
   - `document.querySelector('[data-battle]').getBoundingClientRect()` — **needed to
     verify the assumption that the container's height equals `vh`.** The panel's
     `bottom` is container-relative. If container height ≠ `vh`, report it: the pure
     `commandPanelRect` in B2 must take container height, not `vh`.
   - the COMMAND panel's rect. Select it by its `TURN ` text or by `[data-battle] > div`
     index — add a `data-cmd-panel` attribute to `BattleScene.tsx:880` if selection is
     fragile (a test-only attribute is acceptable; note it in the commit).
   - the `<canvas>` rect, plus the app's own `scale`/`stageLeft`/`stageTop` if you can
     reach them (otherwise recompute from the canvas rect).
   - `window.innerWidth`, `window.innerHeight`, and whether mobile chrome is rendering
     (proves the resize actually took).
4. Capture a PNG per viewport into `docs/battle-prototypes/m7-clip/before/`.
5. Write all measurements to `docs/battle-prototypes/m7-clip/measured.json` and **commit
   it** — B2's tests consume it as their fixture (ledger #30).

**Viewport sweep** (must include both sides of `MOBILE_BREAKPOINT = 760` and several
`scale` steps, because `scale` is a step function):

`1920×1080`, `1600×900`, `1440×900`, `1440×720`, `1280×800`, `1280×620`, `1024×768`,
`800×600`, `759×900` (just below the breakpoint), `430×932`, `390×844`, `360×640`.

Before handing any PNG to a judge subagent, run the capture sanity check:

```bash
pwsh -NoProfile -File ~\.claude\skills\roadmap\helpers\Test-CaptureSane.ps1 <png1> <png2> ...
```

Bare space-separated paths. A FAIL means fix the capture, not judge it. Note the ROADMAP
gotcha that dark-palette frames defeat brightness thresholds — if the checker flags a
legitimately dark frame, use a colour-histogram region diff against a known-empty
baseline rather than loosening the check.

### B2 (RED) — extract the layout math into a pure, covered module

New file `src/battle/layout.ts`. Sits alongside `src/battle/scenes/cascadeCompose.ts`,
which is the local idiom for pure geometry. It is matched by the coverage globs
(ledger #10), so it carries the **95% branches** threshold.

API (implement exactly this surface; the formulas are verbatim from
`BattleScene.tsx:194-201` and `:729-732`):

```ts
export interface Rect { left: number; top: number; width: number; height: number }
export interface StageMetrics { scale: number; stageW: number; stageH: number; stageLeft: number; stageTop: number }

/** Verbatim port of BattleScene.tsx:194-201. Must stay behaviour-identical. */
export function stageMetrics(vw: number, vh: number, isMobile: boolean): StageMetrics;

/** Verbatim port of cellPx (BattleScene.tsx:729-732), as a rect one cell wide. */
export function cellRect(m: StageMetrics, r: number, c: number): Rect;

/** Inclusive bounds of the painted (non-null) cells, or null for a blank grid.
 * `Grid` is (string | null)[][]; empty is null (ledger #27). */
export function paintedBounds(grid: Grid): { top: number; left: number; bottom: number; right: number } | null;

/** Container-relative rect of a grid stamped TOP-LEFT at [originRow, originCol]
 * (stampGrid semantics, ledger #17), covering only its PAINTED extent.
 * null for a blank grid. */
export function gridRect(m: StageMetrics, originRow: number, originCol: number, grid: Grid): Rect | null;

/** The COMMAND panel, from BattleScene.tsx:880. `panelHeight` and
 * `containerHeight` are INPUTS, not derivable: the panel's height depends on
 * rendered content and font metrics, which no pure function can know. They come
 * from tools/measure-battle-layout.mjs output. This is the honest boundary of
 * purity for this module — document it in the file header. */
export function commandPanelRect(vw: number, containerHeight: number, isMobile: boolean, panelHeight: number): Rect;

export function rectsIntersect(a: Rect, b: Rect): boolean;
```

`commandPanelRect` bodies, from `BattleScene.tsx:880`:
desktop → `{ left: 38, top: containerHeight - 38 - panelHeight, width: 262, height: panelHeight }`;
mobile → `{ left: 10, top: containerHeight - 10 - panelHeight, width: vw - 20, height: panelHeight }`
(`left: 10` + `right: 10` + `width: "auto"` resolves to `vw - 20`).

**ORCHESTRATOR AMENDMENT (build session 2026-07-29, at HEAD `acd7166`) — how B2 consumes
B1's measurements.** The plan said B2's tests consume B1's committed `measured.json`
(ledger #30) but did not say *how*, and all three obvious mechanisms are blocked in this
repo. Measured this session:

- `tsconfig.app.json` has no `resolveJsonModule`, so `import m from "….json"` fails `TS2732`.
- `measured.json` lives in `docs/`, outside `tsconfig.app.json`'s `"include": ["src"]`, so
  even with that flag the import escapes the project root.
- `tsconfig.app.json` sets `"types": ["vite/client"]`. An explicit `types` array **excludes**
  `@types/node` (it is installed, `^26.1.0`, but not visible here), so
  `import { readFileSync } from "node:fs"` inside any `src/**/*.test.ts` fails to resolve —
  and no existing test imports a node builtin, so there is no precedent to copy.

**Binding resolution:** the B1 rig writes its measurements TWICE from the same run — the
human-readable `docs/battle-prototypes/m7-clip/measured.json` the plan already requires,
and a generated **TypeScript data module inside `src/battle/`** (e.g.
`src/battle/__fixtures__/measuredLayout.ts`) exporting a typed array of
`{ vw, vh, isMobile, containerHeight, panelHeight, canvasRect }`. B2's tests import the
`.ts` module. Both files come from one rig run so they cannot diverge; add a file-header
comment on the generated module naming the rig as its source and forbidding hand-edits.
No `tsconfig` change, no new devDependency, no node-types import. A data-only module has no
branches, so it cannot affect the 95% gate.

Also verified this session so nobody re-derives it: `vitest.config.ts:7` already includes
`src/battle/**/*.test.ts`, so `src/battle/layout.test.ts` is collected with **no config
edit** (the ROADMAP's "new test directory is invisible" gotcha does not bite here), and
`layout.ts` is matched by the coverage glob at `:12` exactly as ledger #10 claims.

**Tests** in `src/battle/layout.test.ts`:

1. **`stageMetrics` against an INDEPENDENT hand-computed oracle.** Dissect pass 1 flagged
   that comparing the pure function against `getBoundingClientRect()` values is both
   float-flaky and near-tautological (the canvas's CSS `left/top/width/height` are *set
   from* this very formula, so it only checks transcription). So split the check in two.
   **1a — the real oracle.** A table test with these expectations, computed numerically
   from the verbatim formula this session (not from the port, and not from the DOM):

   | vw × vh | mobile? | `scale` | `stageW` | `stageH` | `stageLeft` | `stageTop` |
   |---|---|---|---|---|---|---|
   | 1440×900 | no | 4.5 | 1152 | 648 | 144 | 63 |
   | 1440×720 | no | 3.5 | 896 | 504 | 272 | 57.6 |
   | 1280×360 | no | 2 | 512 | 288 | 384 | 10.8 |
   | 1280×340 | no | 2 | 512 | 288 | 384 | 8 |
   | 759×900 | yes | 2.96484375 | 759 | 426.9375 | 0 | 151.38 |
   | 390×844 | yes | 1.5234375 | 390 | 219.375 | 0 | 199.88 |
   | 360×640 | yes | 1.40625 | 360 | 202.5 | 0 | 140 |

   Use `toBeCloseTo(expected, 6)`, **not** `toBe` — `1440×720`'s `stageTop` evaluates to
   `57.60000000000002` in IEEE doubles, so exact equality is wrong even for pure
   arithmetic. If a value disagrees, the port is wrong: **STOP and report; do not adjust
   the expectation to match the port.**
   These rows also carry the branch coverage: `1280×360` drives the `Math.max(2, …)` scale
   clamp (raw `floor(fit*2)/2` = 1.5), `1280×340` drives the `Math.max(8, …)` `stageTop`
   floor, and `759×900` / `390×844` drive the mobile arms of both ternaries.
   **1b — a DOM cross-check, separate test, explicitly labelled a transcription check.**
   Compare against B1's measured canvas rects with a **±0.5px tolerance** (browser layout
   rounds subpixels; exact equality will flake). Name the test so nobody mistakes it for
   validation of the geometry itself — it proves only that the app and the module agree.
2. **`paintedBounds`** — a blank grid (all `null`) returns `null`; a zero-row grid (`[]`)
   returns `null`; a grid with one painted cell returns that cell's index four times; a
   ragged grid (rows of differing length, which `Grid = (string | null)[][]` allows) is
   handled without an index error.
3. **`rectsIntersect` — drive the full truth table, not just one case.** If the
   implementation is the usual four-term `&&` chain
   (`a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top`),
   v8 branch coverage requires **each of the four operands to evaluate false at least
   once**. Write four separated cases (b entirely right of a, entirely left, entirely
   below, entirely above) plus one true overlap. Then assert the edge-touching convention
   explicitly — `a.right === b.left` is **NOT** intersecting — and say so in the test name
   so nobody flips it later.
3b. **`gridRect`'s null arm** — a blank grid must return `null` (test `gridRect` directly,
   not just `paintedBounds`; pass 1 noted the arm was otherwise unreached), and a
   one-painted-cell grid must return that cell's rect offset by the stamp origin, which
   also pins the `[r0, c0]`-is-top-left convention (ledger #17) as a test rather than a
   comment.
4. **The invariant, and this is the red step:** for every sweep viewport, the leftmost
   clone's painted rect must not intersect the COMMAND panel rect. Derive the clone rect
   through the **real public seams**, never hardcoded numbers, so that a fix in either
   candidate direction is picked up automatically:

```ts
const boss = fresh({ phase: "clones" });                    // from scenes/imposter.test.ts's idiom
const [r0, c0] = imposterScene.stampOrigin!(boss);          // picks up a stamp-origin fix
const grid = imposterScene.composeBoss(boss, false, 0, {}); // picks up a CLONE_GAP fix
const m = stageMetrics(vw, vh, isMobile);
expect(rectsIntersect(gridRect(m, r0, c0, grid)!, commandPanelRect(vw, containerH, isMobile, panelH))).toBe(false);
```

   `composeBoss` during clones returns the 88×60 clone canvas — confirm that against
   `scenes/imposter.ts:118-129` before relying on it, and if `composeBoss` does not route
   to `composeClones` for this state, STOP and report rather than reaching for an
   unexported internal.

   Expected result: this test **fails at one or more viewports** at current HEAD. That
   failure is the defect, now expressed as a red test. Record exactly which viewports
   fail, and on which axis, in the commit body — that table is the owner's decision input.

   Note the whole-spread caveat: `gridRect` over the composed 88-wide canvas covers all
   three overlapping clones, not just the leftmost. That is the right rect for a
   *collision* question. If the owner's ruling later needs per-slot rects, add a
   `slotRect` helper then, not now.

5. **Cover `commandPanelRect`'s mobile and desktop arms** explicitly (test 1a's table
   covers `stageMetrics`'s arms).

**On the 95% branch threshold:** tests 1a, 2, 3, 3b and 5 above are prescribed *to reach
it*, not merely for correctness — pass 1 was right that the original list did not
demonstrate it. Two corrections to how you reason about it: `Math.max(2, …)` is a **function
call, not an instrumented branch**, so testing the clamp is a correctness win but moves the
branch number by zero (test 1a's `1280×360` row is there for correctness, not coverage);
and the threshold is enforced per-glob at `src/battle/**/*.ts` (ledger #10), so a shortfall
fails CI rather than passing quietly. If you still fall short, **add cases** — never lower
the threshold, and never reach for `/* v8 ignore */` (M6 PR-3 lesson: an ignore annotation
above a single-line `if` swallowed a genuinely uncovered ternary and the file falsely read
100%). Run a discrimination probe before believing a green coverage table: skip one test,
confirm the number **drops**.

**Commit discipline:** this task's commit must be green. Land `layout.ts` + all tests
EXCEPT the failing invariant in one commit, then add the invariant test in its own
commit marked `test(layout): capture the M7 clip as a failing invariant` with the failure
output in the body and `it.fails(...)` **not** used — instead skip it with a comment
pointing at task B5, so the suite stays green and the intent stays visible. Re-enable it
in B5.

### B3 — make `BattleScene.tsx` consume `layout.ts`

Replace the inline `scale`/`stageW`/`stageH`/`stageLeft`/`stageTop` `useMemo`
(`BattleScene.tsx:194-201`) and `cellPx` (`:729-732`) with calls into `layout.ts`.
Behaviour must be identical. Prove it: re-run the B1 rig and diff the new PNGs against
`before/` — they must be **pixel-identical** at every viewport, since nothing visual
changed yet. Any difference means the port is wrong.

Keep the `useMemo` wrapper and its dependency array; only the body moves.

### B4 — OWNER DECISION GATE. Stop and ping.

You now have, for every sweep viewport: measured rects, a before PNG, and the exact
viewports+axes where the invariant fails. **Do not choose a fix.** Post a ping and a chat
message containing:

- the failing-viewport table (viewport → overlap on x / y / both → overlap in px),
- the before frames (verified by a **pinned subagent returning a text verdict** — never
  load PNGs into the orchestrator; only an explicit "show me" from the owner does that),
- the three candidates with their measured consequences:
  1. **Shrink the spread** (`CLONE_GAP`, `scenes/imposter.ts:30`). Moves slots 0 and 2
     inward symmetrically about col 34. Also changes the composed canvas width
     (`COLS + 2*CLONE_GAP`) and the stamp origin, so it ripples into
     `tools/audit-imposter-parity.mjs` and every existing clone-geometry test
     (`imposter.test.ts:52,70,121,136,148`). Tightens the three-clone silhouette overlap,
     which is an art change the owner may not want.
  2. **Shift the stamp origin** (`stampOriginFor`, `scenes/imposter.ts:138-141`). Moves
     all three clones right as a group, preserving spread and silhouette. Pushes the
     rightmost clone toward the stage's right edge and off the boss's canonical centre;
     `stampGrid` clips at stage bounds, and the shared-origin contract documented at
     `types.ts:72-82` means `imposterBatAnchor`/`imposterCursorAnchor` follow
     automatically (they already derive from the same function) — verify the target
     cursor still lands on art.
  3. **Move the panel** (`BattleScene.tsx:880`). Raise desktop `bottom` above the clone
     feet, or narrow `width` from 262. Same coordinate space as the collision boundary,
     touches no canon-extracted art and no parity audit, but changes the shell's chrome
     for **all four bosses**, not just the Imposter.
- your recommendation, with the viewport sweep as evidence for why it holds everywhere
  and not just at 1440.

Then **STOP** until the owner rules. State in plain text that you are blocked on him.

### B4 gate — RENDERED EVIDENCE (orchestrator, 2026-07-29). Read this before B5.

The owner correctly refused to rule from prose, so both live options were rendered as
throwaway local edits (never committed, tree reverted, verified clean) and captured at
1440x900, 800x600 and 360x640. Frames were written to a scratchpad, not the repo. What the
renders established, beyond the measured table in the ROADMAP decision log:

- **Option A, shorten the panel.** Achieved a measured **141.5px** rendered height by
  tightening spacing only, with all 7 ability rows and the footer hint still legible: header
  padding `11px 14px` to `2px 14px`, body wrapper `8px` to `1px`, row padding `10px 12px` to
  `0px 10px`, row gap `10` to `6`, row font-size `14px` to `11px` plus `lineHeight: 1.15`,
  footer-desc `7px 12px 3px` to `1px 12px 1px`. **Clears the collision at all three rendered
  viewports with no regression anywhere.** The only cost is smaller panel text. Note this is
  a flat reduction; a viewport-height-aware cap was NOT rendered, and the per-viewport height
  thresholds needed to design one are still unmeasured (only 800x600's `<=151px` is known).
- **Option B, shift the clones to origin column 88.** Clears 800x600. **Changes nothing at
  360x640** — that collision is vertical, and moving art sideways cannot lift it off a
  full-width bottom bar. At 1440x900 it closes the gap to the hero to 13 stage columns
  (clones 96-171, hero 184-207 — no overlap, but visibly cramped where the pre-existing
  defect was mild).
- **Correction, recorded so nobody re-litigates it:** the mockup judge asserted 1440x900 had
  no baseline collision. That is wrong. Its own `current-1440x900.png` is byte-identical
  (SHA-256) to the committed `before/1440x900.png`, and the overlap there is 57 x 116.5 px —
  hand-derived by the orchestrator, reproduced by the measurement run through the real seams,
  and described by the first visual judge as the panel cutting across the clone's leg. Three
  independent sources against one bad visual read.

**LATENT BUG in the committed rig, must be fixed in B6.** `killTree()` in
`tools/measure-battle-layout.mjs` does not reap Edge's child processes on this machine:
`taskkill /pid X /T /F` kills only the top-level launcher, leaving a full orphan subtree
(crashpad-handler, gpu-process, several utility/renderer processes) after **every** run. This
is in the committed file, not just the throwaway mockup copy. Fix by enumerating the tree via
`Win32_Process` parent-PID walk (or matching the rig's own unique `--user-data-dir` path) and
killing each PID explicitly. Never kill by image name — the owner routinely has dozens of
unrelated `msedge.exe` processes running, and killing by name is destructive.

### B5 — apply the ruled fix

Re-enable the skipped invariant test from B2, apply the owner's ruling, and get it green
at **every** viewport in the sweep. If the ruled option cannot clear every viewport,
report that with numbers rather than clearing most of them — a fix that holds at 1440 and
breaks at 1280 is the defect this milestone exists to stop shipping.

Reconcile whatever existing clone-geometry tests the ruling breaks. **If a broken test is
a GUARD, re-point its input to a still-invalid value rather than flipping its
expectation** (M6 PR-3 lesson: flipping keeps the suite green while deleting the
invariant). Re-measure any break count at current HEAD immediately before the task that
flips it — a count measured earlier in the same PR goes stale.

### B6 — after frames + regression evidence

Re-run the rig into `docs/battle-prototypes/m7-clip/after/`. Sanity-check the captures,
then have a pinned subagent judge before-vs-after and return a text verdict. Confirm
`npm run verify:canon` still passes (mandatory if the ruling touched anything that feeds
`src/generated/`), plus `npm test`, `npx tsc -b`, and the coverage table.

**Mandatory close-out check on the B2→B5 skip loop.** B2 lands the invariant test skipped;
B5 re-enables it. Nothing so far *proves* the re-enable happened, and a forgotten
re-enable leaves the suite green forever with the invariant permanently dormant — the
exact failure this milestone exists to prevent. So assert both, and paste the output into
the commit body:

```bash
npm test 2>&1 | Select-String -Pattern "skipped|Tests "
```

The summary line must report **0 skipped**, and the total must be
`526 + <new tests>` with none pending. Independently confirm no skip survives in the new
file:

```bash
if (Select-String -Path src/battle/layout.test.ts -Pattern "it\.skip|describe\.skip|it\.todo" -Quiet) { exit 1 }
```

### B7 — confirm or refine the lens

The lens for this defect class is **already written** — the planning session added
**lens 127** ("A DOM overlay layered over a CANVAS-rendered scene makes any overlap
VIEWPORT-DEPENDENT...") to `~\.claude\skills\dissect\references\review-lenses.md`, since
the class was caught during planning and the ratchet must not wait for the build.

**ORCHESTRATOR AMENDMENT (2026-07-29, at the B4 gate): most of B7 is already done, and mind the
numbering.** Two different lenses in that file are both numbered **127** (and 114 and 120 also
collide — a pre-existing systemic issue in the file, flagged to the owner, deliberately NOT
renumbered here because other plans cite these numbers). The one that matters is the **DOM-overlay-
over-canvas** entry, not the per-unit-cost entry that shares its number. The orchestrator appended a
measured REFINEMENT to it at this gate rather than deferring the ratchet to B7: severity is monotonic
in `1/scale` so it is worst on the smallest viewport; the fix therefore belongs on the overlay rather
than the art, provable up front by solving each art-side candidate for its clearing value and testing
that against physical bounds; a candidate set must be feasibility-measured before it is offered as a
decision, or it is a false choice; and a union-bbox invariant cannot say WHICH sprite is occluded, so
it must be paired with a visual verdict. **B7's remaining job is genuinely narrow:** after B5/B6,
check only whether the RULED FIX taught something none of that says.

Your job is narrower: after B5/B6, re-read that lens against what actually happened and
**refine it if the build taught you something it does not yet say** — in particular, if the
ruled fix turned out to need per-slot rects rather than a whole-spread rect, or if the
panel-height measurement behaved differently from how sub-check (c) describes. If the lens
already covers it, say so explicitly in the PR body and change nothing. Do **not** append a
near-duplicate lens.

---

## Critique gate — dissect pass 1 dispositions

MEDIUM tier = one dissect pass. Verdict **FIX-THEN-SHIP**; all eight findings are resolved
below, none declined. Preflight re-run clean after the edits.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | MAJOR | Two of three legs of the rejected-alternative rationale unsound | **Fixed, and partially refuted.** Leg (ii)'s wording was wrong and is rewritten (the surviving concern is the untested call site, not `living === total`). Leg (iii) was *half* right: I probed `npx tsc --strict --noUnusedParameters --noEmit` this session — a 1-param impl satisfies a 2-param member (pass 1 correct, scene impls need no edits), **but** a 1-arg call against it fails `TS2554`, so the six test call sites (ledger #8) do need edits. Corrected cost recorded; decision now rests on leg (i) plus the three-fold precedent |
| 2 | MAJOR | 95% branch coverage asserted, not demonstrated by the prescribed tests | **Fixed.** B2 now prescribes `rectsIntersect`'s four-operand truth table, `gridRect`'s null arm as its own test (3b), `paintedBounds`'s zero-row case, and a discrimination probe before believing a green table |
| 3 | MAJOR | B2 test 1 compares floats with no tolerance; oracle is near-tautological | **Fixed.** Split into 1a (independent hand-computed table, verified numerically this session, `toBeCloseTo(…, 6)` because `1440×720` yields `57.60000000000002`) and 1b (DOM cross-check at ±0.5px, explicitly labelled a transcription check) |
| 4 | MAJOR | One blended MEDIUM tier hides that PR-B is far riskier; justification (c) unverifiable | **Fixed both.** Gates are now declared per PR with PR-B's four named explicitly. Provenance corrected: pass 1 was right that `git log -- src/battle/scenes/imposter.ts` shows one commit — the M6 PR-3 escapes were reducer/fight-derivation defects (`ROADMAP.md:82`), so the plan no longer claims this scene file is defect-prone |
| 5 | MAJOR | B2→B5 skip/re-enable loop has no closing verification | **Fixed.** B6 now requires a 0-skipped assertion plus a `it.skip`/`it.todo` grep over `layout.test.ts` |
| 6 | MINOR | 1440×720 `stageLeft` wrong (592 vs 272); claimed axis flip unsupported | **Fixed.** Recomputed numerically (`SC` had been used unscaled). The corrected numbers give a *stronger* argument: the **horizontal** condition inverts on a height change alone (207 < 300 at 900-tall, 321 > 300 at 720-tall). No vertical claim is made, since it needs the panel height. Confirmed no task consumes a table literal |
| 7 | MINOR | `Math.max(2, …)` is not an instrumented branch | **Fixed.** Folded into the coverage note: the `1280×360` row is there for correctness, contributing zero to the branch number |
| 8 | MINOR | Four parallel optional seams, consolidation never considered | **Fixed.** Recorded as considered-and-deferred on YAGNI grounds, with "a fifth seam is the trigger to generalize" written down so the next milestone does not re-litigate it |

Pass 1 also **strengthened** the plan on a point it had hedged: it traced that a killing
blow during CLONES leaves `phase === "clones"`, making `0/3 TARGET` the ordinary fast-kill
display rather than a defensive corner, and player-visible during the death animation. That
correction is folded into task A1 and raises `0/3` vs `0/1` to a real owner copy decision.

## Out of scope

- **Prose.** No new player-facing prose beyond the footer string, so hard constraint 1's
  owner-interview requirement stays untriggered. The `0/3 TARGET` default is
  owner-overridable with a one-line ruling.
- **The M4 sign-off items** (boss→project pairing, the five player-facing strings). Live
  on shipped defaults, overridable, unchanged by this milestone.
- **OPTIONAL / owner-gated stretch:** the ROADMAP records that *"two sequential victories
  fire exactly one toast"* is verified by **code inspection only**, because the FIGHT
  chooser starts a rematch with a random seed and `actions=` drives only the boot battle,
  and it notes *"anyone adding a second victory-driving rig should close this."* B1's CDP
  rig has real key and mouse input, which is exactly what that needs. It is **not**
  included here — it is engine-verification scope, not Imposter polish, and it would put
  a second owner-facing unknown inside a cosmetic milestone. Flagged for the owner: if he
  wants it, it is one extra task on this rig rather than a milestone of its own.
