# M12 — Battle command-menu redesign (nested submenus, Octopath-informed)

> **Written for builder-subagent execution; if something doesn't match, STOP and report rather than guess.**

**Blast radius: MEDIUM.** The milestone rewrites the battle's input surface — a new interaction state machine gates every `BattleAction` the player can emit — so "UI-only/LOW" would under-tier it. But it touches zero persisted formats (`yrpg.progress` untouched), no serialized types, no cross-process contracts, so HIGH gates (schema guard, synthetic corpus) do not apply.

## Owner rulings (2026-07-30, this planning session — binding)

1. **Menu shape:** 3-row top level `Attack / Skills▸ / Spells▸`. Skills = Critical Thinking, Power Through, Debug. Spells = Fan Out, Rollback, Root Cause, Conviction. Category labels are owner-overridable string edits later.
2. **Locked Spells (zero spells unlocked):** greyed teaser row, visible but blocked, hint text in the footer. No spell names may leak while locked.
3. **800×600 degradation:** the panel keeps its description footer and may scroll inside the panel at 800×600 ONLY, with a visible fade + chevron affordance. Every other swept viewport: no scroll at any level. (This amends the ROADMAP's "removes the scroll entirely" — owner accepted the residual at the one synthetic viewport.)

   **AMENDED 2026-07-30 (build session, owner-ruled after measurement).** The original ruling scoped the residual scroll to the **Spells level only**. Measurement at B1 item 6 refuted the plan's chrome arithmetic: after the full prescribed compaction *and* both authorized shave steps (row font 14→13, footer 10→9), the levels render at **top 162px / skills 174px / spells 193px**, so all three exceed the 148px budget at 800×600, not just Spells. The plan's "3-row levels fit ≤148" estimate was optimistic by ~14px, and long ability descriptions (Critical Thinking's is the offender) wrap the footer to a second line for a further ~12px.

   The deviation is narrower than it first reads: the largest rendered level is 193px and the smallest budget outside 800×600 is **210px** (1280×800), so **every other swept viewport remains scroll-free exactly as ruled**. Only the one already-conceded synthetic viewport changes, and only in how many of its levels show the affordance. **Owner ruling: accept scrolling at all three levels at 800×600**, gated on the fade+chevron affordance being visible; no further compaction, no content edits, no budget change. Declined alternatives: an extra compaction pass (row gap 10→4, body padding 8→4) was projected to rescue only the top level while tightening rows at every desktop viewport; shortening the long ability descriptions was declined as visible-copy churn; hiding the footer at 800×600 was never offered, since ruling 3 had already chosen "keep the footer, accept the scroll."

   Safety note (measured, not assumed): the `maxHeight` clamp means the panel can never clip a sprite regardless of description length — overflow only produces more scrolling. This ruling therefore moves no clip risk.

## Context

M7 shipped a flat `maxHeight:150` clamp on the COMMAND panel (`BattleScene.tsx:913`) — the only single lever that cleared the 12-viewport clip sweep — at the cost of showing ~2 of 8 ability rows with no visible scroll affordance. M12 replaces the flat list with nested submenus and replaces the flat 150 cap with a **measured viewport-aware cap** derived from the same pure geometry the clip invariant uses.

**Key planning-session measurement (via `layout.ts` seams — ALL FOUR bosses' fresh compositions at their real stamp origins plus the hero, the pass-1 critique's corrected actor set, re-derived in-session):** combined legal max panel height per viewport — 800×600 → **148**; 1280×800 → 210; 1024×768 → 217; 1440×900 → 245; 1920×1080 / 1600×900 / 1440×720 / 1280×620 → unbounded (no x-band collision at any height); mobile worst (360×640) → 315, others 370–492. **Alert Storm's swarm is the binding actor at 1280×800 / 1024×768 / 800×600 / 360×640 and all mobile rows** (imposter clones bind only at 1440×900); an imposter-only actor set (this plan's original draft, killed at the critique gate as a lens-#127 recurrence) overshoots by 2–4px at those viewports. Corollary: Alert Storm's union bbox overlaps TODAY'S shipped flat-150 panel by 2px at 800×600 — a latent M7-era escape (the M7 invariant only guarded clones + hero) that the 148 budget fixes. Chrome arithmetic reproduces M7's known unclamped 362px panel exactly (8×35.25px rows + ~80px chrome), so: 3-row levels fit ≤148 with mild desktop compaction; the 4-row Spells level (~176px compacted) fits every viewport except 800×600 — hence ruling 3.

**What this plan does NOT touch:** target mode UI, pause menu, FIGHT chooser (`deriveFightChoice`), the engine/reducer, `abilities.ts` data, `content.ts` prose, any generated module (canon rule), `yrpg.progress`.

## Claim ledger

All claims verified at commit `db4085a` (this planning session). Recheck commands are pwsh, exit 0 = claim holds.

| # | Claim | Verified at (commit) | Recheck (pwsh, exit 0 = holds) |
|---|-------|----------------------|--------------------------------|
| 1 | Baseline: 579 tests / 19 files green, coverage gate passing | db4085a | `if ((npx vitest run --coverage.enabled=false 2>&1 \| Out-String) -match "579 passed") { exit 0 } else { exit 1 }` |
| 2 | Full kit = 8 abilities; `ABILITY_ORDER` = attack,ct,pt,debug,fo,rb,rc,conv in `src/battle/abilities.ts` | db4085a | `if ((Get-Content "src/battle/abilities.ts" -Raw) -match 'ABILITY_ORDER' -and (Get-Content "src/battle/abilities.ts" -Raw) -match '"conv"') { exit 0 } else { exit 1 }` |
| 3 | `AbilityCommand` = `{id, label, mp, needsTarget, desc}` in `abilities.ts`; `commandsForKit(kit)` filters `ABILITY_DEFS` in fixed order | db4085a | `if ((Get-Content "src/battle/abilities.ts" -Raw) -match 'export function commandsForKit') { exit 0 } else { exit 1 }` |
| 4 | Panel JSX at `BattleScene.tsx:894-1003`: `data-cmd-panel`, `maxHeight: 150`, header/scroll-body/footer flex children, rows map `commands` with `cmdIdx` cursor | db4085a | `if ((Get-Content "src/battle/BattleScene.tsx" -Raw) -match 'data-cmd-panel' -and (Get-Content "src/battle/BattleScene.tsx" -Raw) -match 'maxHeight: 150') { exit 0 } else { exit 1 }` |
| 5 | Keyboard handler `BattleScene.tsx:599-656`: ArrowUp/Down wrap via `(i+dir+len)%len`; Enter/Space/ArrowRight confirm; Escape/Backspace → pause; MP gate before commit | db4085a | `if ((Get-Content "src/battle/BattleScene.tsx" -Raw) -match 'ArrowRight') { exit 0 } else { exit 1 }` |
| 6 | Row `onClick` guard `if (mode !== "menu" \|\| descend) return;` at `BattleScene.tsx:950` — `descend` is the dive-in flag and must survive | db4085a | `if ((Get-Content "src/battle/BattleScene.tsx" -Raw) -match 'descend\) return') { exit 0 } else { exit 1 }` |
| 7 | `layout.ts` exports `stageMetrics`, `cellRect`, `paintedBounds`, `gridRect`, `commandPanelRect(vw, containerHeight, isMobile, panelHeight)`, `rectsIntersect` (strict AABB, edge-touch clear) | db4085a | `if ((Get-Content "src/battle/layout.ts" -Raw) -match 'export function commandPanelRect') { exit 0 } else { exit 1 }` |
| 8 | Combined legal-max panel heights (see Context) computed in-session via pure seams over ALL FOUR bosses + hero; imposter-only arm independently reproduced by the pass-1 critic (exact match), Alert-Storm binding values re-derived after its BLOCKER. **Not automatable before A2 lands** — Task A2's property test re-derives and pins these; until then the derivation in Context is the only evidence, and a builder finding different numbers must STOP rather than edit the pins | db4085a | — |
| 18 | Non-imposter scenes have no `stampOrigin` override — `BattleScene.tsx:292` falls back to the bare `BOSS_AT` constant; `sceneFor` registry at `scenes/index.ts:13-21` defaults to `alertStormScene` | db4085a | `if ((Get-Content "src/battle/BattleScene.tsx" -Raw) -match 'stampOrigin\?\.' -and (Get-Content "src/battle/scenes/index.ts" -Raw) -match 'SCENE_MODULES') { exit 0 } else { exit 1 }` |
| 19 | All four spawn functions exist: `spawnAlertStorm(rng, draw)` / `spawnImposter(rng, draw)` return `{boss, rng}`; `spawnCascade()` / `spawnSilentFailure()` return the boss directly | db4085a | `if ((Get-Content "src/battle/bosses/alertStorm.ts" -Raw) -match 'export function spawnAlertStorm' -and (Get-Content "src/battle/bosses/cascade.ts" -Raw) -match 'export function spawnCascade') { exit 0 } else { exit 1 }` |
| 9 | `measuredLayout.ts` is GENERATED by `tools/measure-battle-layout.mjs` (`npm run measure:layout`); rows carry `vw, vh, isMobile, containerHeight, panelHeight, canvasRect` | db4085a | `if ((Get-Content "src/battle/__fixtures__/measuredLayout.ts" -Raw) -match 'GENERATED by tools/measure-battle-layout.mjs') { exit 0 } else { exit 1 }` |
| 10 | Clip invariant `layout.test.ts:159-227`: `it.each(MEASURED_LAYOUT)` × {leftmost clone, hero}; derives via `imposterScene.stampOrigin!/composeBoss`, `IDLE[0]` at `HERO_AT` | db4085a | `if ((Get-Content "src/battle/layout.test.ts" -Raw) -match 'M7 clip invariant') { exit 0 } else { exit 1 }` |
| 11 | `vitest.config.ts`: `test.include` = `src/battle/**/*.test.ts` + `src/progress/**/*.test.ts`; coverage include = same dirs `**/*.ts`, 95% branch thresholds; `.tsx` matches neither | db4085a | `if ((Get-Content "vitest.config.ts" -Raw) -match 'src/battle/\*\*/\*\.test\.ts') { exit 0 } else { exit 1 }` |
| 12 | `actions=` replay grammar is ability-ID-based (`parseActions`, `bootParams.ts:72-87`), never menu-positional — nesting cannot break replay | db4085a | `if ((Get-Content "src/battle/bootParams.ts" -Raw) -match 'export function parseActions') { exit 0 } else { exit 1 }` |
| 13 | `defeated=` boot param validates via `coerceRushPrefix`; the full rush prefix is valid, so the 8-ability kit is URL-reachable for captures (no localStorage seeding needed) | db4085a | `if ((Get-Content "src/battle/bootParams.ts" -Raw) -match 'coerceRushPrefix') { exit 0 } else { exit 1 }` |
| 14 | `spawnImposter` exported from `bosses/imposter.ts`; `imposterScene.stampOrigin`/`composeBoss` exported from `scenes/imposter.ts`; `HERO_AT` from `src/generated/battlefieldScene`, `IDLE` from `src/generated/heroBattle` | db4085a | `if ((Get-Content "src/battle/bosses/imposter.ts" -Raw) -match 'export function spawnImposter' -and (Get-Content "src/battle/scenes/imposter.ts" -Raw) -match 'stampOrigin') { exit 0 } else { exit 1 }` |
| 15 | Mode union `ComposeGateMode` (`sceneGate.ts:27`) = menu/target/anim/pause/victory/defeat; menu cursor is `useState` (`cmdIdx`, `BattleScene.tsx:171`), NOT engine state | db4085a | `if ((Get-Content "src/battle/sceneGate.ts" -Raw) -match 'ComposeGateMode') { exit 0 } else { exit 1 }` |
| 16 | Punctuation gate exists at `src/battle/scenes/punctuation.test.ts` (covers scene-module copy); menu strings are NOT yet covered by it | db4085a | `if (Test-Path "src/battle/scenes/punctuation.test.ts") { exit 0 } else { exit 1 }` |
| 17 | Measurement rig (`tools/measure-battle-layout.mjs`) drives CDP over headless Edge, boots `?phase=battle&boss=imposter-syndrome&defeated=alert-storm,cascade,silent-failure`, regenerates fixture; kill discipline is PID-by-profile, never by image name | db4085a | `if ((Get-Content "tools/measure-battle-layout.mjs" -Raw) -match 'killEdgeByProfile') { exit 0 } else { exit 1 }` |

**Fixture-seam confirmation:** every test prescribed below drives either pure new modules (no fixtures) or seams confirmed in ledger #10/#14 (`spawnImposter` + `identityDraw` + `{phase:"clones"}` override, `imposterScene.composeBoss/stampOrigin`, `IDLE[0]`/`HERO_AT`, `MEASURED_LAYOUT`). No new fixture knobs are required except the fixture columns Task B2 adds to the generated file itself.

---

## PR-A — pure menu model + geometry budget (branch `feat/m12-menu-model`)

No visual change ships in PR-A; the new modules are exercised only by tests until PR-B wires them in. Both new files live under `src/battle/**/*.ts` → automatically inside the 95% branch gate. TDD per task: red test first, then implement.

### Task A1 — `src/battle/commandMenu.ts` + `commandMenu.test.ts`

New pure module. No React, no DOM, dependencies injected — tests run under the node environment.

```ts
// src/battle/commandMenu.ts
import type { AbilityCommand } from "./abilities";

export type MenuLevelId = "top" | "skills" | "spells";
export type MenuInput = "up" | "down" | "confirm" | "back";

export interface CategoryRow {
  kind: "category";
  id: "skills" | "spells";
  label: string;
  desc: string;
  locked: boolean;
}
export interface AbilityRow { kind: "ability"; cmd: AbilityCommand }
export type MenuRow = CategoryRow | AbilityRow;

export interface MenuView {
  level: MenuLevelId;
  /** Breadcrumb title for submenus ("SKILLS" / "SPELLS"); null at top. */
  title: string | null;
  rows: MenuRow[];
}

export interface MenuState {
  level: MenuLevelId;
  cursor: Record<MenuLevelId, number>;
}
export const initialMenuState: MenuState = { level: "top", cursor: { top: 0, skills: 0, spells: 0 } };

export type MenuEffect =
  | { type: "moved" }                      // cursor changed → playMove
  | { type: "descend" }                    // entered a submenu → playEnter
  | { type: "ascend" }                     // submenu → top → playBack
  | { type: "pause" }                      // back at top level → open pause, playBack
  | { type: "blocked" }                    // locked category or unaffordable ability → playBack
  | { type: "cast"; cmd: AbilityCommand }; // caller handles needsTarget/commit

export function deriveMenuView(commands: AbilityCommand[], level: MenuLevelId): MenuView;
export function menuReduce(
  menu: MenuState,
  input: MenuInput,
  commands: AbilityCommand[],
  mp: number,
): { menu: MenuState; effect: MenuEffect };
```

Rules the implementation must satisfy (each is a test):

1. **Partition:** `SKILLS_IDS = ["ct","pt","debug"]`, `SPELLS_IDS = ["fo","rb","rc","conv"]` as module constants. `deriveMenuView(commands, "top")` = `[AbilityRow(attack), CategoryRow(skills), CategoryRow(spells)]` — always exactly 3 rows. Skills submenu lists the kit's skills in `commands` order; Spells submenu lists the kit's unlocked spells in `commands` order. `attack` is always present (BASE_KIT).
2. **Locked teaser (owner ruling 2):** when `commands` contains zero SPELLS_IDS entries, the top-level Spells row has `locked: true` and `desc` = the locked hint string. `confirm` on it → `{effect: blocked}`, state unchanged. When ≥1 spell is unlocked, `locked: false` and confirm descends. The Skills category is never locked.
3. **Navigation:** `up`/`down` move the current level's cursor with wrap (`(i+dir+len)%len`, same idiom as today) → `{effect: moved}`; a 1-row level wraps onto itself (still `moved`). `confirm` on a category → `level` switches, `{effect: descend}`. `confirm` on an ability: `mp >= cmd.mp` → `{effect: cast, cmd}` (state unchanged — the caller drives mode); else `{effect: blocked}`. `back` in a submenu → `level: "top"`, `{effect: ascend}`. `back` at top → `{effect: pause}`, state unchanged.
4. **Cursor memory:** each level keeps its own cursor; descending, ascending, and casting never reset any cursor. (Fresh battle mount = `initialMenuState`; kit is fixed for the duration of a battle, so cursors cannot go out of range mid-battle — assert cursor < rows.length after every transition anyway.)
5. **Row cap guard (M8 tripwire):** for every kit derivable from the 5 valid rush prefixes (`[]`, and the 1..4-length prefixes of `RUSH_ORDER` fed through `deriveKit` → `commandsForKit`), every level's `deriveMenuView(...).rows.length <= 4`. This test is the loud failure M8 hits when a 5th spell lands, forcing the pagination decision then instead of silently reintroducing scroll.
6. **Strings (owner-overridable defaults; owner punctuation rule — NO em dashes, NO en dashes, NO semicolons):**
   - skills: label `Skills`, desc `Core moves. Always ready.`
   - spells unlocked: label `Spells`, desc `Spells won from fallen bosses.`
   - spells locked: label `Spells`, desc `Sealed until a boss falls.`
   - submenu titles: `SKILLS`, `SPELLS`
   Add a punctuation test over every string constant in `commandMenu.ts` following the assertion pattern in `src/battle/scenes/punctuation.test.ts` (read it first; put the new cases in `commandMenu.test.ts`, do not widen the scenes test's imports).

Commit: `feat(m12): pure command-menu model with nested levels + guards`.

### Task A2 — `panelMaxHeight` in `layout.ts` + `src/battle/panelBudget.ts` + tests

**`layout.ts` addition** (pure, no new imports — actors are inputs):

```ts
/** Max panel height (CSS px) that cannot intersect any actor rect, capped at
 * MENU_PANEL_CEILING. Analytic inverse of the clip invariant: for each actor
 * whose x-band overlaps the panel's x-band, the panel top must stay at or
 * below the actor's bottom edge (rectsIntersect is strict, so touching is
 * legal). */
export const MENU_PANEL_CEILING = 320;
export function panelMaxHeight(
  vw: number,
  containerHeight: number,
  isMobile: boolean,
  actors: Rect[],
): number {
  const probe = commandPanelRect(vw, containerHeight, isMobile, 1);
  const bottomOffset = containerHeight - (probe.top + probe.height);
  let max = MENU_PANEL_CEILING;
  for (const a of actors) {
    const xOverlap = a.left < probe.left + probe.width && probe.left < a.left + a.width;
    if (!xOverlap) continue;
    max = Math.min(max, containerHeight - bottomOffset - (a.top + a.height));
  }
  return Math.max(0, max);
}
```

**`src/battle/panelBudget.ts`** — the worst-case actor set across **all four bosses** plus the hero (the pass-1 critique gate killed an imposter-only draft as a lens-#127 actor-scope recurrence — Alert Storm's swarm is the binding actor at most tight viewports, see Context). Fresh spawns per boss at their real stamp origins (`stampOrigin` override only exists on imposter; everything else stamps at `BOSS_AT`, ledger #18), imposter forced to its CLONES phase (its own worst case, same idiom as `layout.test.ts:189-192` — duplicated because prod cannot import a test file):

```ts
import { gridRect, panelMaxHeight, stageMetrics, type Rect } from "./layout";
import { IDLE } from "../generated/heroBattle";
import { HERO_AT, BOSS_AT } from "../generated/battlefieldScene";
import { spawnImposter, type ImposterBoss } from "./bosses/imposter";
import { spawnAlertStorm } from "./bosses/alertStorm";
import { spawnCascade } from "./bosses/cascade";
import { spawnSilentFailure } from "./bosses/silentFailure";
import { sceneFor } from "./scenes/index";
import type { BossState } from "./engine";

const identityDraw = (r: number) => r;
// Fresh-spawn compositions are the per-boss worst cases: full occupancy
// (bats/clones die, bboxes only shrink), and formation slots are structural,
// not seed-driven (seed picks hidden identities, not positions) — the same
// determinism the clip invariant already relies on. The A2 property test
// re-derives all of this; if a future boss breaks the assumption the test
// goes red, not the player's screen.
const imposterClones: ImposterBoss = { ...spawnImposter(0, identityDraw).boss, phase: "clones" };
const WORST_BOSSES: BossState[] = [
  spawnAlertStorm(0, identityDraw).boss,
  spawnCascade(),
  spawnSilentFailure(),
  imposterClones,
] as BossState[];

export function menuPanelMaxHeight(vw: number, vh: number, containerHeight: number, isMobile: boolean): number {
  const m = stageMetrics(vw, vh, isMobile);
  const actors: Rect[] = [gridRect(m, HERO_AT[0], HERO_AT[1], IDLE[0])].filter((r): r is Rect => r !== null);
  for (const boss of WORST_BOSSES) {
    const scene = sceneFor(boss.kind);
    const grid = scene.composeBoss(boss, false, 0, {});
    const [r0, c0] = scene.stampOrigin?.(boss) ?? BOSS_AT;
    const rect = gridRect(m, r0, c0, grid);
    if (rect) actors.push(rect);
  }
  return panelMaxHeight(vw, containerHeight, isMobile, actors);
}
```

(If the exact `BossState` casts don't line up with the real union types, STOP and report — do not loosen types to force it.)

**Decision (record in ROADMAP at ship time):** one budget per viewport, boss- and phase-independent, computed from the strictest actor set — every boss's fresh composition plus imposter's CLONES phase plus the hero. Costs only 2–4px vs an imposter-only set at the tight viewports, buys: the panel never changes height mid-fight or between fights (no jank, single fixture dimension), and it retires the latent 2px Alert-Storm/panel overlap M7 shipped at 800×600.

**Tests (`panelBudget.test.ts` + `layout.test.ts` additions):**
1. Property, per `MEASURED_LAYOUT` row × per boss (`it.each` over the cartesian set): `commandPanelRect(vw, containerHeight, isMobile, menuPanelMaxHeight(...))` intersects NEITHER that boss's fresh composed rect NOR the hero rect (recompute each via the same public seams, independently of `panelBudget`'s internals); and when `menuPanelMaxHeight(...) < MENU_PANEL_CEILING`, the same rect at `height + 1` DOES intersect at least one actor from the full set (the cap is tight, not merely safe).
2. Value pins (planning-session derivation, pass-1-critique-corrected, tolerance ±1): 800×600 → 148; 1280×800 → 210; 1024×768 → 217; 1440×900 → 245; 360×640 → 315; 1920×1080 → 320 (ceiling).
3. `panelMaxHeight` unit cases: actor clear of the x-band is ignored; empty actor list → ceiling; result never negative.

Commit: `feat(m12): measured viewport-aware panel height budget`.

**PR-A finish:** `npx tsc -b` clean (bare `tsc --noEmit` is a no-op in this repo), `npm test` green with coverage gate (expect ~579 + new tests), `npm run verify:canon` untouched-but-run. Push branch → PR → CI → merge per Conventions.

---

## PR-B — BattleScene integration + measurement + verification (branch `feat/m12-menu-ui`, after PR-A merges)

### Task B1 — wire the model into `BattleScene.tsx`

`BattleScene.tsx` is outside the test globs (ledger #11) — this task is gated by `tsc -b` + the B2 measurement + B3 judges, not unit tests. Keep the change surgical; the panel block is `:894-1003`, keyboard `:599-656`, cursor state `:171`.

1. Replace `const [cmdIdx, setCmdIdx] = useState(0)` with `const [menu, setMenu] = useState(initialMenuState)`; derive `const view = useMemo(() => deriveMenuView(commands, menu.level), [commands, menu.level])`. A single helper applies `menuReduce` results: set state, map effect → sound (`moved`→`playMove`, `descend`→`playEnter`, `ascend`/`pause`/`blocked`→`playBack`) and behavior (`pause` → `mode="pause"`; `cast` → existing MP-checked path is now inside the model, so just `cmd.needsTarget ? startTarget() : commit({type: cmd.id} as BattleAction)` — keep a reference to the pending `cmd` for target mode exactly where `cmdIdx` lookup happens today, `:629-633`).
2. **Keyboard mapping** (menu mode only; target/pause/anim handling unchanged): ArrowUp/Down → `up`/`down`; Enter/Space/ArrowRight → `confirm`; ArrowLeft → `back` ONLY when `menu.level !== "top"` (no-op at top — never an accidental pause); Escape/Backspace → `back` (which yields `pause` at top, matching today's Escape behavior).
3. **Rendering:** rows come from `view.rows`. Category rows: `▸` cursor glyph as today, label, NO MP tag, chevron `▸` at the right edge instead; locked spells row uses the existing unafford styling (`#5f5576`, `cursor:"default"`). Footer desc: ability row → `cmd.desc`; category row → `row.desc`. Header: at top, unchanged (`COMMAND` / `TURN n`); in a submenu the left span becomes `◂ SKILLS` / `◂ SPELLS` (from `view.title`) and is clickable/tappable → `back` (this is the mobile back affordance; keep `TURN n` on the right). Add `data-cmd-level={menu.level}` next to `data-cmd-panel` for the B2 rig.
4. **Tap/hover:** row `onClick` = confirm on that row (set cursor first, then `menuReduce` confirm — preserve the `if (mode !== "menu" || descend) return;` guard, ledger #6); `onMouseEnter` sets the current level's cursor only.
5. **Height cap:** replace `maxHeight: 150` with `maxHeight: Math.round(menuPanelMaxHeight(vw, vh, containerHeight, isMobile))` memoized on those inputs. `containerHeight` is whatever the panel's container measures today — the M7 fixture showed `containerHeight === vh` at every viewport, so pass `vh` if no measured container value is in scope (B2's rig verifies the equality still holds and the fixture records it).
6. **Desktop chrome compaction** (targets, iterate against B2's measurements — DESKTOP ARM ONLY, mobile keeps today's roomier tap targets since its budget floor is 315): row padding `10px 12px` → `6px 12px`; header padding `11px 14px` → `7px 14px`; footer padding `7px 12px 3px` → `5px 12px 3px`, `marginTop 4` → `2`. Goal: 3-row levels ≤148px rendered; Spells level ≤210px. If the 3-row level misses 148 after these, shave in this order and STOP if still missing (report, don't improvise): row font 14→13, footer font 10→9.
7. **Scroll affordance (owner ruling 3):** when the body's `scrollHeight > clientHeight`, render a bottom fade (absolutely-positioned gradient inside the panel) and a `▾` glyph at the body's bottom edge. Keep `activeRowRef` + `scrollIntoView({block:"nearest"})` keyed on the current level's cursor.

Commit as THREE internal commits so a B2/B3 regression is attributable (pass-1 critique MINOR): (1) `feat(m12): wire menu model into BattleScene` (items 1–4), (2) `feat(m12): measured height cap + desktop chrome compaction` (items 5–6), (3) `feat(m12): scroll affordance` (item 7).

### Task B2 — extend the measurement rig + regenerate the fixture + fit tests

Extend `tools/measure-battle-layout.mjs` (keep the existing CDP client, dev-server bootstrap, and PID-by-profile kill discipline — ledger #17):

1. Boot URL gains the full rush so all 8 abilities exist: `defeated=alert-storm,cascade,silent-failure,imposter-syndrome` (valid full prefix, ledger #13), `boss=imposter-syndrome`.
2. Per viewport, measure ALL THREE levels: after load, measure top; then drive the menu with `Input.dispatchKeyEvent` (rawKeyDown+keyUp for ArrowDown/Enter/Escape) — descend into Skills (cursor to row 1 → Enter), measure, Escape; descend into Spells (cursor to row 2 → Enter), measure. Read per-level `{panelHeight, bodyScrollHeight, bodyClientHeight}` plus `data-cmd-level` to confirm which level is actually showing (fail loudly on mismatch — a silent wrong-level measurement is the rig's failure mode).

   **Measure every cursor position within each level and record the MAX (found at the B1 item 6 gate, 2026-07-30).** The footer renders the *active* row's description, and long descriptions wrap to a second line (~12px), so **panel height is cursor-dependent** — measuring only the landing cursor reports a best case and would let the scroll-acceptance test pass against a height the player never sees. This is not academic: the largest measured level (spells, 193px) sits only 17px under the 1280×800 budget of 210, and a single wrapped description consumes ~12 of those. Walk ArrowDown through every row of each level, take the max per level, and record that as the level's `panelHeight`. If the max at any non-800×600 viewport exceeds that viewport's budget, STOP and report — that is a real regression of ruling 3's second half, not a fixture-update chore.
3. Fixture: `MeasuredLayoutRow` gains `levels: { top: LevelMeasure; skills: LevelMeasure; spells: LevelMeasure }` where `LevelMeasure = { panelHeight: number; scrollable: boolean }`; the existing `panelHeight` column becomes `max` over the three levels (the clip invariant consumes the worst case unchanged). Regenerate fixture + `measured.json`.
4. New tests in `layout.test.ts` (all `it.each(MEASURED_LAYOUT)`):
   - `row.panelHeight <= menuPanelMaxHeight(row.vw, row.vh, row.containerHeight, row.isMobile) + 0.5` (rendered cap honored; ±0.5 for the known 1/64-px browser snap).
   - **Scroll acceptance (per ruling 3 AS AMENDED):** the set of `(viewport, level)` pairs with `scrollable === true` is EXACTLY `{(800×600, top), (800×600, skills), (800×600, spells)}` — every 800×600 level scrolls, and **nothing at any other viewport scrolls at any level**. Both halves are load-bearing: the second half is the one that would catch a compaction regression leaking scroll onto a real viewport, so do not weaken it to a one-directional check.
   - The existing clone/hero clip invariants re-run against the regenerated fixture unchanged and pass.
   - **Per-boss clip invariant** (lens-#127 institutionalized): a new `it.each` family over `MEASURED_LAYOUT × {alertStorm fresh, cascade fresh, silentFailure fresh, imposter clones}` asserting the fixture's `panelHeight` never intersects that boss's fresh composed rect at its real stamp origin (`stampOrigin?.() ?? BOSS_AT`) — the same derivation `panelBudget.ts` uses, recomputed independently in the test.

Commit: `feat(m12): per-level layout measurement + scroll acceptance gate`.

### Task B3 — visual + interactive verification (no code changes; builder report artifact)

All captures go through `pwsh -NoProfile -File ~\.claude\skills\roadmap\helpers\Test-CaptureSane.ps1 <paths>` BEFORE any judge dispatch; a FAIL means fix the capture, not judge it. Judges are pinned subagents returning text verdicts — never load PNGs into the orchestrator.

1. **Visual sweep** (rig already writes per-viewport PNGs; add per-level captures in B2's loop): judge top/skills/spells at 1440×900, 800×600, 390×844 minimum, plus the LOCKED teaser state (`boss=alert-storm`, no `defeated=` param) at 1440×900 + 390×844, plus **Alert Storm at the four swarm-binding viewports** — 800×600, 1024×768, 1280×800, 360×640 — with the menu open (pass-1 critique BLOCKER follow-through: the pure invariant proves the union bbox is clear, the capture proves no VISIBLE bat is occluded — the M7 corollary that a union bbox cannot say which sprite is under the overlay cuts both ways). Verdict checklist: 3 rows at top; breadcrumb `◂ SPELLS` present in submenu; teaser row visibly muted with locked hint in footer and NO spell names anywhere; fade+chevron visible at 800×600 spells and NOWHERE else; no sprite of ANY actor (hero, clones, bats) clipped by the panel.
2. **Interactive gate** (per the standing interactive-test rule — screenshots+units are blind to nav bugs): scripted CDP session driving a real keyboard walk — descend Spells → cast Fan Out (untargeted, MP available) → event fires (banner changes) → menu returns at spells level with cursor retained; Escape from Spells → top; **ArrowLeft from Skills → top** (the new binding, exercised end-to-end, pass-1 critique MINOR); Escape at top → pause overlay; ArrowLeft at top does NOTHING; locked teaser confirm does not descend. Mobile emulated metrics (390×844): tap Skills row → submenu; tap breadcrumb → top. Screenshot each step, sanity-check, judge as a sequence.
3. Confirm replay unaffected: run the M4 victory rig `?phase=battle&seed=42&actions=pt:1,pt:1,attack:1` and confirm it still wins (replay bypasses the menu entirely, ledger #12).

Deliverable: builder report with the measured per-level table, judge verdicts verbatim, and capture paths.

**PR-B finish:** `npx tsc -b`, `npm test`, `npm run verify:canon`, `npm run build` all green → push → PR → CI → merge per Conventions. No Self-Apps deploy target (Pages deploys from main).

---

## Acceptance criteria (milestone-level)

1. Every ability reachable in ≤2 confirms from the top level; all 8 visible across the two submenus at full kit.
2. No scroll at any swept viewport/level EXCEPT at 800×600, where all three levels may scroll and each shows a visible affordance (ruling 3 as amended; fixture-proved by B2's scroll-acceptance test, measured at worst-case cursor position per level).
3. Clip invariants green across the regenerated fixture — hero + ALL FOUR bosses' fresh compositions (12 viewports each), not just imposter clones.
4. Locked-Spells teaser leaks no spell names (visual judge + the model's own derive test).
5. Keyboard parity: everything reachable by keys alone; Escape semantics unchanged at top level. Replay rig unaffected.
6. Suite green with coverage gate; new modules ≥95% branch.

## Critique gate — pass 1 findings and dispositions (2026-07-30, verdict FIX-THEN-SHIP → resolved)

| Severity | Finding | Disposition |
|---|---|---|
| BLOCKER | `panelBudget`'s imposter-only actor set clips Alert Storm's swarm at 4 of 12 viewports (empirically reproduced by the critic); rig/visual sweep were structurally blind to it — lens-#127 recurrence | **FIXED**: actor set now spans all four bosses + hero (Task A2); combined budgets re-derived in-session (148/210/217/245/315, table in Context); per-boss property test + per-boss clip invariant added (A2/B2); Alert-Storm captures at the four binding viewports added (B3.1). Bonus: retires M7's latent 2px swarm/panel overlap at 800×600. |
| MAJOR | "Boss-independent" asserted as settled fact with no builder instruction to re-check | **FIXED**: the claim is now derived from the full actor set, pinned in ledger #8 (+#18/#19 seam claims), and independently re-verified by A2's property test rather than trusted from plan text. |
| MINOR | Task B1 bundles 7 concerns into one commit on an un-unit-testable `.tsx` | **FIXED**: B1 now lands as three attributable commits. |
| MINOR | ArrowLeft-back-from-submenu (new binding) never exercised end-to-end | **FIXED**: added to B3.2's keyboard walk. |

No finding was declined; no new review lens is owed (the BLOCKER is a recurrence of existing lens #127, which is how the critic caught it).

## Out of scope / declined here

- Pagination or category-splitting for future spell growth — the A1 row-cap guard makes M8 decide this when it actually happens.
- Semi-transparent panel (owner's secondary candidate) — direction stays nesting; not revisited without an owner ruling.
- Per-phase dynamic panel heights (taller panel when clones are gone) — declined for jank + fixture-matrix cost; recorded in A2's decision.
- Any engine/reducer change; any `abilities.ts` reordering (`abilities.test.ts` pins it).
