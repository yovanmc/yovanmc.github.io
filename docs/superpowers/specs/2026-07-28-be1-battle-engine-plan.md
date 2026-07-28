# M5 — battle engine + the Alert Storm fight (plan v3)

Owner-gated plan, drafted 2026-07-28 after M3 shipped, revised same day through TWO
dissect passes (pass 1: 16 findings + 10 minors; pass 2 on the folds: 7 majors +
5 minors; both folded here).
Blast-radius tier: **HIGH** — auto-deploy repo, no staging, the game path's front
door changes, first net-new logic module in the repo.

The owner pulled the battle engine forward: "Enter the game" must deliver a game.
Gameplay design is owner-locked in `2026-07-25-battle-gameplay-addendum.md`; where
that document is silent, the numbers this plan originates are tabled below for
explicit owner sign-off — they are NOT presented as addendum content.

## Owner rulings (locked before this plan)

- **Scope: engine core + the Alert Storm fight, shippable.** Bosses 2–4 land as
  follow-on PRs on the proven engine. After victory: Fan Out forged, "more coming"
  beat, land in the command-menu world.
- **The dive lands directly in battle.** Touchdown → Alert Storm descends → fight.
  Supersedes the base spec's "battle is opt-in with classic menu default" — the
  gate is the opt-in now (M3c). Menu world = post-battle landing; browse untouched.
- Standing constraints: addendum numbers verbatim where they exist;
  KH-inspired-never-KH-assets; no unlicensed audio; owner-voice prose;
  confidentiality checklist per asset.

## Roadmap reconciliation (dissect F6/m10)

`ROADMAP.md:15` pierces the freeze for the M-series only; the battle engine is
S5-era work, so the freeze nominally still binds it. **Ruling recorded:** the
owner's direct order on 2026-07-28 ("begin working on the battle engine",
immediately after choosing Engine + Alert Storm scope and dive-lands-in-battle)
IS the piercing ruling for this work — it is re-numbered **M5** to live in the
M-series the order created. The M5 PRs update `ROADMAP.md`: an M5 row; the S5 row
marked superseded-by-M5 (engine, battle-logic tests, and the canvas-vs-PixiJS
spike — cancelled, decision below); the `:62` "battle opt-in / classic menu
default" line marked superseded by the M3c gate + this plan's dive-lands-in-battle
ruling.

## Delivery — three PRs (dissect F5; M3's split pattern, applied harder)

- **PR-A — engine + test infrastructure. Zero user-visible change.**
  `src/battle/engine.ts` + vitest + full test suite + CI wiring. Nothing imports
  it yet; deploy risk ≈ 0.
- **PR-B — battle scene + assets, reachable only via a `FIGHT` command in the
  play world.** Extractions, `BattleScene.tsx`, lazy-loaded chunk, all battle UI.
  The dive still lands in the menu world; the fight is opt-in from the menu.
  Full verification battery runs here. **FIGHT placement (pass-2 G6):** a
  play-phase-only row rendered OUTSIDE `CATS` — its own element below the root
  menu with its own keyboard arm ahead of the CATS wrap. Never appended to
  `CATS`/`content.ts` (the roster is owner-locked, `BrowseIndex` renders the
  same CATS so it would leak into the portfolio view, and `activate()`
  dereferences items unguarded — an item-less category crashes on Enter).
- **PR-C — the reroute flip.** Intro handoff lands in `battle` instead of `play`.
  A deliberately tiny diff so the front-door change is independently revertible
  (~2 min exposure floor on revert, same rationale as M3's split).

## Numbers this plan originates (NOT in the addendum — owner sign-off required)

The addendum locks the kit and HP pools but is silent on all of the following
(dissect F1/F3/F4/F8 — verified silent by grep). Proposed values, tunable at the
first playtest gate:

| Decision | Proposed value |
|---|---|
| Scream cycle (turn-discrete) | Period 3: hero turns 1–2 stitched, turn 3 = scream (all mouths open, real one screams red **during the hero's targeting**), repeat |
| Critical Thinking "tells linger longer" | Scream lasts 2 consecutive hero turns while CT is active (base 1). Re-casting CT while active = refresh (timer resets, no stack) |
| Swarm damage (boss turn) | 7 per volley; −1 per 3 dead fakes (floor 4). CT's −25% taken applies |
| Reshuffle triggers | (1) Hitting a fake — addendum-locked; (2) **end of every scream turn** — plan-originated (pass-2 G2: without it, position memory from one scream solves the fight and Debug's mark is dead content; with it, unmarked position knowledge expires and the mark becomes the memory tool it was designed to be). Reshuffle = seeded **Fisher–Yates** permutation of living bats' POSITIONS; identity, HP, and marks travel with each bat |
| HP readout masking | Unmarked living bats show NO HP readout ("??") on every surface — desktop and mobile alike (pass-2 G1: nine "8 HP" and one "60 HP" would reveal the real bat for free). Marked or dead bats show real HP |
| Defeat + retry | Defeat state → retry offer; retry re-seeds `hash(seed, attemptIndex)` so the real bat's identity re-rolls (the puzzle survives) while every attempt stays deterministic and capturable (`?seed=&attempt=`) |
| Rematch (FIGHT after victory) | Allowed as a victory lap: NO stat rider, NO unlocks (`defeatedBosses` set gates both — prevents unbounded +10 HP/+2 MP inflation) |
| Boss turn order detail | One swarm volley per boss turn regardless of living count (the lab's all-ten ripple is visual) |
| Pinned micro-semantics (pass-2 n4) | Damage rounding: round half up, applied AFTER multipliers. CT's +50% does NOT multiply Debug's DoT ticks (on-cast hit only). MP regen caps at max MP. Real bat killed while fakes live = immediate victory (survivors scatter). Killing a fake counts as hitting it (reshuffles) |

**Turn-discrete ruling (dissect F1):** the lab's 2400 ms wall-clock scream reel is
presentation; the ENGINE is turn-discrete (the game is menu combat, turn order
hero→boss per the addendum). The renderer plays the mouth-flutter reel freely but
mouth-open/closed STATE comes from the engine. This keeps `battleReduce` pure.
The core loop this produces: gamble-attack blind, or stall safely with CT until
the scream turn → Debug the screamer → the mark tracks it through the scream-end
shuffle → focus fire. (There is deliberately no Wait command — the addendum's kit
has none; CT is the legal stall, which is why its re-cast rule is pinned above —
pass-2 G7.)

**Full kit table the engine encodes (addendum verbatim — dissect m9):**
Attack 0 MP, ~12 dmg, +1 MP on hit · Critical Thinking 2 MP, 3 turns, +50% dealt
/ −25% taken / extends tells · Power Through 3 MP, ~28 dmg · Debug 2 MP, 6 dmg +
4×3 DoT + persistent mark. Hero 100 HP / 10 MP, +1 MP per turn. Alert Storm: real
bat 60 HP, 9 fakes 8 HP. Victory: Fan Out forged (+first-cast events for the
starting three already-cast abilities), rider +10 max HP / +2 max MP, case-study
unlock EVENTS only (M4 wires the UI).

## Architecture

1. **`src/battle/engine.ts` — pure, deterministic, turn-discrete reducer.** NEW
   code (the labs contain no game logic — verified), TDD-first.
   `battleReduce(state, action, rng) → BattleState`; rng = injected Park–Miller
   stream (same family as `src/lib/rng.ts`); no DOM/Date/Math.random. State
   carries per-bat entities (id, position, HP, real?, marked?, alive), scream
   phase counter, buffs/DoTs with turn timers, `defeatedBosses`, event log for
   the renderer (damage numbers, forge, unlocks).
2. **Generated modules** — `tools/extract-canon.mjs` grows three anchored
   extractions (exact anchors below — dissect F12), verbatim below `@ts-nocheck`
   headers, drift-guarded by `verify:canon`:
   - `heroBattle.js` from `hero-battle.html`: trailing cut — start `const PAL`,
     end before `document.getElementById('staticRow')` (content ≈ lines 38–584).
     Exports PAL + buildFrame + effect helpers + ALL frame/MS reels (the
     Conviction/Rollback/Root-Cause reels ship inertly in the slice; only the
     starting kit is wired — corrected scope note, dissect m4).
   - `bossAlertStorm.js` from `boss-alert-storm.html`: two-anchor mid-file slice
     — start `const EROWS = 60, ECOLS = 64;`, end before **`function drawCrop`**
     (374–621), excluding the embedded hero copy. The end anchor is `drawCrop`,
     NOT `loopE` (pass-2 G3: `drawCrop`/`drawGrid` at 622–640 reference `PAL`,
     `ROWS`, `COLS` from outside the slice and would throw on call; 374–621 is
     verified self-contained with zero external identifiers and zero DOM refs).
     The renderer owns cell drawing and iterates grid dimensions itself (the
     hero lab's `drawGrid` hardcodes 60×48; boss grids are 60×64). Primary
     extracted content = per-bat PRIMITIVES (`batFinal`, `batFinalPost`,
     outline/overlay/flash/dither helpers, `screamRipple`, `SWARM` as the
     DEFAULT formation, `JIT`); the lab's monolithic `stormOf`/`STORM_*`
     all-ten reels ride along inertly in the verbatim slice (pass-2 n2 — do
     NOT carve them out) but the renderer does not play them: they cannot
     express per-bat death/marks/reshuffle (dissect F7), so the swarm grid is
     composed at runtime from primitives against engine state.
   - `battlefieldScene.js` from `battlefield.html`: two-anchor slice — start
     `const PAL`, end before `const BUILDERS` (≈ 29–223), excluding the 14 KB
     `SPR` literal and its `compose`/`composeER` consumers; the renderer owns
     actor placement. Exports scene builders + `varAS` (the Alert-Storm-corrupted
     arena) + SAFE zones + coordinate constants. (Swarm-vs-boss-zone fit:
     measured this session, 60×64 swarm grid == the stand-in boss footprint —
     closes the open item in `2026-07-27-battlefield-system.md:30`, dissect m5.)
   - **Drift guards extended (dissect F13, reshaped by pass-2 G4/n1):**
     `verify:canon` gains a PAL-equality assertion across all four sources
     (hero lab, boss lab, battlefield lab, shipped `diveTimeline.js`) — compared
     as **parsed values, deep-equal**, not text (the shipped module's PAL is
     one-line JSON-quoted; the labs are multiline literals — a text diff
     false-fails). `heroBattle.js` keeps its verbatim local `const PAL` and the
     extractor's appended footer adds `export { PAL } from "./diveTimeline.js"`
     so exactly one module owns the exported symbol; the equality guard covers
     local-vs-exported divergence. The pass-1 hero-grid drift assertion against
     the boss lab's embedded hero copy is DROPPED (pass-2 G4: the copies have
     already legitimately drifted mid-function — the boss embed predates the
     Power Through additions; a text guard exits red on day one). Instead
     BUILDING.md §9 records the boss labs' embedded hero as a frozen older
     scale-reference copy, not canon, never extracted.
3. **`BattleScene.tsx` — render layer, lazy-loaded** (`React.lazy` +
   `import()` — restores the base spec's explicit "battle code lazy-loaded"
   requirement, dissect F9; the ~50 KB of sprite code never loads for a visitor
   who only browses). Composes the swarm grid from primitives per engine state;
   plays hero/boss reels + mouth-flutter as presentation; command menu styled on
   the site's menus (blip synth passed down as props from App's `useBlips`, the
   existing `Gate` pattern — dissect m6); damage numbers, scream telegraphs,
   HP/MP bars, victory/defeat overlays. Stage scaled like the dive.
4. **Station handoff (dissect F10):** App's `<Station/>` renders in every phase
   today; in `battle` it is HIDDEN and the battle stage owns the visual. The
   dive→battle beat: settle completes → site station cross-fades out as the
   battle stage (already showing `varAS`, the corrupted arena) fades in with a
   brief static-glitch sting. The animated pure→corrupted **corruption sweep**
   stays a deferred asset per the battlefield spec — the cross-fade+sting is the
   explicit placeholder, owner-vetoable at the capture gate.

**Renderer decision (cancels the S5 canvas-vs-PixiJS spike, recorded in ROADMAP
by the PR):** DOM/canvas composition, no new dependency. The scene is one
composed pixel grid + reels, exactly the pipeline M3 shipped; PixiJS adds a dep
and a second idiom for no visible gain at this scale.

## Flow integration (dissect F2/m7/m8 — tables, not vibes)

New phase: `battle`. Path table delta (M3 table otherwise unchanged):

| Situation | Result |
|---|---|
| PR-B: play world `FIGHT` command | → battle |
| PR-C: intro handoff | → battle (was play) |
| Victory beat confirmed | → play (menu world), teaser line |
| Defeat → retry | new battle, `hash(seed, attempt+1)` |
| Defeat → leave | → gate |
| History/boot: any stored `battle` phase | never restored — `decideBoot` and popstate map it to `play` (a bfcache/Forward restore must not resurrect a dead fight — dissect m7) |
| `?phase=battle&seed=&attempt=&actions=` (dev-guarded) | boots a deterministic battle; `actions` is a comma list (e.g. `ct,ct,dbg3,pt,pt`) replayed through `battleReduce` before first render — the ONLY way headless one-shot captures can reach mid-fight states (pass-2 G5; same precedent as the intro's `?t=` freeze). `decideBoot` whitelist + parsing extended (dissect m8) |

Input table delta — **App's global keydown early-return at `App.tsx:294` gains
`battle`** (verified defect: today the fall-through would let Enter open a
case-study page over the live fight and leave Esc dead):

| Input | battle |
|---|---|
| Arrows | command menu / target selection (BattleScene-owned) |
| Enter/Space | confirm command / target |
| Esc | menu back; at menu root → pause overlay: Resume / Forfeit (forfeit → gate). Winning players exit via the victory beat |
| Click/tap | same selections, pointer path |
| Tab | native focus, never intercepted |
| Mobile command bar / sheet | hidden |

DiveIntro's window listeners are torn down at `onDone`; BattleScene mounts its
own listeners only after mount, and the ~1 s overlap window is covered by the
early-return gate (App ignores battle-phase keys entirely; BattleScene ignores
input until the descend beat completes).

## Mobile (dissect F11 — a design, not a deferral)

Width-fit puts a bat at ≈22×18 CSS px on a 375 px viewport — untappable, and
targeting IS the game. Design: on coarse pointers / <478 px, target selection is
**tap-to-cycle + confirm**: tapping the swarm cycles a large highlight cursor
bat-to-bat (readout per the HP-masking rule — "??" until marked or dead), the
confirm button commits; arrows do the same on keyboard. Direct per-bat taps are a desktop/precise-pointer affordance
only. Verification uses the M3 instrument — emulated-viewport DOM measurement
(stage rect, cursor hit-rect ≥44 px, command bar hit-rects), **no raw sub-478
headless captures** (repo-recorded constraint; the v1 "mobile screenshot" gate
contradicted it).

## Tests + tooling (dissect F15/F16)

- **vitest**, pinned to a Vite-5-compatible major (1.x targeted — version compat
  UNVERIFIED until install, as is per-file glob scoping of
  `coverage.thresholds` (pass-2 n5); PR-A task 1 verifies both). Config in a separate
  `vitest.config.ts` using `defineConfig` from `"vitest/config"`; added to
  `tsconfig.node.json`'s include so it stays type-checked; test files under
  `src/battle/*.test.ts` with explicit vitest imports (no globals — the app
  tsconfig's types stay untouched). `npm test` script; wired into check.yml and
  deploy.yml. Adding `test:` to the existing `vite.config.ts` would fail
  `tsc -b` (TS2353) — explicitly not doing that.
- **Coverage, measured and gated:** `@vitest/coverage-v8`, threshold scoped to
  the engine file only — `src/battle/engine.ts` branches ≥ 95%. (100% was
  performative: it forces deleting exhaustiveness guards. Any `/* v8 ignore */`
  is reviewed as code.) The coverage command is verification item 1, not prose.
- TDD-first suite: economy invariants; every kit number from the table above;
  buff/DoT/mark turn timers; scream cycle + CT extension; reshuffle determinism
  AND mark-tracks-bat-through-shuffle; fake-kill vs real-kill outcomes; victory
  event payload (forge, rider, unlock events); rider idempotence across rematch;
  retry reseeding (attempt 2's real-bat index differs from attempt 1's for a
  fixed seed); defeat path; swarm damage decay floor.

## Task breakdown (dissect F14 — dependency-ordered, per-PR)

PR-A: 1) vitest infra + CI (green trivially) → 2) engine types + reducer skeleton
→ 3) TDD the kit → 4) TDD Alert Storm mechanics → 5) coverage gate.
PR-B: 6) extractor: three slices + new drift guards (verify:canon green) →
7) BattleScene static composition (arena + swarm from primitives) → 8) command
menu + input tables → 9) reels/telegraphs/overlays wiring → 10) lazy-load split +
bundle check → 11) FIGHT command + phase wiring + path/input table arms +
`?phase=battle&seed=&attempt=&actions=` dev params → 12) full verification
battery.
PR-C: 13) handoff reroute + cross-fade sting → 14) reroute-focused interactive
sweep. Each task = one commit; a task's gate must pass before the next starts.

## Verification (goal-driven, in order)

1. `npm test` + coverage threshold green (PR-A onward).
2. `npm run verify:canon` green incl. PAL-equality + hero-grid drift guards;
   per-extraction parity spot-audits.
3. `npm run build` passes; bundle check (pass-2 n3 — a one-off measurement, not
   a permanent CI assertion; no baseline infra exists): measure
   `dist/assets/index-*.js` built at main vs at the PR head; growth < 5 KB
   pre-gzip proves battle code lives in the lazy chunk.
4. Screenshot beats (headless Edge 1440 desktop, pinned cheap subagent, text
   verdicts): battle open (corrupted arena + composed swarm), scream turn, marked
   bat, victory overlay, defeat overlay, pause overlay.
5. Mobile: emulated-viewport DOM measurement per the Mobile section (no sub-478
   captures).
6. Interactive gate (dev server, driven browser; state read via inline
   style/DOM + engine state hooks, not animation frames — repo-recorded preview
   constraint, dissect m2): scripted gamble-free win line, turn-by-turn (pass-2
   G7): **CT@1 → CT@2 (refresh) → Debug the screamer@3 (scream turn) → Power
   Through@4 → Power Through@5** (engine-verified: Debug@3 hits 9 under CT →
   51, PT@4 42 + tick 4 → 5, PT@5 28 kills turn 5; hero takes 20 across four
   volleys, ends at 90 after the rider — pinned as an end-to-end test in
   PR-A); scripted lose path
   (CT-stall until HP exhausts); keyboard-only full fight;
   Esc/pause/forfeit; FIGHT rematch (no double rider — assert state); browse +
   deep-link regression sweep; PR-C adds dive→battle handoff + victory→world.
7. Confidentiality 3-lens panel (pinned sonnet) — ability names/flavor text are
   a named leak surface.
8. Owner approval per PR → branch → PR → merge → live verify. Rollback: revert
   the offending PR alone (that is what the split buys).

## Out of scope (explicit)

Bosses 2–4 + Conviction; the animated corruption sweep (deferred asset,
placeholder shipped here); per-spell impact VFX beyond flash/flinch + simple
overlays (S6); case-study unlock UI + lore surfaces (M4); audio FILES and the S5
audio-toggle infrastructure (blip synth only — toggle infra lands with the first
real audio, recorded as still-owed, dissect m3); erosion finale (boss 4).

## Known risks

- The engine is the repo's first substantial NEW logic; TDD + determinism is the
  mitigation, and the reducer stays pure (turn-discrete ruling above).
- The plan-originated numbers table is untested game balance; first playtest at
  the PR-B interactive gate may re-tune it (owner sees numbers before ship).
- Boss-lab slice anchors are mid-file; the drift guard locks them after first
  extraction, but the initial slice needs the F12 line-ranges re-verified against
  the checkout at implementation time.
- Battle UI is a new design surface — wireframe-level layout gets owner eyes at
  the first PR-B screenshot gate before polish.
