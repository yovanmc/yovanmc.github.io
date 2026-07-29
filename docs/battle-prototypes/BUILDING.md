# Building the sprites and animations

The complete method behind every sprite in this directory. This is the persistence layer: with this file plus the lab HTMLs, the whole pipeline can be rebuilt from scratch. Written 2026-07-25 at the end of the design sessions that produced the hero and all four bosses.

## 1. Architecture: grid-as-data

Every sprite is a 2D array of palette letters (`null` = transparent). Rendering is one loop: `fillRect` per cell at integer scale on a canvas with `image-rendering: pixelated`. No images, no files — the grid IS the sprite, which makes every pixel diffable, dumpable, and verifiable in Node.

### Palette (shared, 38 slots)

```
A #2e1a10  B #7d4e26  C #b5793a  D #d49a5c   (skin: shadow→highlight)
E #100a10  F #241a20  G #3a2a20  H #55402e   (hair: base, grooves, accents, twist-checker)
I #4a4440  J #8a8078  K #cfc8bc  L #f0ece0   (grays: dark→white; steel, sneakers, eyes, blade)
M #0f0d18  N #1c1830  O #2e2a44  P #4a4468   (void blues: scabbard, ghosts, wisps)
Q #3f0e12  R #6b1418  S #bd2421  T #e04838   (reds: dark→glow; eyes, alerts, cracks)
U #4a3a18  V #947d42  W #c9a94f  X #e7cb6b   (golds: chain, tips, trim, cores)
Y #3a3632  Z #6e6862  a #a29a90              (warm grays: shirt, pants)
b #1c1410  c #3a2c1e  d #5a4630              (leather/belt)
e #181818                                     (auto-outline)
f #55524c  g #2a2724                          (shirt rim-light / folds)
h #c3bbae  i #948d80                          (pants highlight / shade)
j #6a3d8f  k #9d6bc4                          (corruption purples: debuff, imposter)
```

### Grids and helpers

- Hero: `ROWS=60, COLS=48, BX=8` (BX = base column shift; `px`/`post` add it). Hero occupies rows 4–56.
- Enemies: `EROWS=60, ECOLS=64` with their own `eP/eR/eCarve/eOutline/eDither` helpers (see any boss lab).
- Ops: `px(r,c,k)`, `rect`, `vline`, `hline`; hero adds offset families — `pxU` etc. add torso offset `o`, `pxH` etc. add head offset `hd` and head-jerk `hx`.

### `buildFrame(opts)` (hero)

`o` torso bob offset · `headO` head offset (defaults to `o`; larger = bow) · `headX` sideways head jerk · `xo` whole-sprite shift · `arm`: `idle | guard | grip | draw | sweep | slash | charge | cast` · `legs`: `stand | kneel` · `streak`: slash trail on/off. Draw order matters: belt and near-hand are drawn AFTER pants so the bob offset can't erase them; the chain is drawn BEFORE the torso rect (which is why its bottom X link never renders — known cosmetic).

## 2. The auto-outline pass and its ONE BIG TRAP

After painting, every opaque cell 4-adjacent to transparency becomes `e` (#181818). This gives free outlines but **eats any shape 1–2px thick that stands free**: blades, fists, wisps, hem tatters, wing cores, hanging twist tails, thin extended arms. It bit us on every single sprite.

**The fix, always:** re-post the pixels AFTER the outline pass via `post(r,c,k)` (hero) or by painting directly on the outlined grid (enemies). Rule of thumb: anything thinner than 3px in either dimension, or any detail ON a shape's top/bottom row, must be posted post-outline. Interior details (≥1 cell from every silhouette edge) survive and can be painted pre-outline. When a limb must read 2px, paint 3 rows and post a top-lit highlight row (e.g. `D` over `C`) over its own outline.

## 3. Effect helpers (composable, all pure grid→grid)

- `flashOf(grid)` — full-silhouette white flash (hit frame 0).
- `tintOf(grid, main, alt, mod)` — full-body two-tone tint via `(r+c)%mod` (buff shimmer, debuff flash).
- `overlay(grid, pts)` — stamp loose pixels in grid coords (BX already included). Used for sparkles, motes, orbs, bolts, eye swaps.
- `remapOf(grid, map)` — letter→letter palette swap. This is how Imposter Syndrome exists: the entire boss is the hero's frames through `IMPOSTER_MAP` plus eye overlays. Near-free boss.
- `glitchOf(grid, shifts, scans, noise)` — horizontal row-band displacement (gap stays transparent), solid-color scanlines, stray static pixels. 90ms glitch frames injected into an idle loop.
- `eDither(grid, r1,r2,c1,c2)` — checkerboard-to-transparent for translucency (ghost edges, dissolving tails, smoke). **Run AFTER outline** (dither-then-outline turns the whole region into outline), and re-post anything that must stay solid (eyes) after dithering.
- `eCarve` — punch transparent holes post-outline for "nothing behind this" reads (empty visor, chest rent).
- Enemy-grid battle-anim helpers (added with the boss attack/hit/death sets; copy from any boss lab): `eOverlay(grid, pts)` and `eFlashOf(grid)` — enemy-size twins of the hero versions; `eDitherAll(grid, mod)` — whole-sprite `(r+c)%mod` dissolve for death reels; `eShift(grid, dr, dc)` — translate the whole grid (knockback/jitter); `pieceShift(src, moves)` + a `PIECES` list of bounding boxes — translate rigid sub-pieces independently (armor separation, falling parts); `eMerge(base, over)` — stamp one grid onto another (non-null wins).
- **"Rotating" a rigid piece** (grids can't rotate): draw the piece's other orientation as dedicated shapes, drop the original piece via a `pieceShift` move off-grid, and `eMerge` the new orientation onto the base; the existing lift/translate frames read as the pivot tween. Silent Failure's horizontal point-and-swing (`handSword()` in its lab) is the worked example.
- `goldHairOf`-style zone-bounded remaps (Conviction, hero lab): for persistent form swaps, remap letters ONLY inside explicit zone rectangles — some letters double as other features elsewhere (`E`/`F` are hair AND eye pupils), so a global remap corrupts them. Outline cells (`e`) inside the zones need their own conversion branch, because 1–2px shapes (twists, spike tips) are ENTIRELY outline after the outline pass.

## 4. Animation patterns

- Frame arrays paired with per-frame durations; a `looper(canvasId, [[frame,ms],...])` steps with `setTimeout`.
- Idle = 2-frame bob at ~440ms. Attack = 7 frames with fast middle (90/70/80ms) and slow anticipation/recovery.
- **Desync float** (Silent Failure): main stack bobs on `om=fr`, side pieces on `os=1-fr` — pieces held together by nothing.
- **Sequential pulse** (Cascade): N frames, frame index = lit node; afterglow = previous index in `W`; the crossed link lights; wrap to head.
- **State cycles** (Alert Storm hidden→scream, Silent Failure body→fade→empty): build each state as its own frame pair, splice into one reel with tween frames (dithered body = mid-vanish).
- Boss scale rule: a boss must TOP and BOTTOM the hero's rows (hero 4–56) — measure bounding boxes, don't eyeball; a wide-but-short assembly reads "sprawling", not "looming".

## 5. Verification pipeline (the actual reason these sprites are correct)

Never trust the mind's eye on a 60×48 grid. Three layers, in order:

### 5a. Node ground truth (before any render)

Extract the page's script and eval it with a DOM stub, then dump ASCII grids and run numeric audits:

```js
const html = require('fs').readFileSync('page.html', 'utf8');
const body = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])[1];
const stub = `const anyEl=()=>new Proxy({},{get:(t,p)=>p==='getContext'?()=>new Proxy({},{get:()=>()=>{}}):(p==='style'?{}:()=>anyEl())});const document={getElementById:anyEl,body:{style:{}},createElement:anyEl};const window={addEventListener:()=>{}};const setInterval=()=>{};const setTimeout=()=>{};`;
const dump = `
function show(g,r1,r2,c1,c2,l){console.log('== '+l+' ==');for(let r=r1;r<=r2;r++){let s='';for(let c=c1;c<=c2;c++)s+=(g[r][c]===null?'.':g[r][c]);console.log(String(r).padStart(2)+' '+s);}}
show(IDLE[0], 0, 20, 16, 36, 'head');`;
eval(stub + body + dump);
```

Standard audits: per-column thickness counts (arm ≥2 skin cells), silhouette cell-diffs between variants (palette swaps must be 0), floating-pixel checks (every effect pixel needs ≥2 solid neighbors), bounding boxes, exactly-N-cells-of-color counts (e.g. "exactly one bat has red pixels").

### 5b. Numeric contrast audit (the dark-on-dark trap)

Tones within ~25–30 RGB euclidean distance of their neighbors are invisible — this recurred constantly (near-black hair tones reading as flat, `A` shading vanishing on `Y` shirt, `N` on the `#0e1630` page background at distance 14). Check pairs numerically before rendering:

```js
const rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const dist = (a,b) => Math.round(Math.hypot(...rgb(PAL[a]).map((v,i) => v - rgb(PAL[b])[i])));
// require dist >= ~35 for tone-on-tone details, >= ~40 vs the page background
```

### 5c. Headless render + marker check

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --disable-gpu `
  --window-size=1700,700 --screenshot=$out "file:///.../page.html"
for ($i=0; $i -lt 20; $i++) { if (Test-Path $out) { break }; Start-Sleep -m 500 }  # first write races
```

The page carries a green bar div at a known y (render-succeeded marker) and a `window.onerror` handler that prints a giant red JSERROR banner; the checker samples pixels for both via `System.Drawing`. For substantive/final models, an independent reviewer then judges the PNG against a written checklist (coherence, materials, scale vs hero, glitches) and must return pixel-coordinate evidence, not vibes — its numeric claims get re-verified against the Node dumps.

### 5d. Approval loop

Every animation set went through the same cycle, and it is the reason the style stayed consistent: build in a scratch copy of the lab → Node audits (5a/5b) → headless render check (5c) → present the animation to the owner → iterate on their verdict → only THEN copy into this directory and merge via PR. The owner's eye is the final gate; no set ships on numeric checks alone.

## 6. Battlefield scenes (added 2026-07-27; lab = `battlefield.html`)

The battle arena uses the same grid-as-data method at scene scale: a 256×144 grid rendered at 4x (16:9), palette letters only, sprites stamped on top (non-null wins) with both combatants' feet on the scene's ground line. The arena is the stained-glass platform (spec: `docs/superpowers/specs/2026-07-27-battlefield-system.md`).

- **Disc geometry:** top-face ellipse center (122,128), semi-axes 108×8; normalized elliptical radius `u` classifies pixels into a gold core (u<0.15) and three pane rings (boundaries 0.38 / 0.68 / 1.0) × 12 sectors. Pane tone = deterministic hash of (ring, sector) over N/O/P; cames in `V`; rim band `W` with `X` glints.
- **Seal pass (leaded-glass rule):** parametric came drawing skips shallow-tangent boundaries, so after cames are drawn, any two different glass tones from different (ring,sector) cells that touch directly get a `V` px between them. Audit: zero un-leaded boundaries.
- **Determinism:** all noise (pane stains, holes, scorch, static) uses a per-cell hash `((r*73+c*151+((r*c)>>3))%97+97)%97` — never `Math.random` — so Node audits see the exact grids the page renders.
- **Variant recipe:** build the base with options (shafts on/off, mote mode), then mutate glass through `glassMap(g, fn)`; `corruptGlass(g, rp)` remaps panes to the corruption purples outside pure-radius `rp` (zone-bounded — same principle as `goldHairOf`); `glitchScene` displaces horizontal scene bands and sprinkles static, applied BEFORE sprites are stamped so the combatants never shear.
- **Footing rule:** variants that remove glass must skip the safe column ranges under both combatants; audited.
- **Erosion:** stage t = corruptGlass at pure radius [0, .38, .68, 1.01] with glitch intensity stepping down; audits enforce strictly decreasing corruption counts and stage 3 == pure base at zero pixel diff.
- **Scene-scale audits** (extends §5a): zero null cells (a null leaks page bg); sprites fully stamped, feet exactly on the ground line; corruption purples appear ONLY in the Imposter variant; and a silhouette-legibility gate — the % of sprite boundary pixels where both the outline and the nearest interior tone are within 30 RGB of the scene behind them must not exceed the same sprite measured on the labs' own `#0e1630` background by more than 5 points (the sprites were approved on that background; the arena may not read worse).

## 7. Extending

- New hero move: add an `arm` mode branch (pre-outline geometry) + post-outline re-posts for thin parts + hilt-visibility rules (`sheathed hilt` condition lists the modes where the sword stays at the hip).
- New palette-swap enemy: `remapOf` + eye overlay + 2 glitch frames ≈ one sitting.
- New built boss: start wireframe-fidelity (3 visibly different silhouettes), pick, then detail pass (inset rims/highlights one row inside the outline, gold accents, engraving lines in `g`, corner carves for rounding).
- Backlog (from the gameplay addendum): hero ability animations ALL DONE 2026-07-25 (Power Through / Fan Out / Rollback / Root Cause / Conviction — see `hero-battle.html`); boss attack/hit/death frames ALL DONE 2026-07-25 (Alert Storm / Cascade / Silent Failure / Imposter Syndrome — see the four `boss-*.html` labs); remaining: per-spell impact VFX layered on the enemy (the enemy itself only flashes/flinches). Conviction's `goldHairOf` remap is the template for persistent form swaps; Silent Failure's `pieceShift`/`eMerge`/`handSword` pattern is the template for "rotating" rigid pieces; Imposter's battle set reuses the hero's own ATK frames through `remapOf` + `glitchOf`.

## 8. Cinematic sequences (added 2026-07-28; lab = `dive-intro.html`)

The Dive to the Heart intro extends the method to DOM/SVG cinematics: locked assets are extracted verbatim at build time (the station builder function and the hero grids are regex-pulled from their canon files, never retyped), and ALL choreography lives in a pure `computeState(t)` function in its own `<script id="pure">` block — no DOM access, no `Math.random`, no `Date` — which Node audits eval standalone. A `?t=<ms>` query param renders any exact frame statically for deterministic headless screenshots; skip and `prefers-reduced-motion` both resolve to the end state. Design spec: `docs/superpowers/specs/2026-07-28-dive-intro-design.md`.

## 9. Canon extraction into the site (added 2026-07-28; tool = `tools/extract-canon.mjs`)

The React site consumes locked lab art through generated modules, never retyped copies. `node tools/extract-canon.mjs` applies a specified, re-runnable transform (anchors + trailing-DOM-write strip + function wrap + id-suffix hook) to `station-glass.html` and emits `src/generated/stationCanon.js`, and extracts `dive-intro.html`'s whole `<script id="pure">` block into `src/generated/diveTimeline.js` (each with a hand-written `.d.ts`; the modules are `.js` under a `@ts-nocheck` header because the strict site tsconfig cannot compile lab JS — "verbatim" means verbatim below the header). `npm run verify:canon` re-runs both transforms and diffs the committed modules AND checks that `dive-intro.html`'s embedded station copy still matches the canon (3-copy drift guard). `node tools/audit-dive-parity.mjs` additionally proves the generated `computeState` byte-identical to the lab's across the full timeline. CI runs verify:canon on every PR and on the deploy path; if it fails, regenerate — never hand-edit a generated file. The render layer (`src/components/DiveIntro.tsx`) is the lab's `applyState` over React refs; its integration additions (viewport framing, the settle beat onto the site hero geometry, capture keys `?t=`/`?phase=`, the handoff fade) are M3 design, spec'd in `docs/superpowers/specs/2026-07-28-m3-split-plan.md`.

### M5 battle extractions (added 2026-07-28; plan `docs/superpowers/specs/2026-07-28-be1-battle-engine-plan.md`)

The extractor also emits three battle modules, each a two-anchor verbatim slice:

- `src/generated/heroBattle.js` from `hero-battle.html` (`const PAL` → the
  `getElementById('staticRow')` line): buildFrame + every frame/MS reel. The
  Fan Out / Rollback / Root Cause / Conviction reels ship inertly until their
  bosses wire them.
- `src/generated/bossAlertStorm.js` from `boss-alert-storm.html` (`const EROWS`
  → before `function drawCrop` — drawCrop/drawGrid reference symbols outside
  the slice and would throw): per-bat primitives (`batFinal`/`batFinalPost` +
  effect helpers + `SWARM` formation) are the renderer API; the monolithic
  `stormOf`/`STORM_*` reels ride along inertly — they cannot express per-bat
  death/marks/reshuffle, so `BattleScene` composes the swarm from primitives
  against engine state.
- `src/generated/battlefieldScene.js` from `battlefield.html` (`const PAL` →
  before `const BUILDERS`): scene builders incl. `varAS`, excluding the `SPR`
  actor literal and `compose`/`composeER` — the renderer owns actor placement
  (top-left-anchored 1:1 stamps at `BOSS_AT`/`HERO_AT`, same as the lab's
  compose).

**PAL ownership:** exactly one module exports `PAL` — `diveTimeline.js`; the
hero/battlefield/boss modules keep their verbatim local `const PAL` and
re-export diveTimeline's (or, for the alert-storm/cascade boss modules, simply
omit a `PAL` export — the renderer imports it from diveTimeline directly).
`verify:canon` asserts every lab palette stays value-identical (parsed +
deep-equal, not text — quoting/layout differ); this now covers five labs
(dive-intro, hero, boss-alert-storm, battlefield, boss-cascade).

**Frozen embed:** the boss labs' embedded hero copy (their first half) is an
older scale-reference frozen at pre-Power-Through state. It is never extracted
and carries NO drift guard on purpose — hero canon lives in `hero-battle.html`
alone.

**Free-identifier gate (standing M5 trap, now a named per-slice step):**
before trusting any new slice, grep it for identifiers not defined within the
slice itself — every hit must be a documented import (the Imposter slice's
hero-symbol prepend is the one case that needs one) or the slice's anchors
need to move. An empty result is also verified empirically: evaluating the
generated module standalone in Node must not throw (a genuine free identifier
referenced at module-eval time, e.g. inside an eagerly-computed reel constant,
throws `ReferenceError` immediately). Recorded per-slice in the PR/commit
description that lands the extraction.

### M6 boss extractions (added 2026-07-28; plan `docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md`)

- `src/generated/bossCascade.js` from `boss-cascade.html` (`const EROWS` →
  before `function drawGrid`): per-node primitives (`cascadeFinal`/
  `cascadeDark`/`cascadeOverload`/`cascadeJolt` + effect helpers + `NODES`)
  are the renderer API — `cascadeFinal(f)` alone can't express an arbitrary
  dead-node set, so `composeCascade` (PR-1b task 4) builds each frame
  per-node from these primitives against engine state. The lab's own
  `draftA`/`draftB`/`draftC` domino/wyrm reels ride along inertly, same
  precedent as the alert-storm boss slice's `OPT_A/B/C`. Free-identifier
  gate: empty — the slice references only its own `EROWS`/`ECOLS`/`NODES`/
  `PATH` and local params, confirmed by a standalone Node eval of the
  generated module (30 exports, no `ReferenceError`).
- `src/generated/bossSilentFailure.js` from `boss-silent-failure.html`
  (`const EROWS` → before `function drawGrid`, lines 372-688): monolithic
  reels are correct here (single entity, no per-entity state, unlike
  Cascade) — `silentFinal(fr, mode)` drives frame family (`SIL_BODY`/
  `SIL_FADE`/`SIL_EMPTY`) from engine phase directly, plus `SIL_ATK`/
  `SIL_HIT`/`SIL_DIE`. `buildSilAtk()` is invoked inside the slice (line
  670) after its `PIECES`/`pieceShift` dependencies — no reordering needed.
  The lab's own `draftA`/`draftB`/`draftC` hooded-specter/smoke/hollow-armor
  drafts ride along inertly, same precedent as Cascade's domino/wyrm drafts.
  Free-identifier gate: empty — measured by evaluating the raw slice in a
  bare Node `vm` context with no extra globals (no `PAL`, no hero
  `overlay`/`ROWS`/`COLS`); it ran to completion with no `ReferenceError`
  (M6 PR-2 task 2, pass-2 J10 — the pinned method for this slice, since a
  naive text grep false-positives on a comment at lab line 562 naming the
  hero's `overlay()`).
