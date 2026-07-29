# M4 — Lore unlock UI + progression persistence

**Written for builder-subagent execution; if something doesn't match, STOP and report rather than guess.**

Plan authored 2026-07-29 by the roadmap-workflow orchestrator (Opus 5 session). Base commit: `64d8662`.

## Blast radius: **HIGH**

Justification: this milestone introduces the app's **first persisted data store** (`localStorage`), and the value it persists is load-bearing for game balance. `defeatedBosses.length` feeds `maxHp = 100 + RIDER_HP * defeatedBosses.length` and `maxMp = 10 + RIDER_MP * ...` at `src/battle/engine.ts:222-223`, the same array feeds `deriveKit(defeatedBosses)` (`engine.ts:328`) and `deriveFightChoice(defeatedBosses)` (`src/battle/fight.ts:28`). A malformed, stale, duplicated, or hand-edited stored value therefore silently corrupts hero stats, ability kit, and fight routing with no error surface. That is a persisted format plus a cross-boundary contract, which is HIGH by the workflow's own definition.

Gates this tier requires, all mandatory below: claim ledger + measured baseline, preflight recheck, **two** dissect passes (pass 2 pinned to a non-author model), orchestrator diff review with the fixed lenses on **every** commit, a schema-evolution guard test, and a synthetic-corpus dry run before deploy.

## Owner rulings that bind this plan (2026-07-29 session)

1. **Gating is game-path only.** The browse/portfolio path (`phase === "browse"`, `BrowseIndex`, and every `/work/<slug>/` and `/experience/<slug>/` deep link) continues to show **all 11 items to every visitor, always**.

   > **URL prefixes (dissect pass 1, MAJOR).** Projects live at **`/work/<slug>/`**, experience at **`/experience/<slug>/`**, trailing slash canonical — see `src/router.ts:9` and the `^\/(work|experience)\/([a-z0-9-]+)\/?$` regex at `router.ts:14`. There is **no `/projects/` route**; the category *key* is `"projects"` but the URL prefix is `/work/`. An earlier draft of this plan used `/projects/<slug>` as a literal verification instruction, which resolves to nothing and would have false-passed the browse-path safety check. Locking applies only inside the play-phase command menu. This preserves the M3 guarantee ("a visitor who doesn't want to play must be able to review the experience/work section directly") and the North Star's broken-basics floor. The orchestrator recommended additive-only; the owner chose game-path gating with the doubled-visibility cost understood and accepted.
2. **Mechanism first, prose later.** M4 ships the unlock mechanism and UI over prose **already approved in `content.ts`**. It writes **no new prose**. Hard constraint 1 (owner voice, interview-only) is therefore not triggered by this milestone. Bespoke lore prose is a separate later milestone requiring owner desk time.
3. **Only the 6 `projects` items are gateable.** The 2 `experience` items and 3 `contact` items are never locked in either path. Contact is a broken-basics non-negotiable; work history is the most recruiter-critical content on the site.
4. **Two projects start unlocked**, and each of the 4 bosses unlocks exactly one more. 2 + 4 = 6, exact — every project is reachable by beating the rush.
5. **The two open Imposter design calls (clone/COMMAND clip, `1/1 TARGET` copy) are NOT in this milestone.** They ship together in their own polish milestone. Do not touch `src/battle/scenes/imposter.ts` plate copy or clone geometry here.

## Claim ledger

Every load-bearing factual claim below was verified in the authoring session at commit `64d8662`. Rechecks are cheap; exit 0 = claim still holds. `—` = not automatable, critic's job.

| # | Claim | Verified at | Recheck (pwsh, exit 0 = holds) |
|---|-------|-------------|--------------------------------|
| 1 | Baseline: 472 tests in 15 files, all passing (measured in-session by running `npm test`, not copied) | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $o = npm test 2>&1 \| Out-String; if ($o -match '15 passed' -and $o -match '472 passed') { exit 0 } else { exit 1 }` |
| 2 | No `localStorage` anywhere in `src/` — this milestone is the first. **Gates only the first builder dispatch**; task A5 intentionally introduces it, so this row is expected to flip afterwards and must not be re-run as a mid-build gate | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if ((Get-ChildItem src -Recurse -Include *.ts,*.tsx \| Select-String -Pattern 'localStorage').Count -eq 0) { exit 0 } else { exit 1 }` |
| 3 | `defeatedBosses` is `useState<string[]>` at `App.tsx:173`, seeded from `boot.current.battle?.defeatedBosses ?? []` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path src/App.tsx -Pattern 'useState<string\[\]>\(boot\.current\.battle\?\.defeatedBosses \?\? \[\]\)' -Quiet) { exit 0 } else { exit 1 }` |
| 4 | `setDefeatedBosses(final.defeatedBosses)` is the ONLY write site, in `onBattleVictory` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $n = (Select-String -Path src/App.tsx -Pattern 'setDefeatedBosses\(' -AllMatches).Count; if ($n -eq 1) { exit 0 } else { exit 1 }` |
| 5 | Hero stats derive from `defeatedBosses.length`, never stored | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path src/battle/engine.ts -Pattern 'RIDER_HP \* defeatedBosses\.length' -Quiet) { exit 0 } else { exit 1 }` |
| 6 | `parseDefeatedBosses` validates as an exact RUSH_ORDER **prefix** after dedupe, rejecting to `[]` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path src/battle/bootParams.ts -Pattern 'RUSH_ORDER\.slice\(0, deduped\.length\)' -Quiet) { exit 0 } else { exit 1 }` |
| 7 | `RUSH_ORDER` and `IMPLEMENTED_BOSSES` each hold the same 4 ids in the same order **today** (substance re-verified by dissect pass 2 against source) | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $s = Get-Content src/battle/rushOrder.ts -Raw; $r = ([regex]'RUSH_ORDER: readonly string\[\] = \[(?s)(.*?)\]').Match($s).Groups[1].Value; $i = ([regex]'IMPLEMENTED_BOSSES: readonly string\[\] = \[(?s)(.*?)\]').Match($s).Groups[1].Value; $rn = ([regex]::Matches($r,'[A-Z_]{4,}\|"[a-z-]+"')).Count; $inn = ([regex]::Matches($i,'[A-Z_]{4,}\|"[a-z-]+"')).Count; if ($rn -eq 4 -and $inn -eq 4) { exit 0 } else { exit 1 }` |
| 8 | `vitest.config.ts` `test.include` is `["src/battle/**/*.test.ts"]` only; coverage include + 95% branch threshold scoped to `src/battle/**/*.ts` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path vitest.config.ts -Pattern 'src/battle/\*\*/\*\.test\.ts' -Quiet) { exit 0 } else { exit 1 }` |
| 9 | No jsdom, happy-dom, or testing-library in `package.json`; zero `.test.tsx` files exist | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $d = (Select-String -Path package.json -Pattern 'jsdom\|happy-dom\|testing-library' -Quiet); $f = (Get-ChildItem src -Recurse -Filter *.test.tsx -EA SilentlyContinue).Count; if (-not $d -and $f -eq 0) { exit 0 } else { exit 1 }` |
| 10 | `content.ts` exports `CATS`; 11 items total — projects 6, experience 2, contact 3 | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $n = (Select-String -Path src/content.ts -Pattern '^\s+title: "' -AllMatches).Count; if ($n -eq 11) { exit 0 } else { exit 1 }` |
| 11 | Exactly 8 items carry a `slug`: the 6 projects + 2 experience. Contact items have none | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $n = (Select-String -Path src/content.ts -Pattern '^\s+slug: "' -AllMatches).Count; if ($n -eq 8) { exit 0 } else { exit 1 }` |
| 12 | The 6 project slugs are exactly: `mia`, `backend-harness`, `the-failure-that-left-no-logs`, `observability-by-default`, `notification-dispatch`, `curio` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; $s = Get-Content src/content.ts -Raw; $ok = @('"mia"','"backend-harness"','"the-failure-that-left-no-logs"','"observability-by-default"','"notification-dispatch"','"curio"') \| ForEach-Object { $s.Contains($_) }; if ($ok -notcontains $false) { exit 0 } else { exit 1 }` |
| 13 | `activate()` at `App.tsx:353` opens a page for `projects`/`experience`, else copies/opens a link — this is the play-path entry point to gate | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path src/App.tsx -Pattern 'c\.key === "projects" \|\| c\.key === "experience"' -Quiet) { exit 0 } else { exit 1 }` |
| 14 | Play-path submenu maps items at `App.tsx:903` (desktop) and `App.tsx:1112` (mobile sheet). Line numbers drift — the builder must locate both `cat.items.map` sites and confirm exactly two exist in App.tsx | 64d8662 | — |
| 15 | Dev query params (`?phase=`, `?defeated=`, `?boss=`) are gated behind `dev = import.meta.env.DEV \|\| hostname === "localhost"` at `App.tsx:63` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path src/App.tsx -Pattern 'import\.meta\.env\.DEV \|\| loc\.hostname === "localhost"' -Quiet) { exit 0 } else { exit 1 }` |
| 16 | Nothing in `BattleState` or `BossState` is non-JSON (no Map/Set/Date/function/`performance.now`); only `defeatedBosses` has cross-fight meaning. Structural claim, not automatable — the critic verifies it | 64d8662 | — |
| 17 | The existing storage-unavailable precedent is the `try { sessionStorage... } catch {}` at `App.tsx:68-80` | 64d8662 | `cd 'C:\Agent Projects\portfolio-rpg'; if (Select-String -Path src/App.tsx -Pattern 'sessionStorage unavailable' -Quiet) { exit 0 } else { exit 1 }` |

**Fixture seams.** Every test prescribed below drives one of exactly two seams, both of which exist or are created by task A2: (i) a `ProgressStore` interface parameter — an object with `getItem`/`setItem`/`removeItem` — satisfied in tests by a plain in-memory fake, no jsdom required; (ii) pure functions taking plain arrays. **No test in this plan requires a DOM.** If a task seems to need one, STOP and report.

## Design decisions

**D1 — One shared validator, never two.** `parseDefeatedBosses` (`bootParams.ts:42`) already dedupes and validates against an exact `RUSH_ORDER` prefix, and its docstring records the dissect finding (F8) that motivated it: set-validation lets rider count and kit derivation disagree, producing states unreachable in play. The storage read path enforces the **same** invariant. Task A1 extracts the shared core so there is exactly one implementation. **Writing a second validator in the progress module is a plan violation.**

**D2 — Cap the prefix at `IMPLEMENTED_BOSSES`, not just `RUSH_ORDER`.** Today both arrays hold the same 4 ids, so this is a no-op. It will not stay that way: `rushOrder.ts` documents `IMPLEMENTED_BOSSES` as the shipped prefix of `RUSH_ORDER`, to be extended per boss PR, and the next backlog milestone adds a boss per work section. A stored value referencing a boss that `RUSH_ORDER` knows but no module implements would route to a nonexistent scene. The storage read therefore truncates to `min(prefix.length, IMPLEMENTED_BOSSES.length)`.

> **Seam required, or this test cannot exist (dissect pass 1, BLOCKER).** An earlier draft told the builder to test the cap "using a locally-constructed roster rather than mutating the real constants" — but no such seam existed, and the test is unwritable without one: `coerceRushPrefix` rejects anything that is not an exact `RUSH_ORDER` prefix *before* the cap runs, and `RUSH_ORDER` has only 4 entries, so no value long enough to be capped can ever reach the cap. The two arrays being identical today makes the cap unobservable through the public API.
>
> **Therefore `readProgress` takes an optional roster seam**, defaulting to the real constants so every production call site is unchanged:
>
> ```ts
> export interface BossRoster {
>   rushOrder: readonly string[];
>   implemented: readonly string[];
> }
> const REAL_ROSTER: BossRoster = { rushOrder: RUSH_ORDER, implemented: IMPLEMENTED_BOSSES };
> export function readProgress(store: ProgressStore | null, roster: BossRoster = REAL_ROSTER): string[];
> ```
>
> `coerceRushPrefix` gains the same optional parameter (defaulting to `RUSH_ORDER`) so the prefix check and the cap agree on which roster they are talking about. The D2 test then passes a local roster where `implemented` is genuinely shorter than `rushOrder` (e.g. `{rushOrder: ["a","b","c"], implemented: ["a","b"]}`), stores `["a","b","c"]`, and asserts the result is `["a","b"]`. Deleting the cap makes that test fail. **Do not use `vi.mock` on `rushOrder.ts`** — a real parameter is simpler and does not couple the test to module-loader behavior.

**D3 — Versioned envelope, single key.** Key: `yrpg.progress`. Value: `{"v":1,"defeated":["alert-storm",...]}`. The `v` field exists so a future shape change is detectable rather than silently misread. Any value whose `v` is absent, non-numeric, or `!== 1` is treated as **absent** (fresh progress), never as partially-readable. Unknown extra top-level fields are **dropped on read and not preserved on write** — this app is the only writer, and round-tripping unknown fields would silently persist garbage.

**D4 — Every storage touch is wrapped.** `localStorage` access **throws** (not returns null) in some privacy configurations, and `setItem` throws on quota. Read failures degrade to empty progress; write failures degrade to a no-op. Neither ever throws to the caller, and neither ever logs in the pure module (console-free, matching `bootParams.ts`). Follow the existing precedent at `App.tsx:68-80`.

**D5 — URL wins over storage, in dev only.** Dev capture keys are gated behind `dev` (`App.tsx:63`), so in production storage is the only source. On localhost — where the CDP capture harness runs — an explicit `?defeated=` **overrides** stored progress entirely, so a capture is never polluted by whatever that browser profile had saved. A capture that wants stored progress simply omits the param.

> **The obvious implementation of this is wrong (dissect pass 1, MAJOR).** `decideBoot`'s battle arm (`App.tsx:90-107`) builds a **truthy** `battle` object whenever `?phase=battle` fires, regardless of whether `defeated=` was supplied — because `parseDefeatedBosses(null)` returns `{value: [], rejected: false}`. So a condition of the form "if `boot.current.battle` exists, use its `defeatedBosses`" cannot distinguish *param omitted* from *param explicitly empty*. Both take the URL-wins branch and resolve to `[]`, which silently destroys the exact "omit the param, get stored progress" guarantee this decision exists to provide.
>
> **Required shape:** `decideBoot` must leave `battle.defeatedBosses` **`undefined`** when the raw param is absent, distinct from `[]` when it is present but empty. Change the battle arm to pass `params.get("defeated")` through and only set the field when the raw value is non-null. The seed condition then tests `boot.current.battle?.defeatedBosses !== undefined`, not the existence of `boot.current.battle`. Add a test for both arms.

**D6 — Gating is a render-and-activate concern, not a content concern.** `content.ts` is **not modified by this milestone** (owner-voice surface; do not touch). The unlock mapping lives in a new leaf module keyed by **slug strings**, never by `{ri, si}` indices. `PageRef` is index-based; persisting or keying unlocks on indices would silently remap every visitor's saved progress the moment an item is added to `content.ts`. Slugs are stable, and claim 11 confirms all gateable items have one.

**D7 — Locked rows render as locked, not absent.** A play-path visitor sees the row with a locked treatment, so the menu never looks empty or broken and the player knows there is more to find. Absent rows would read as a bug.

**D8 — Proposed boss→project pairing (owner-overridable).** Seed unlocked: `mia`, `backend-harness`. Then `alert-storm` → `observability-by-default`, `cascade` → `notification-dispatch`, `silent-failure` → `the-failure-that-left-no-logs`, `imposter-syndrome` → `curio`. Thematic where it fell out naturally. If the owner has ruled differently by build time, that ruling wins.

**D10 — Gate at the render boundary, not at each entry point.** `setPage` has **six** call sites in `App.tsx` (315, 325, 479, 486, 489, and via `openPage` at 362). Gating only `activate()` leaves the popstate handler at `App.tsx:474-495` wide open: it calls `setPage(p)` directly at line 479 and restores `phase` to `"play"` when the history entry says so.

Concrete bypass, reachable in production once task A6 exists: player beats all four bosses, opens Curio from the play menu (history entry: phase `play`, path `/work/curio/`), navigates onward, uses the A6 reset to wipe progress, then presses **Back**. `pageForPath` resolves, `statePhase === "play"`, and Curio renders inside the play path while locked.

Therefore the authoritative gate lives where the page is **rendered**: `CaseStudyPage` is mounted unconditionally at `App.tsx:1277` and selects its entry by a pure `CATS[ri].items[si]` index lookup with no gating in it. Add the check at that mount site — when `phase` is the play path and the resolved item is gated-and-locked, render the locked treatment instead of the case study. `activate()`'s early return (task B3) stays as the *feedback* path so a keypress is not silently dead, but it is no longer the only thing standing between a locked item and the screen.

**D11 — The dive intro must respect saved progress (new consequence of persistence).** `hasDived` resets to `false` on every load (`App.tsx:176`) and `onIntroHandoff` (`App.tsx:503-510`) launches the battle with no `boss`, which `initBattle` defaults to `ALERT_STORM_ID` (`engine.ts:196-197`). Before M4 this was always correct, because `defeatedBosses` was `[]` on every fresh load. After M4 a returning visitor with saved progress who clicks into the game is dropped into a redundant Alert Storm rematch and can only reach their real progress through the FIGHT chooser afterwards.

> **`deriveFightChoice` is the wrong seam for this (dissect pass 2, MAJOR; independently found by the orchestrator).** Read `fight.ts:28-46`: `{mode:"direct", boss}` is returned **only for a completely fresh visitor** (one row). At 1, 2, or 3 bosses beaten it returns `{mode:"chooser", rows}`, which has **no next-undefeated-boss field at all**. At 4 beaten, `nextBoss` is `undefined` and every row is a rematch (pinned by `fight.test.ts:31`). So the naive `rows.find(r => !r.isRematch)?.boss` yields `undefined`, `initBattle` defaults it to `ALERT_STORM_ID` (`engine.ts:196-197`), and a player who has beaten the entire rush is dropped into a forced Alert Storm rematch — precisely the failure D11 exists to remove.

**Required mechanism.** Export a new pure helper from `src/battle/fight.ts` and use it directly; do not re-derive it inside `App.tsx` (`fight.ts`'s own header forbids App from re-deriving chooser logic):

```ts
/** Next boss in rush order the player has not beaten, or undefined when the
 *  rush is complete. Shared by deriveFightChoice and the dive handoff. */
export function nextUndefeatedBoss(defeatedBosses: string[]): string | undefined {
  return IMPLEMENTED_BOSSES.find((id) => !defeatedBosses.includes(id));
}
```

Refactor `deriveFightChoice` to call it, so the two can never disagree. Unit-test it at 0, 1, 3, and 4 bosses beaten.

**Ruling on the completed-rush dive:** when `nextUndefeatedBoss` returns `undefined`, **skip the battle entirely and land in the play/menu world.** This follows the standing M5 ruling that "the menu world is the post-battle landing" — a player who has finished the rush should not be forced into a rematch to get back in. Rematches stay available through the FIGHT chooser.

**Default ruling for returning visitors with partial progress:** the dive lands on `nextUndefeatedBoss(defeatedBosses)`. First-time visitors are unaffected (empty progress → Alert Storm, unchanged).

Both rulings adjust M5's "dive lands in Alert Storm" for returning visitors and are **surfaced to the owner at plan handoff**; if he prefers the forced rematch, that ruling wins and this becomes a logged accepted gap instead. Either way the behavior must be verified — see the B6 dive rows.

**D9 — No new test dependencies.** The progress modules are pure with storage injected, so they test under the existing node environment. Do **not** add jsdom, happy-dom, or testing-library. Do **not** add a `test` key to `vite.config.ts` — it fails `tsc -b` (TS2353); the config lives in `vitest.config.ts` only.

## Verification commands

- `npm test` — full suite, expected **472 passing before task A1**, growing thereafter.
- `npx tsc -b` — type check. **Bare `npx tsc --noEmit` is a NO-OP in this repo** (solution-style root tsconfig, `"files": []`); it exits 0 on broken code. Never use it as a gate.
- `npm run build` — tsc + vite.
- `npm run verify:canon` — byte-compares generated modules; must stay green (this milestone touches no generated module).

---

# PR-A — persistence core (no user-visible change)

Branch: `feat/m4-pr-a-progress-persistence`.

At the end of PR-A there is **no gating** — every item stays open in both paths. PR-A is nonetheless not invisible, and the orchestrator's diff review should expect exactly three user-visible deltas, all of which auto-deploy to the live site on merge:

1. Progression survives a reload (the point of the PR).
2. A new reset action in the play menu, with a confirmation toast (task A6).
3. Returning visitors with saved progress no longer dive into a redundant Alert Storm rematch (task A5 step 6 / D11).

That intermediate state is coherent and shippable on its own: nothing is hidden, and persistence plus correct dive routing is a complete feature without the gating layer.

### Task A1 — extract the shared rush-prefix validator

Files: `src/battle/bootParams.ts`, `src/battle/bootParams.test.ts`.

TDD. First write a failing test for a new exported pure function:

```ts
export function coerceRushPrefix(
  tokens: string[],
  rushOrder: readonly string[] = RUSH_ORDER,
): DefeatedParseResult
```

Behavior, identical to today's inner logic: dedupe preserving first-seen order; compare against `rushOrder.slice(0, deduped.length)`; return `{ value: prefix, rejected: false }` on an exact match, else `{ value: [], rejected: true }`.

> **The `rushOrder` parameter is required, not optional polish (dissect pass 2, MAJOR).** D2's cap test passes a local roster like `{rushOrder: ["a","b","c"], implemented: ["a","b"]}`. Without this parameter, `coerceRushPrefix` validates `["a","b","c"]` against the **real** `RUSH_ORDER`, rejects it, and the cap is never reached — making the D2 test unwritable again, one seam over from where pass 1 found the same problem. Add a test that exercises a non-default `rushOrder`; because it defaults, every existing caller and every existing test is unaffected.

Then refactor `parseDefeatedBosses` to become:

```ts
export function parseDefeatedBosses(raw: string | null): DefeatedParseResult {
  if (raw === null) return { value: [], rejected: false };
  const tokens = raw.split(",").map((t) => t.trim()).filter(Boolean);
  return coerceRushPrefix(tokens);
}
```

**Every existing `bootParams` test must stay green unchanged.** If any existing test needs editing, STOP and report — that means behavior changed, which this task forbids.

Expected: suite grows by the new `coerceRushPrefix` cases, all previously passing tests still pass.

### Task A2 — the progress store

New files: `src/progress/store.ts`, `src/progress/store.test.ts`. **Also edits `vitest.config.ts`** — see the note immediately below.

> **Do this edit FIRST, before writing any test (dissect pass 2, MAJOR).** `vitest.config.ts` pins `include: ["src/battle/**/*.test.ts"]`, so a new `src/progress/store.test.ts` is **not collected by the runner at all** — the red step of TDD is unobservable and the suite count does not move. Add `"src/progress/**/*.test.ts"` to `test.include` as the first action of this task. (The coverage `include` and thresholds still land in A3; only the test-collection glob moves here.) Confirm by running `npm test` and seeing the new file's failing cases actually appear.

TDD, tests first. Public surface:

```ts
export const PROGRESS_KEY = "yrpg.progress";
export const PROGRESS_VERSION = 1;

/** Minimal shape of the Web Storage API this module uses. Injected so the
 * module stays pure and testable under the node environment — no jsdom. */
export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface BossRoster {
  rushOrder: readonly string[];
  implemented: readonly string[];
}

/** Real constants; the parameter exists so the D2 cap is testable (see D2). */
export const REAL_ROSTER: BossRoster = { rushOrder: RUSH_ORDER, implemented: IMPLEMENTED_BOSSES };

export function readProgress(store: ProgressStore | null, roster?: BossRoster): string[];
export function writeProgress(store: ProgressStore | null, defeated: string[], roster?: BossRoster): void;
export function clearProgress(store: ProgressStore | null): void;
```

`readProgress` must return `[]` (never throw, never log) for **every** one of these, each its own test case:

1. `store` is `null` (storage unavailable at the call site).
2. `getItem` throws (SecurityError simulation).
3. Key absent (`getItem` returns `null`).
4. Value is not valid JSON (`"{"`, `"undefined"`, `""`).
5. Value parses to a non-object (`"42"`, `"null"`, `"[]"`, `'"x"'`).
6. `v` missing, or non-numeric, or a number other than 1.
7. `defeated` missing, or not an array, or an array containing a non-string.
8. `defeated` contains ids not in `RUSH_ORDER`.
9. `defeated` is a valid id set but **out of rush order** (e.g. `["cascade","alert-storm"]`) — must reject to `[]` per D1.
10. `defeated` contains duplicates (`["alert-storm","alert-storm"]`) — dedupes to a valid 1-prefix and is **accepted** as `["alert-storm"]`, matching `coerceRushPrefix`.

And must return the correct prefix for valid values, including the empty array and the full 4-boss array.

`readProgress` implements D2's cap: after `coerceRushPrefix` succeeds, truncate to at most `IMPLEMENTED_BOSSES.length`. Test this with an explicit case asserting that a value one longer than the implemented count truncates rather than passing through.

`writeProgress` must: refuse to write anything that does not itself pass `coerceRushPrefix` (a caller bug must not corrupt the store); serialize `{v: PROGRESS_VERSION, defeated: <validated prefix>}`; and swallow a throwing `setItem` (quota) as a silent no-op. Test each.

`readProgress` implements the D2 cap against `roster.implemented`, defaulting to `REAL_ROSTER`. Include the D2 test described in that decision, using a local roster whose `implemented` is genuinely shorter than its `rushOrder`.

Console-free. No imports beyond `../battle/rushOrder` and `../battle/bootParams` — specifically, do **not** import `engine.ts` (it drags the battle engine into the landing bundle; see the `rushOrder.ts` header comment, +4.95 kB measured).

### Task A3 — bring `src/progress/**` under test + coverage gates

File: `vitest.config.ts`.

```ts
test: {
  include: ["src/battle/**/*.test.ts", "src/progress/**/*.test.ts"],
  coverage: {
    provider: "v8",
    include: ["src/battle/**/*.ts", "src/progress/**/*.ts"],
    thresholds: {
      "src/battle/**/*.ts": { branches: 95 },
      "src/progress/**/*.ts": { branches: 95 },
    },
  },
},
```

Then run the **discrimination probe** required by the M6 coverage lesson: temporarily skip one `store.test.ts` case, run `npm test`, confirm the reported `src/progress` coverage **drops**, then unskip. Report the before/after numbers in the commit message. A gate that does not move when you remove a test is not a gate.

> **Skip a case that owns its own branch (dissect pass 2, MINOR).** The three invalid-JSON inputs (`"{"`, `"undefined"`, `""`) all fall through the **same** catch branch, so skipping one of those moves coverage by nothing and the probe reads as "the gate doesn't work" on a gate that works fine. Skip the **`getItem` throws** case instead — it is the sole occupant of its branch.

Do **not** use `/* v8 ignore */` anywhere in this milestone. If a branch is genuinely unreachable, restructure it. (M6 PR-3 found an ignore comment silently swallowing a real uncovered branch and reading as 100%.)

### Task A4 — schema-evolution guard test

New file: `src/progress/schema.guard.test.ts`.

This is the HIGH-tier requirement and it must not be folded into `store.test.ts`, because its purpose is different: it pins the **on-disk shape** so a future refactor that changes serialization is caught.

Hard-code raw strings exactly as they would sit in `localStorage` today — do not build them by calling `writeProgress`, which would make the test tautological:

```ts
const V1_EMPTY = '{"v":1,"defeated":[]}';
const V1_ONE = '{"v":1,"defeated":["alert-storm"]}';
const V1_FULL = '{"v":1,"defeated":["alert-storm","cascade","silent-failure","imposter-syndrome"]}';
const V1_EXTRA_FIELD = '{"v":1,"defeated":["alert-storm"],"futureField":true}';
```

Assert `readProgress` yields `[]`, `["alert-storm"]`, the full four, and `["alert-storm"]` respectively — the last proving D3's forward-tolerance for unknown fields. Add a comment stating that changing these literals is a **breaking storage change** requiring a version bump and a migration path, not a test edit.

### Task A5 — wire into `App.tsx`

File: `src/App.tsx`.

1. Add a module-level helper that yields a `ProgressStore | null`, wrapped so that even *accessing* `window.localStorage` cannot throw:

```ts
function progressStore(): ProgressStore | null {
  try {
    return window.localStorage;
  } catch {
    /* localStorage unavailable (privacy mode / disabled) — progress does not persist */
    return null;
  }
}
```

2. Make the `defeated=` param's absence distinguishable, per **D5**. In `decideBoot`'s battle arm, set `defeatedBosses` to `undefined` when `params.get("defeated")` is `null`, and to the parsed value otherwise. Widen the `BootState` battle type accordingly.

3. Seed the state per **D5**, with a **lazy** initializer so storage is touched once on mount rather than on every render of `App` (which re-renders on toasts, resize, and every keydown):

```ts
const [defeatedBosses, setDefeatedBosses] = useState<string[]>(() =>
  boot.current.battle?.defeatedBosses !== undefined
    ? boot.current.battle.defeatedBosses      // dev URL wins (D5)
    : readProgress(progressStore()),
);
```

A non-lazy `useState(readProgress(progressStore()))` would re-read storage on every render. Use the arrow form exactly as shown.

4. Add `defeatedBosses` to the existing `stateRef` at `App.tsx:201-202` — both the `useRef` initializer and the per-render reassignment. This is required by tasks B3 and B4; `onBattleVictory` is a `useCallback` with a permanently stable dep (`goPhase` is `useCallback(..., [])`), so it is created once on mount and any `defeatedBosses` it closes over directly is frozen at `[]` forever.

5. Persist on victory. `onBattleVictory` currently calls `setDefeatedBosses(final.defeatedBosses)` (the only write site, claim 4). Add `writeProgress(progressStore(), final.defeatedBosses)` immediately alongside it. Do not persist anywhere else.

6. Apply **D11**: route `onIntroHandoff` (`App.tsx:503-510`) to `deriveFightChoice(stateRef.current.defeatedBosses)`'s next-undefeated-boss target, falling back to Alert Storm when progress is empty.

7. Add a dev-only reset honoring `?resetProgress=1` via `clearProgress(progressStore())` before the seed is computed. The capture harness needs a deterministic wipe.

   > **Placement matters (dissect pass 2, MINOR).** Putting the wipe inside `decideBoot`'s `if (dev)` block makes it unreachable on a deep-link boot: `decideBoot` returns at `App.tsx:82-84` for any path `pageForPath` resolves, **before** the dev block runs. So `/work/curio/?resetProgress=1` would silently not reset. Handle `resetProgress` before the `pageForPath` early-returns, still gated on `dev`.

8. **Audit the existing capture consumers.** D5 changes the `?phase=battle` contract: with `defeated=` omitted, the seed is now profile-storage-dependent instead of a deterministic `[]`. Grep the repo's capture scripts and any documented capture invocations for `phase=battle` and confirm each either passes an explicit `defeated=` or genuinely wants stored progress. List what you found and what you changed in the PR body — a capture that silently starts reading a stale browser profile is the whole reason D5 exists.

Run `npx tsc -b` and `npm run build`. **Measured baseline at 64d8662** (authoring session, `npm run build`): landing chunk `dist/assets/index-*.js` = **234.71 kB** (gzip 72.03 kB); lazy `dist/assets/BattleScene-*.js` = 80.27 kB (gzip 26.32 kB); CSS 1.32 kB; 66 modules transformed.

`src/progress/store.ts` imports only leaf modules, so the landing chunk should grow by well under 1 kB. Report the measured after-size in the commit message. **If the landing chunk exceeds ~236 kB, STOP and report** — that means the battle engine leaked into the landing chunk, the exact regression `rushOrder.ts` was split out to prevent (+4.95 kB, measured in M6 PR-1a).

### Task A6 — player-facing reset

A player who has beaten the rush has no way to replay from zero, and after A5 that state is permanent. Add a reset affordance reachable from the play-path menu (not the browse path). Follow the existing `showToast` pattern (`App.tsx:181` state, used at `App.tsx:368`) to confirm the wipe. Keep it a single, clearly-labeled action; it calls `clearProgress` and `setDefeatedBosses([])`.

If the existing menu structure makes placement ambiguous, implement the simplest correct version and note the placement question in the PR body for the orchestrator's diff review rather than inventing new menu chrome.

---

# PR-B — game-path gating + unlock UI

Branch: `feat/m4-pr-b-unlock-ui`. Depends on PR-A merged.

### Task B1 — the unlock map

New files: `src/progress/unlocks.ts`, `src/progress/unlocks.test.ts`.

TDD. Pure, leaf, no DOM, no `content.ts` import (keep it a data map so `content.ts` stays untouched per D6):

```ts
/** Slugs visible in the play path before any boss is beaten (D4/D8). */
export const SEED_UNLOCKED: readonly string[] = ["mia", "backend-harness"];

/** Boss id -> the project slug beating it reveals (D8, owner-overridable). */
export const UNLOCK_BY_BOSS: Readonly<Record<string, string>> = {
  "alert-storm": "observability-by-default",
  cascade: "notification-dispatch",
  "silent-failure": "the-failure-that-left-no-logs",
  "imposter-syndrome": "curio",
};

/** Every slug the play path may open, given progression. */
export function unlockedSlugs(defeated: string[]): Set<string>;

/** True when this item is gated at all. Non-project items never are (D3). */
export function isGateable(categoryKey: string, slug: string | undefined): boolean;
```

Required tests, each explicit:

- `unlockedSlugs([])` is exactly the seed set.
- Each boss adds exactly its mapped slug.
- Beating all four yields all 6 project slugs — assert the resulting set equals the 6 slugs from claim 12, so a typo in either map fails loudly.
- **Coverage invariant:** `SEED_UNLOCKED` and the values of `UNLOCK_BY_BOSS` are disjoint, and their union has exactly 6 members. Assert this directly; it is what guarantees every project is reachable and none is double-assigned.
- `isGateable` returns `false` for `experience` and `contact` category keys regardless of slug, and `false` for an undefined slug.
- Every key of `UNLOCK_BY_BOSS` is a member of `IMPLEMENTED_BOSSES` — a boss id typo here would silently make a project permanently unreachable.
- **Cross-check the slugs against real content, not a second hardcoded list (dissect pass 2, MINOR).** Asserting the 6 slugs against another literal array in the test file means a rename in `content.ts` keeps every test green while permanently locking that project out of the play path. Import `CATS` **in the test only** (the module itself stays leaf per D6) and assert `SEED_UNLOCKED ∪ values(UNLOCK_BY_BOSS)` is exactly the set of real `projects` slugs.
- `writeProgress`'s `roster` parameter needs at least one test that passes a non-default roster, or the parameter is inert and its presence is misleading.

### Task B2 — locked rendering in the play path

File: `src/App.tsx`.

Locate **both** `cat.items.map` sites (desktop submenu ~line 903, mobile sheet ~line 1112 at base commit; confirmed by dissect pass 2 that exactly two exist). In each, when the phase is the play path and the item `isGateable` and its slug is not in `unlockedSlugs(defeatedBosses)`, render the row in a locked treatment per D7: the row remains present and occupies its normal position, shows a locked label instead of the title, and is marked `aria-disabled`.

> **Masking the row label alone leaves the lock purely cosmetic (dissect pass 2, MAJOR — the most consequential finding of either pass).** The desktop **detail panel** (`App.tsx:668-745`) renders `item.title`, `item.meta`, `item.stat`, `item.body`, and `item.tags` for `cat.items[subIdx]` — and `subIdx` lands on a locked row from **`onMouseEnter={() => setSub(j)}` at `App.tsx:912`** and from plain arrow-key navigation. `aria-disabled` prevents neither. Concretely: a fresh visitor on desktop arrows down to the locked Curio row and the right-hand panel displays Curio's full title, stat line, body paragraph, and tags without a single click. The mobile sheet row (`App.tsx:1134-1156`) separately keeps `it.meta` and `it.stat` visible beside the masked title.
>
> **Therefore this task must also:**
> 1. Give the **detail panel** a locked treatment — when the currently selected item is gated-and-locked, render placeholder content in place of `title`/`meta`/`stat`/`body`/`tags`. The panel's own category label and blurb may stay.
> 2. Mask `it.meta` and `it.stat` in the **mobile sheet row**, not just the title.
>
> Leaving either in place ships a lock that reveals exactly what it claims to hide.

The browse path (`BrowseIndex.tsx`) is **not modified**. Confirm by leaving that file untouched in this commit.

### Task B3 — refuse to open a locked entry

Files: `src/App.tsx` (both the `activate()` early return and the `CaseStudyPage` mount at ~line 1277).

> **`activate()` is NOT play-path-only (dissect pass 1, BLOCKER).** `BrowseIndex` reuses it verbatim: `onItem={(ri, si) => activate(ri, si)}` at `App.tsx:618`, and `BrowseIndex.tsx`'s own header documents it as "the single source of item semantics." Gating `activate()` on `isGateable && !unlocked` **without a phase check** silently blocks the browse path from opening a locked project — a direct violation of owner ruling 1, and nothing in the current verification set would have caught it.

1. **Render-boundary gate (authoritative, per D10).** At the `CaseStudyPage` mount (`App.tsx:1277`), when `phase` is the play path **and** the resolved item is gated-and-locked, render the locked treatment instead of the case study. This is what actually closes the popstate bypass at `App.tsx:479`, which `activate()` cannot see.

2. **`activate()` early return (feedback path).** Before the `openPage(r, j)` call in the `projects`/`experience` branch, return early **only when `stateRef.current.phase === "play"`** and the item is gated-and-locked, reusing `showToast` so the keypress is not silently dead. The phase check is mandatory, not optional.

Deep links are unaffected: `pageForPath` routes to `phase: "browse"` (`App.tsx:83`), which per ruling 1 is always open. Verify explicitly that **`/work/curio/`** still renders cold with zero progress — note the `/work/` prefix and trailing slash (`router.ts:9`); `/projects/curio` is not a route and would false-pass this check by resolving to nothing.

### Task B4 — the unlock moment

When `onBattleVictory` records a newly defeated boss, surface the reveal: show a toast naming the project just unlocked, derived from `UNLOCK_BY_BOSS[bossId]` and the matching `content.ts` title. Read the title through the existing `CATS` lookup; do not duplicate title strings.

Guard against a rematch firing a spurious unlock: only fire when the boss was **not** already in the previous `defeatedBosses`.

> **The obvious way to compute "previous" is broken (dissect pass 1, BLOCKER).** `onBattleVictory` is `useCallback((final) => {...}, [goPhase])` at `App.tsx:513-521`, and `goPhase` is `useCallback(..., [])` at `App.tsx:235-242` — referentially stable forever. So `onBattleVictory` is created **once, on mount**, and any `defeatedBosses` read directly inside it is frozen at its mount value. Beat Alert Storm, then rematch it: the frozen `[]` makes `!prev.includes("alert-storm")` true again and fires a spurious unlock toast on a victory lap. Nothing in the test suite or in B5/B6 drives two sequential in-session victories, so this ships silently.
>
> **Required source of "previous": `stateRef.current.defeatedBosses`**, added to the existing ref in task A5 step 4. The ref is reassigned on every render (`App.tsx:202`), so at the moment the victory handler fires it holds the committed pre-victory value. Compute `final.defeatedBosses.filter(id => !stateRef.current.defeatedBosses.includes(id))` and fire the toast only for a non-empty result.
>
> **Do not** substitute `final.events.find(e => e.type === "unlock")` without first verifying the event-buffer lifetime yourself. The engine does push `{type:"unlock", id: bossId}` inside the correct first-victory guard (`engine.ts:109` declares it; the push sits inside `if (!s.defeatedBosses.includes(bossId))`), but `onVictory` is invoked from an **Enter press on the victory overlay** (`BattleScene.tsx:638`, `:1020`) with `stateRef.current.state`, not at the killing reduce. Whether that state still carries the killing reduce's events was **not** verified while writing this plan. The `stateRef` diff above is correct regardless, so prefer it.

### Task B5 — verification evidence unit tests structurally cannot produce

The M6 lesson is binding here: a green suite cannot see animation-window state or layout. Produce both:

1. **Locked-state capture, desktop 1440**, play path with zero progress, showing locked rows present and legible. Then a second capture with full progress showing all six unlocked. **And a third at partial progress** (two bosses beaten, 4 unlocked / 2 locked) — the mixed row state is the one real visitors spend the most time in, and zero/full captures alone prove only the two states that never coexist on screen.

   **A fourth capture is mandatory: the cursor parked ON a locked row**, showing the detail panel in its locked treatment. This is the only frame that proves the F1 leak is actually closed; a capture that never selects a locked row cannot observe the failure it is meant to rule out.
2. **Mobile geometry measurement** of the locked row in the mobile sheet — computed style and bounding rect at an emulated mobile viewport, proving the locked row is visible and not underlapped. Use emulated-viewport DOM measurement, **not** raw `msedge --headless --window-size` below ~478px (the min-width clamp produces false clipping — see the ROADMAP gotcha).

Before any judging, run the capture sanity check on every PNG:

```bash
pwsh -NoProfile -File ~\.claude\skills\roadmap\helpers\Test-CaptureSane.ps1 <png1> <png2>
```

A FAIL means fix the capture, not judge it. Then dispatch a pinned subagent to return a text verdict; do not load PNGs into the orchestrator.

### Task B6 — synthetic-corpus dry run (HIGH gate, before merge)

Fabricate a corpus of stored values — never real user data — and drive each through the **real** boot path in a browser, not through unit tests:

| Stored value | Expected |
|---|---|
| (key absent) | seed unlocks only, 2 projects open |
| `{"v":1,"defeated":["alert-storm"]}` | 3 projects open, hero 110 max HP |
| `{"v":1,"defeated":["cascade","alert-storm"]}` | rejected → seed only |
| `{"v":1,"defeated":["alert-storm","alert-storm"]}` | dedupes → 3 projects open |
| `{"v":2,"defeated":["alert-storm"]}` | treated as absent → seed only |
| `{"v":1,"defeated":"alert-storm"}` | rejected → seed only |
| `not json at all` | rejected → seed only |
| full 4-boss value | all 6 open, hero at full rider stats |

**Plus these three rows, which the unit suite structurally cannot reach:**

| Scenario | Expected |
|---|---|
| Zero progress, then open `/work/curio/` directly and via the browse index | **Renders fully.** Curio is locked in the play path but the browse path is always open (ruling 1). A failure here means `activate()` was gated without the phase check. |
| Two sequential victories in one session (beat Alert Storm, then rematch it) | Exactly **one** unlock toast, on the first win. A second toast on the rematch means the stale-closure bug in B4 shipped. |
| Full progress → open a project from the play menu → A6 reset → browser **Back** | The restored page must **not** render the now-locked case study inside the play path. This is the D10 popstate bypass. |
| **Dive at partial progress** (2 bosses stored) → click into the game | Lands on boss 3, not a redundant Alert Storm rematch. This is D11's whole point and no unit test can reach it. |
| **Dive at full progress** (all 4 stored) → click into the game | Lands in the **menu world**, no battle at all, per D11's completed-rush ruling. A forced Alert Storm rematch here means D11 was implemented via the broken `deriveFightChoice` route. |
| Cursor parked on a locked row, desktop | Detail panel shows the locked treatment, **not** the item's title/meta/stat/body/tags. The F1 leak. |

Set each via the devtools console, reload, and observe. Unit tests prove the pieces; this proves the composition through `decideBoot` → `useState` seed → `initBattle`. Record the observed result for each row in the PR body.

---

## The share-shells surface (do not break it)

`npm run build` runs a `share-shells` vite plugin that emits **8 prerendered slug shells + a browse shell** (observed in the authoring session's build output). These are the public deep-link and share-preview surface, and they exist for every slugged item — including the 4 projects that begin locked in the play path.

Per ruling 1 the browse path is always open, so **a locked project must still have a working share shell and a working `/work/<slug>/` deep link**. No task in this plan should change slug shells, and the count must stay at 8. Add this to the PR-B verification: run `npm run build` and confirm the plugin still reports `8 slug shells + browse shell`. If that number changes, something touched `content.ts` or slug derivation, which this milestone forbids.

## Out of scope — do not do these here

- The two Imposter design calls (clone/COMMAND clip, `1/1 TARGET` copy). Separate milestone.
- Any new prose, anywhere. Ruling 2.
- Any edit to `src/content.ts`. Owner-voice surface.
- Any change to `BrowseIndex.tsx` or deep-link routing. Ruling 1.
- Adding jsdom / testing-library. D9.
- Persisting anything beyond `defeatedBosses` — no `hasDived`, no audio preference, no `BattleState`. Every other field is per-fight ephemeral.

## Critique-gate dispositions

### Dissect pass 1 (sonnet, 2026-07-29) — verdict FIX-THEN-SHIP, all findings dispositioned

| # | Finding | Disposition |
|---|---------|-------------|
| B1 | `activate()` gating unscoped; shared with `BrowseIndex` via `App.tsx:618`, so the naive implementation breaks owner ruling 1 | **FIXED** — task B3 now mandates `stateRef.current.phase === "play"`; B6 gains an explicit browse-path corpus row. Independently re-verified against `App.tsx:618`. |
| B2 | D2's cap test is unwritable: no roster seam exists, and `coerceRushPrefix` rejects over-long input before the cap runs | **FIXED** — `readProgress`/`writeProgress`/`coerceRushPrefix` take an optional `BossRoster`, defaulting to the real constants. `vi.mock` explicitly declined in favor of a real parameter. |
| B3 | B4's "previous `defeatedBosses`" is stale-closure-unreachable; `onBattleVictory` is created once on mount | **FIXED**, but **not by the mechanism the critic proposed.** The `stateRef` diff is prescribed instead. The critic's `final.events` route was **declined as unverified**: the `unlock` event exists (`engine.ts:109`) but `onVictory` fires from an Enter press on the victory overlay with `stateRef.current.state`, and the event-buffer lifetime between the killing reduce and that press was not established. Rationale recorded in B4. |
| M4 | D5 unachievable: `boot.current.battle` is truthy whenever `?phase=battle`, so param-omitted and param-empty are indistinguishable | **FIXED** — `decideBoot` now leaves `defeatedBosses` `undefined` when the raw param is absent; A5 steps 2-3 test both arms. |
| M5 | `/projects/<slug>` is not a route; real prefix is `/work/<slug>/` | **FIXED** everywhere. Independently confirmed against `router.ts:9,14`. This one would have false-passed the browse-path check. |
| M6 | Persistence turns the dive intro's hardcoded Alert Storm into a redundant rematch for returning visitors | **FIXED** via new **D11**, defaulting to routing the dive through `deriveFightChoice`. Flagged to the owner at handoff because it adjusts an M5 owner ruling for returning visitors. |
| m7 | Garbled import path `./..\/battle/rushOrder` | **FIXED** — `../battle/rushOrder`. |
| m8 | Non-lazy `useState` initializer re-reads storage every render | **FIXED** — A5 step 3 prescribes the lazy arrow form explicitly. |
| soft | B5 captures only zero and full progress (lens 118) | **FIXED** — a third partial-progress capture added. |
| meta | The HIGH gates as originally written could not observe a second-victory or browse-path failure | **ACCEPTED and FIXED** — three corpus rows added to B6 covering the browse path, two sequential victories, and the popstate bypass. |

### Dissect pass 2 (fable, non-author model, 2026-07-29) — verdict FIX-THEN-SHIP, all findings dispositioned

Pass 2 re-verified ledger rows 14 and 16 (the two unautomatable rows) directly against source: exactly two `cat.items.map` sites exist (903, 1112), and `BattleState` plus all four `BossState` variants are JSON-safe throughout. It also confirmed `RIDER_HP = 10` (`engine.ts:271`), which validates B6's "110 max HP" expectation. It attacked the HIGH classification and the framing and upheld both.

| # | Finding | Disposition |
|---|---------|-------------|
| F1 | **Locked content leaks via the detail panel and mobile row metadata.** `onMouseEnter`/arrow-keys move `subIdx` onto a locked row and `App.tsx:668-745` renders its full title/meta/stat/body/tags; the mobile row keeps meta and stat beside a masked title | **FIXED** — B2 now requires locked treatment for the detail panel and the mobile row's meta/stat; B5 adds a mandatory cursor-on-locked capture; B6 adds a corpus row. Independently verified against `App.tsx:912`. Without this the entire feature is cosmetic. |
| F2 | **Task A2's tests cannot run until A3** — `vitest.config.ts` collects only `src/battle/**`, so the TDD red step is unobservable | **FIXED** — the `test.include` edit moves into A2 as its first action; coverage thresholds stay in A3. |
| F3 | **Pass 1's B2 fix was incomplete**: D2 requires a roster param on `coerceRushPrefix`, but A1 pinned a signature without one, re-creating the unwritable test one seam over | **FIXED** — A1's signature now carries `rushOrder: readonly string[] = RUSH_ORDER`, with its own test. |
| F4 | **D11 named a value `deriveFightChoice` does not return**, left the all-four-beaten dive unspecified (degenerating into the exact forced rematch D11 exists to remove), and had zero verification | **FIXED** — new `nextUndefeatedBoss` helper exported from `fight.ts` with `deriveFightChoice` refactored to call it; explicit ruling that a completed rush skips the battle and lands in the menu world; two dive rows added to B6. The orchestrator independently found the same mechanism error before this report arrived. |
| F5 | PR-A's "behaves identically to today" preamble is false (A6 reset row, D11 dive rerouting) | **FIXED** — preamble now enumerates all three user-visible deltas and states why the intermediate auto-deployed state is coherent. |
| F6 | A stale `/projects/<slug>` survived in the share-shells section | **FIXED** — corrected to `/work/<slug>/`. |
| F7 | Ledger row 7's recheck only greps that both identifiers appear, so it passes even if `IMPLEMENTED_BOSSES` were trimmed or reordered | **FIXED** — rewritten to extract and count both array literals. Pass 2 re-verified the substance directly. |
| F8 | D5 silently changes the `?phase=battle` contract for existing captures; and A5's `resetProgress` wipe sits behind `decideBoot`'s deep-link early return, so `/work/x/?resetProgress=1` never resets | **FIXED** — placement corrected ahead of the `pageForPath` returns; new A5 step 8 requires auditing existing capture consumers. |
| F9 | A3's discrimination probe can false-fail: the three invalid-JSON cases share one branch | **FIXED** — the probe now names the `getItem` throws case, sole occupant of its branch. |
| F10 | Unlock-map slugs asserted only against a second hardcoded list, so a `content.ts` rename locks a project out silently; and new player-facing strings are unspecified on an owner-voice-sensitive site | **FIXED** for the slug cross-check (test-only `CATS` import). The **copy question is escalated to the owner at handoff** rather than decided here — see the handoff note. |
| lens 35 | `writeProgress`'s roster param has no prescribed test (inert-param risk) | **FIXED** — B1's test list now requires a non-default roster case. |

### Orchestrator-found, same session (not from the critic)

| # | Finding | Disposition |
|---|---------|-------------|
| O1 | `setPage` has six call sites; the popstate handler at `App.tsx:479` bypasses any `activate()`-only gate. Reachable in production once the A6 reset exists | **FIXED** via new **D10** — the authoritative gate moves to the `CaseStudyPage` render boundary, with a dedicated B6 corpus row. |
| O2 | Task A5 told the builder to compare landing-bundle size against a baseline the plan never stated | **FIXED** — baseline measured and recorded (234.71 kB landing chunk, gzip 72.03 kB, 66 modules). |
| O3 | The `share-shells` build plugin emits 8 slug shells; locked projects still need working share previews and deep links | **FIXED** — dedicated section added, with a build-output assertion in PR-B verification. |
| O4 | Claim-ledger recheck for row 2 reported FAIL against a true claim (`Select-String -Quiet` over a pipeline returns one boolean per file; a non-empty array is truthy) | **FIXED** — rewritten as `.Count -eq 0`. Recorded permanently as **review lens 122**, since the opposite polarity would have PASSED unconditionally forever. |

## Owner sign-off items (surfaced at handoff, none blocking)

Each has a working default so the build never stalls. A one-line ruling overrides any of them.

1. **D8 boss→project pairing.** Seed: `mia`, `backend-harness`. Then Alert Storm → `observability-by-default`, Cascade → `notification-dispatch`, Silent Failure → `the-failure-that-left-no-logs`, Imposter → `curio`.
2. **D11 dive routing.** Returning visitor with partial progress dives to their next undefeated boss instead of a forced Alert Storm rematch; a visitor who has beaten all four skips the battle and lands in the menu world. Both adjust M5's "dive lands in Alert Storm" for returning visitors only.
3. **Three new player-facing strings** — the locked-row label, the unlock toast, and the reset confirmation. These are UI chrome, not case-study prose, so hard constraint 1's interview requirement does not apply. **The punctuation rule does:** no em dashes, no en dashes, no semicolons. The builder proposes wording in the PR body; the owner may replace any of it verbatim.

## Known adjacent issue, deliberately not fixed here

`parseBoss` (`bootParams.ts:23`) whitelists against `IMPLEMENTED_BOSSES` but enforces **no prerequisite ordering**, so a dev URL `?phase=battle&boss=imposter-syndrome` with no `defeated=` launches boss 4 first, bypassing the chooser's ordering. This is dev-gated (claim 15) and therefore not player-reachable. Logged for the decision log rather than fixed, because widening it touches the capture harness's contract and belongs with the boss-ordering work, not with persistence.
