# portfolio-rpg

Yovan's portfolio, built as an interactive RPG command-menu single-page app. A short
letter and a start menu on the landing page, real links into a flat browsable index and
the engineering page, and a game that leads into a boss-rush unlocking case studies, so
the same content works for someone skimming links and for someone willing to play.
Original design, no copyrighted game assets.

- **Stack:** Vite 5 + React 18 + TypeScript (plain inline styles + one CSS token file).
  Pinned to Vite 5 / React 18 because the local toolchain runs **Node 20.13** (Vite 7+
  requires Node 20.19+). CI (`.github/workflows/deploy.yml`) runs Node 22.
- **Fonts:** Google Fonts, Marcellus (display), Sora (UI/body), JetBrains Mono (labels).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b and vite build, output in dist (not checked into git)
npm run preview  # serve the production build
```

## Architecture, in six lines

- `src/App.tsx` is the site's phase machine: `gate` (the `Landing` entry, the letter and its start menu),
  `intro` (the dive cinematic), `play` (the RPG command menu), `browse` (the flat index),
  `build` (the engineering page, numbers computed at build time), `battle` (a boss
  fight). `src/router.ts` maps phases and pages to real URLs.
- The battle engine lives entirely under `src/battle/`: `src/battle/engine.ts` is a
  deterministic reducer (`initBattle` plus `battleReduce`, same state in gives the same
  state out for the same action), and `src/battle/bootParams.ts` parses and validates the
  dev capture-key URL params that can boot straight into a fight.
- Progression persists through `src/progress/store.ts`, one versioned key
  (`yrpg.progress`) in `localStorage`, every read and write wrapped so a privacy mode
  or a quota error can never throw.
- `src/figures/` renders the case-study diagrams from data (never as shipped image
  files) so they reflow at every viewport width.
- `vite.config.ts` builds the static share shells at build time, one `index.html`
  variant per project/experience slug plus `/work/` and `/build/`, each with its own
  title, description and Open Graph tags, so a crawler or a chat unfurl sees real
  per-page metadata even though the app is a single page at runtime. The same plugin
  writes a sitemap and a robots.txt from the identical URL list (`src/site/shellPaths.ts`),
  so the three outputs can never drift apart from each other.
- `/build/` is the engineering page: a numbers strip (test count, branch coverage and
  more) computed fresh at build time by `tools/build-facts.ts` from the test run and
  git, never typed by hand, plus a figure showing how a screenshot of this site becomes
  a passing or failing test.
- The station's stained-glass SVG, the dive cinematic's timeline and the battle
  scenes are all extracted verbatim from a standalone HTML source by
  `tools/extract-canon.mjs` into `src/generated/`. That source is kept out of the
  repo. `npm run verify:canon` re-extracts and diffs against it, so a hand-edit to a
  generated file or a drifted source fails loudly instead of silently.

## How it's tested

`npm test` runs the full suite (`vitest run --coverage`, node environment, no jsdom).
Coverage floors are enforced at 95% branches on `src/battle/`, `src/progress/`, and
`src/figures/` (`vitest.config.ts`), so those three surfaces cannot regress silently.
`npm run verify:canon` is a separate gate, run locally before a change to the generated
files is committed: it fails the moment a generated file in `src/generated/` no longer
matches its extraction source. CI (`.github/workflows/deploy.yml`) runs `test`, then
`build`, before every deploy.

## Status

Live at https://yovanmc.github.io (GitHub Pages, deploys from main via
`.github/workflows/deploy.yml`). All site copy lives in `src/content.ts`.
