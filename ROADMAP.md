# Portfolio RPG (yovanmc.github.io) — ROADMAP

> Source of truth for what to build next. Follows the `/roadmap` workflow
> (top-tier session plans/researches · pinned cheap subagents implement · ping at every phase handoff).

**Legend:** ✅ Merged · 📝 Plan ready (execute next) · 🔬 Researching/Planning · [ ] Not started (plan first)

## North Star (2026-07-07) — read NORTHSTAR.md before planning

**Vision one-liner:** the finished site is the full RPG spectacle — including the S5–S6 battle where spells = case studies — with S7 (true 3D dive) staying a permanent maybe; once the job lands, the site converts from candidacy tool to professional presence + ongoing playground.

**Locked amendments (owner-locked 2026-07-07, see NORTHSTAR.md for full rationale):**
- **Resume-PDF conflict RULED:** resume stays OFF the site. The 2026-07-02 audit's "top gap" finding is overruled. Do not re-propose (see resolved item below).
- **S3 is post-vacation and DESIGN-FIRST:** a heavy design phase — several visibly different visual directions — happens BEFORE any screenshots or asset production. Placeholders stay until a direction is picked.
- **Freeze after S3** until the career C1 OA gate passes (tracked in `C:\Agent Zone\_career\ROADMAP.md`). Repo pins + display name nags are phone-work, exempt from the freeze. **Owner ruling 2026-07-28: the M-series (battle-prototype milestone backlog, `docs/superpowers/specs/2026-07-25-milestones-backlog.md`) PIERCES this freeze** — M3 (game/portfolio separation + dive-intro integration) was owner-ordered and ships live; the freeze row below binds the S-series only.

**Path phases:** S3 design-first → S3b meta case study → S4 Curio publication track → **FREEZE** → S5 battle engine (data-driven second renderer over `content.ts`) → S6 assets via the render+critique loop (no sprite VFX) → post-hire conversion (candidacy copy → presence copy; S7 stays a permanent maybe). The **M-series** (owner backlog 2026-07-25) runs in parallel and is tracked in the table below since M3, its first `src/`-touching milestone.

## Definition

Kingdom-Hearts-style RPG command-menu portfolio, LIVE at https://yovanmc.github.io. **The site's job = differentiator/conversation piece** (owner decision 2026-07-02) — repos + resume carry the evidence. End state adds a content-woven turn-based battle (spells = the case studies). Repo: github.com/yovanmc/yovanmc.github.io (this clone: `C:\Agent Projects\portfolio-rpg`) · Spec: `docs/superpowers/specs/2026-07-02-spectacle-and-battle-design.md` (**READ IT FIRST — owner-voice + confidentiality constraints are hard**).

## Conventions

- Vite + React + TS; `npm ci` · `npm run build` (tsc + vite) · no test suite yet (S5 plan should add one for battle logic).
- Branch → PR → merge (`gh pr merge --merge --delete-branch`); commit as `yovanmc <yovanmc@users.noreply.github.com>`; Pages deploys from main via `.github/workflows/deploy.yml`.
- Verify UI via headless-Edge capture (desktop 1440) judged by a pinned subagent returning a text verdict — never load PNGs into the orchestrator. **Mobile (<~478px) captures CANNOT use raw `msedge --headless --window-size`** — see gotcha below; verify mobile via emulated-viewport DOM measurement (Claude-Preview `preview_resize` + `preview_eval`) instead.
- **Owner-voice rule:** never rewrite prose in `content.ts`; new prose only via owner interview (spec constraint 1). **Confidentiality:** every asset passes the private checklist (spec constraint 2).
- The old Astro clone at `C:\Agent Projects\yovanmc.github.io` is ORPHANED scratch (unrelated git root) — never push from it; the approved Station render lives inside it at `design_handoff_portfolio\station-loop\station-PASS-v2.html`.

## Milestones (history table — shipped-milestone detail lives in linked plan docs)

| # | Title | Status | Plan | PR | Notes |
|---|-------|--------|------|----|----|
| S1a | Visual & copy fixes (Station on, 390px fix, stale comments, CI skew) | ✅ Merged | [plan](docs/superpowers/plans/2026-07-02-S1a-visual-copy-fixes.md) | #4 | Station hero ON; mobile tab minWidth/ellipsis; content.ts+README docs fixed; CI Node 24→22 |
| S1b | Routing + share previews + a11y (path deep links, per-slug static og shells, focus/roles) | ✅ Merged | [plan](docs/superpowers/plans/2026-07-02-S1b-routing-shells-a11y.md) | #6 | 10 og shells + share card + 404 bounce; pushState/popstate deep links; dialog a11y + focus restore |
| S2 | Roster & content (remove 4 superseded entries; add Curio + ASU; revise Software Engineer; punctuation sweep) | ✅ Merged | [plan](docs/superpowers/plans/2026-07-03-S2-roster-content.md) | #9 | Roster now 6+1; Curio (no repo link until S4) + ASU added; SE 3-field revision; punctuation sweep; owner approved full content.ts diff 2026-07-03 |
| S3 | Visuals (real UI shots Curio; public-altitude diagrams; kill placeholder banners) | [ ] Not started | — | — | **Post-vacation, DESIGN-FIRST** (see North Star above): several visibly different diagram/shot directions before any asset production; per-asset confidentiality gate |
| S4 | Curio publication readiness (full-history sweep → publish or mirror; then repo link + archive 4 predecessor repos) | [ ] Not started | — | — | Independent; gates ONLY the Curio link; dissect-verdict SHIP required before any push |
| S3b | Meta entry: "Building this site" case study (interview-drafted, post-S3) | [ ] Not started | — | — | Owner decision A+C: site proudly owns the AI-built process; roster 7+1 |
| — | **FREEZE — career C1 OA gate** | — | — | — | Site work stops here until `C:\Agent Zone\_career\ROADMAP.md` C1 OA gate passes. Phone-work nags (repo pins, display name) exempt. |
| M1–M2 | Battlefield system + Dive to the Heart design (labs + specs, no `src/` changes) | ✅ Merged | [backlog](docs/superpowers/specs/2026-07-25-milestones-backlog.md) | #12–#14 | Design milestones; canon labs in `docs/battle-prototypes/` |
| M3a | Station canon swap (site hero renders the locked v1 canon; extraction tooling + `verify:canon` CI) | ✅ Merged | [plan](docs/superpowers/specs/2026-07-28-m3-split-plan.md) | #15 | PR-A of M3; og-station.png regenerated |
| M3b | Game/portfolio separation + intro integration (phase machine intro→gate→play\|browse, `/browse` path, path-preserving 404) | ✅ Merged | [plan](docs/superpowers/specs/2026-07-28-m3-split-plan.md) | #16 | **Supersedes S5's "v1 faked dive" line** (owner 2026-07-28) — the dive ships here |
| M3c | Intro moved behind the play button (entry = gate; cinematic on first play-entry per load; hero appears post-dive) | 📝 This PR | [plan §M3c](docs/superpowers/specs/2026-07-28-m3-split-plan.md) | — | Owner ruling 2026-07-28 post-M3b, supersedes M2's intro-every-visit |
| S5 | Battle engine, placeholder art (turn-based state machine, procedural VFX, spell↔case-study unlocks, audio-toggle infra, lazy-loaded) | [ ] Not started | — | — | Post-C1-gate (career ROADMAP); data-driven second renderer over `content.ts` — spells = case studies; plan includes canvas-vs-PixiJS spike + battle-logic tests. ~~v1 faked dive~~ shipped in M3b (owner 2026-07-28) |
| S6 | Battle assets (AI-gen tier C first → owner Aseprite B or commission A; VFX stays procedural) | [ ] Not started | — | — | Sprite brief: stylized avatar (real skin/hair/height, rest unique). Produce via the render+critique loop; sprite VFX stays declined. Verify commission pricing before A |
| S7 | True 3D "dive to the heart" (v2, Three.js/WebGL) | [ ] Not started | — | — | Permanent maybe — never planned unless owner-initiated; v1 faked dive ships in S5; motion non-negotiables bind |

Detailed prose for shipped milestones (S1a/S1b/S2 rationale, review notes) has moved to `docs/roadmap-archive-2026-07.md`. Per-milestone implementation detail always lives in the linked plan docs above.

## Decision log & gotchas

### Open / planned & declined
- **Sequencing:** S1a+S1b+S2 ✅ → S3 next, post-vacation, design-first (then site FREEZES until the career C1 OA gate passes — see `C:\Agent Zone\_career\ROADMAP.md`); S4 anytime; S5/S6 post-gate in bounded chunks.
- **RESOLVED 2026-07-07 — resume PDF conflict:** owner-ruled, resume stays off the site. The 2026-07-02 audit's "top gap" finding is explicitly overruled and closed. Do not re-propose.
- **Declined (don't re-propose):** resume PDF on site (see resolved item above) · Reserve/PlotArmor and one other pulled entry · SSR migration (OG tags chosen instead) · sprite-based VFX (procedural only) — rationale in spec §Out of scope · **Compass roster entry** (owner 2026-07-03; roster is now 6+1, can be revisited post-S3 only if owner raises it) · **Dynatrace softening/citation** (owner 2026-07-03: the guild is private so no public citation exists, and he declined both softening candidates — the "invited" claim stays verbatim in all 3 spots; never re-propose).

### Durable constraints & lineage
- Owner voice + confidentiality constraints: spec §Hard constraints — they bind every future milestone including S5/S6 (spell names/slugs are leak surfaces).
- Site job = differentiator (owner, 2026-07-02); skimmer bounce accepted; share-preview/contact/no-placeholder floor is non-negotiable.
- Roster locked at **6 + 1 meta entry** (owner 2026-07-03 superseding spec §Roster's 7+1: Compass declined); battle = content-woven navigation (spells are the work), enemy = "the Silent Failure", battle is opt-in with classic menu default.
- **Owner punctuation rule (HARD, 2026-07-03):** owner prose site-wide uses NO em dashes, NO en dashes, NO semicolons. S2 swept the existing violations (content.ts owner prose clean as of PR #9; the file-header code comment keeps its em dash, it is not owner prose); every future prose asset must pass this before it reaches him. Full voice profile lives in agent memory (`writing_voice_profile.md`), grill-calibrated 2026-07-03.
- **Art direction is BINDING (spec §Art direction, owner style grill 2026-07-02):** stained-glass-first wow arc with staged dive (v1 fake → v2 3D) · proudly-AI-built messaging (A+C) · opt-in audio from the safe-licensing menu only (never unlicensed commercial music) · KH-inspired-never-KH-assets · stylized-avatar sprite brief · motion non-negotiables (skippable, ~~repeat-skip~~, reduced-motion, mobile-light). **repeat-skip superseded** by the M2 owner ruling 2026-07-28: the full intro plays every root visit (skip always available, deep links bypass entirely) — see `docs/superpowers/specs/2026-07-28-dive-intro-design.md`.
- Confidentiality: every asset passes the standing private checklist (kept outside this repo); §4.4 citation rules for named UWM products; private backups stay in `_portfolio-private`.

### Cross-cutting lessons & gotchas
- 2026-07-02 full review (source + live-render agents): single state machine no router (Back exits site) · mobile 390px Contact clip · OG-less SPA previews blank · placeholder banners on every case-study page · confidentiality sweep CLEAN incl. dist bundle. Detail in memory `project_portfolio_rpg_redesign.md`.
- WebFetch can't render this SPA (title-only) — always verify via headless-Edge capture, never text-fetch.
- **Puppeteer-preview tab freezes CSS transitions (found S1b, 2026-07-02):** the Claude-Preview emulated tab produces no frames — `preview_screenshot` times out and transition-driven styles (e.g. the case-study overlay fade) stay stuck at their START value in `getComputedStyle`. Verify open/closed state via INLINE style + DOM state (`el.style.opacity`, aria attributes, `location.pathname`), and take visual captures with headless Edge (desktop widths) instead.
- **Bare `npx tsc --noEmit` is a NO-OP in this repo (found S2 planning, 2026-07-03):** the root tsconfig is solution-style (`"files": []` + references), so `tsc --noEmit` type-checks nothing and exits 0 even on broken code (empirically verified with an injected type error). Verify with `npx tsc -b` or `npm run build`.
- **Headless-Edge min-width clamp (found S1a, 2026-07-02):** on this machine `msedge --headless --screenshot --window-size=390,844` lays the page out at ~478px wide (window min-width clamp; height honored; `--force-device-scale-factor=1` and `--headless=new` don't help) and crops the PNG to 390 — producing a FALSE "right-edge clip" on any sub-478 capture. Empirically verified: 600px request renders true-600; emulated 390 viewport shows the bar fits exactly (Contact tab x 261–376, untruncated). The S1 review's original "mobile 390 Contact clip" was likely this artifact; the S1a `minWidth:0`+ellipsis fix is kept as harmless defensive CSS.
