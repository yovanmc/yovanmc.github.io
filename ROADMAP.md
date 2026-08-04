# Portfolio RPG (yovanmc.github.io) — ROADMAP

> Source of truth for what to build next. Follows the `/roadmap` workflow
> (top-tier session plans/researches · pinned cheap subagents implement · ping at every phase handoff).

**Legend:** ✅ Merged · ⏸ Blocked on owner ruling (partly shipped) · 📝 Plan ready (execute next) · 🔬 Researching/Planning · [ ] Not started (plan first)

## North Star (2026-07-07) — read NORTHSTAR.md before planning

**Vision one-liner:** the finished site is the full RPG spectacle — including the S5–S6 battle where spells = case studies — with S7 (true 3D dive) staying a permanent maybe; once the job lands, the site converts from candidacy tool to professional presence + ongoing playground.

**Locked amendments (owner-locked 2026-07-07, see NORTHSTAR.md for full rationale):**
- **Resume-PDF conflict RULED:** resume stays OFF the site. The 2026-07-02 audit's "top gap" finding is overruled. Do not re-propose (see resolved item below).
- **S3 is post-vacation and DESIGN-FIRST:** a heavy design phase — several visibly different visual directions — happens BEFORE any screenshots or asset production. Placeholders stay until a direction is picked.
- **FREEZE REMOVED — owner ruling 2026-07-30. There is no site freeze.** The gate on site work pending the career C1 OA pass is deleted outright; supersedes the 2026-07-07 "freeze after S3" amendment. **Replaced by a priority ordering: the S-series outranks the M-series.** An M row runs only when no S row is ready or the owner names one. Full rationale in `docs/LESSONS.md`.

**Path phases (no freeze):** S3 design-first → S3b meta case study → S4 Curio publication track → S5 battle engine → S6 assets (render+critique loop, no sprite VFX) → post-hire conversion (candidacy → presence copy; S7 permanent maybe). **M-series** (owner backlog 2026-07-25), tracked below since M3, runs **subordinate to the S-series**; M-numbers diverged from backlog phase numbers after phase 4 — read the "(backlog phase N)" tag.

## Definition

Kingdom-Hearts-style RPG command-menu portfolio, LIVE at https://yovanmc.github.io. **Site's job = differentiator/conversation piece** (owner decision 2026-07-02) — repos + resume carry the evidence. End state adds a content-woven turn-based battle (spells = case studies). Spec: `docs/superpowers/specs/2026-07-02-spectacle-and-battle-design.md` (**READ FIRST — owner-voice + confidentiality constraints are hard**).

## Conventions

- Vite + React + TS; `npm ci` · `npm run build` (tsc + vite) · `npm test` = vitest + v8 coverage (added in M5 PR-A; battle engine gated at ≥95% branch, config in `vitest.config.ts` — kept OUT of `vite.config.ts`, a `test:` key there fails `tsc -b`).
- Branch → PR → merge (`gh pr merge --merge --delete-branch`); commit as `yovanmc <yovanmc@users.noreply.github.com>`; Pages deploys from main via `.github/workflows/deploy.yml`.
- Verify UI via headless-Edge capture (desktop 1440) judged by a pinned subagent returning a text verdict — never load PNGs into the orchestrator. **Mobile (<~478px) captures CANNOT use raw `msedge --headless --window-size`** — see `docs/LESSONS.md` (`headless-edge` keyword); verify mobile via emulated-viewport DOM measurement (Claude-Preview `preview_resize` + `preview_eval`) instead.
- **Owner-voice rule:** never rewrite prose in `content.ts`; new prose only via owner interview (spec constraint 1). **Confidentiality:** every asset passes the private checklist (spec constraint 2).
- The old Astro clone at `C:\Agent Projects\yovanmc.github.io` is ORPHANED scratch (unrelated git root) — never push from it; the approved Station render lives inside it at `design_handoff_portfolio\station-loop\station-PASS-v2.html`.
- **Lessons: `docs/LESSONS.md`** holds shipped-milestone retros and gotchas, pull-based — grep its `### [keyword]` headings for your milestone's surface before planning.

## Milestones (history table — shipped-milestone detail lives in linked plan docs)

> **NEXT UP: S4 (Curio publication readiness) — 📝 plan ready, execute it.** Planned and critique-gated 2026-07-31. S3 PR-A merged the same day (#46); S3's remaining two PRs and S3b wait on owner desk time, so S4 ran ahead. **Not a run-to-completion build:** it sweeps, then STOPS at gate G1 for five owner rulings, only then publishes. Read the plan's G1 section first.
>
> **No freeze** (see North Star above). **S-series outranks M-series**: site polish is priority, battle yields to it; an M row runs only when no S row is ready or the owner names one. Read **top-down among S rows first** — not strictly "topmost non-✅", since M rows interleave by history. Always take the milestone named on this line.
>
> All four remaining M rows stay blocked on their own terms: **M8** on an owner ruling lifting the 6+1 roster cap (not pending content — S3b's meta entry is the M-series' single existing unblock); **M9** on the roster M8 would produce; **M10** on an owner interview (hard constraint 1 forbids agent-drafted lore prose); **M11** on a complete game to ship-gate.

| # | Title | Status | Plan | PR | Notes |
|---|-------|--------|------|----|----|
| S3 | Visuals (real UI shots Curio; public-altitude diagrams; kill placeholder banners) | ⏸ PR-A ✅ merged | [plan](docs/superpowers/specs/2026-07-30-s3-case-study-visuals-plan.md) | #46 | **PR-A SHIPPED 2026-07-31.** `src/figures/` (layout+registry), 841 tests, 100% branches, PUBLISH-CLEAR. **Blocked on owner:** PR-B needs Curio captures, PR-C needs per-emblem approval. Detail in `docs/LESSONS.md` |
| S4 | Curio publication readiness (full-history sweep → publish-shape ruling; then repo link + archive the 4 predecessor repos) | 📝 Plan ready | [plan](docs/superpowers/specs/2026-07-31-s4-curio-publication-plan.md) | — | **HIGH.** Full history viable, 1776 commits noreply-authored. **STOPS at gate G1 for 5 owner rulings** (see decision log). Findings in a private companion, never in this repo |
| S3b | Meta entry: "Building this site" case study (interview-drafted, post-S3) | [ ] Not started | — | — | Owner decision A+C: site owns the AI-built process; roster 7+1 |
| M4 | Lore: game-path unlock UI + localStorage progression persistence | ✅ Merged | [plan](docs/superpowers/specs/2026-07-29-m4-lore-unlock-plan.md) | #31 #32 | **Shipped.** Versioned `yrpg.progress` envelope + D11 dive routing + player reset (PR-A); game-path gating over 4/6 projects (PR-B). 526 tests, browse path untouched. Two sign-off items open (see decision log) |
| M7 | Imposter polish: clone/COMMAND clip + `1/1 TARGET` copy | ✅ Merged | [plan](docs/superpowers/specs/2026-07-29-m7-imposter-polish-plan.md) | #35 #38 | Two PRs: phase-aware footer seam, and panel clamped to `maxHeight:150` with a covered `layout.ts` clip invariant over 12 viewports. 579 tests. Detail in `docs/LESSONS.md` |
| M12 | Battle command-menu redesign (nested submenus, Octopath-informed) | ✅ Merged | [plan](docs/superpowers/specs/2026-07-30-m12-command-menu-plan.md) | #41 #42 | **Shipped.** Nested Attack/Skills▸/Spells▸ over a measured viewport budget, replacing M7's flat 150 clamp; locked-Spells teaser leaks no names. 805 tests. Detail (panel budget, ruling amendment) in `docs/LESSONS.md` |
| M8 | Bosses for every work section (backlog phase 5) | [ ] Not started | — | — | Palette-swap/remap recipes in `BUILDING.md` make bosses cheap. **Blocked on lifting the 6+1 roster cap, not pending content** — S3b is the only sanctioned addition (see decision log) |
| M9 | Rebalancing the full boss rush (backlog phase 6) | [ ] Not started | — | — | Tune end to end once all content is in. Store/XP-based upgrades are the candidate lever. Depends on final roster |
| M10 | Dialogue, in-battle and story (backlog phase 7) | [ ] Not started | — | — | Written last, covers final cast/lore. Owner-voice constraint 1: bespoke prose needs an owner interview, not agent drafting |
| M11 | Productionize (backlog phase 8) | [ ] Not started | — | — | Distinct review→critique→ship gate over the complete game. Confidentiality checklist re-run before final publish |
| S5 | ~~Battle engine, placeholder art~~ **Superseded by M5** (2026-07-28): engine/tests/lazy-loading land in M5; canvas-vs-PixiJS spike CANCELLED (rationale in M5 plan). Still owed: audio-toggle infra, with first real audio | — | [M5 plan](docs/superpowers/specs/2026-07-28-be1-battle-engine-plan.md) | — | ~~v1 faked dive~~ shipped in M3b |
| S6 | Battle assets (AI-gen tier C first → owner Aseprite B or commission A; VFX stays procedural) | [ ] Not started | — | — | Sprite brief: stylized avatar (real skin/hair/height, rest unique). Via render+critique loop; sprite VFX declined. Verify commission pricing before A |
| S7 | True 3D "dive to the heart" (v2, Three.js/WebGL) | [ ] Not started | — | — | Permanent maybe — never planned unless owner-initiated; v1 faked dive ships in S5 |

Detailed prose for shipped milestones (S1a/S1b/S2, M1–M2) moved to `docs/roadmap-archive-2026-07.md`, joined by **M6** under the keep-the-last-3-shipped rule (lessons extracted to `docs/LESSONS.md` first). Per-milestone detail lives in the linked plan docs above.

## Decision log & gotchas

### Open / planned & declined
- **S4 PLANNED + double-gated 2026-07-31.** Recon: 1776 commits (5 refs), noreply-only, zero landmine hits, no binary/DB/secret/media ever committed. **Recommends A′ (full history + targeted scrub), not the mirror.** Residual: finding E-1, a personal contact address in 5 files as an API `User-Agent` (fix: that API accepts a project URL). **5 rulings owed at G1:** E-1's disposition, publish shape, CI, `content.ts:143` contradiction, whether Curio's 3 root docs publish. Curio baseline: **2824 tests**.
- **S3 PR-A shipped (#46, 2026-07-31); retro moved to `docs/LESSONS.md`.** Two owner calls remain open: the `fix` tone's log rule is only subtly distinct from `default` (same hue, `.4` vs `.24` alpha) — renderer is faithful to the locked tone table, so changing it is a design call, not a bug; and the Curio page ends thin with no closing CTA, which PR-B's screenshots fill.
- **Owner voice pass shipped (#49, 2026-08-02); retro moved to `docs/LESSONS.md`.** Still open, an owner one-liner: the wording of the Experience category blurb is unruled (default: no change; concern recorded outside this repo). Not yet reviewed: contact blurbs, category blurbs, notification-dispatch, the-failure.
- **S3 is HIGH blast radius (raised from MEDIUM at pass-1); any milestone adding net-new publish-once strings to the public site inherits this classification** — node labels, log channels, filenames. Rests on irreversibility not data risk: the July 2026 purge means a leak here is deleting/recreating the GitHub repo and losing every PR discussion, not "reverted in review."
- **M8's blocker is the roster cap, not pending content.** Roster LOCKED at 6+1 (2026-07-03) — needs an owner ruling lifting it, or S3b (the "+1", the only sanctioned addition). `content.ts` holds 6 projects + `software-engineer` + `arizona-state-university` against a 4-entry `RUSH_ORDER`: 4 sections have no boss, not a free slice — `mia`+`backend-harness` are M4's ungated seed, experience/education never gateable (M4 gating rulings).
- **M7 shipped (#35 #38, 2026-07-30); retro moved to `docs/LESSONS.md`.** One owner-overridable default remains: the footer shows **`0/3 TARGET`** on a CLONES-phase killing blow; changing it to `0/1` is a one-line edit in `scenes/imposter.test.ts`.
- **M4 sign-off items open (defaults shipped/live; a one-line ruling replaces any):** (a) boss→project pairing — `mia`+`backend-harness` seed; Alert Storm→`observability-by-default`, Cascade→`notification-dispatch`, Silent Failure→`the-failure-that-left-no-logs`, Imposter→`curio`; (b) 4 strings — "Locked", "Beat a boss to unlock this project.", "This project stays sealed until you defeat the boss guarding it.", "Unlocked: <title>", reset "Progress reset. Back to the start."
- **M4 gating rulings (2026-07-29), SHIPPED and binding:** gating is **game-path only** — browse path, `BrowseIndex`, `/work/<slug>/` deep links show all 11 items to every visitor, always. Contact/experience never gateable; only the 6 projects are. Unlock machinery ships over prose already approved in `content.ts`; bespoke lore prose is a separate milestone needing owner desk time.
- **Sequencing (revised 2026-07-31, no freeze):** S1a+S1b+S2 ✅ → **S3 PR-A ✅ → S4 → S3b, then S3 PR-B/PR-C when owner desk time allows**. S4 moved ahead: its owner input is *rulings on evidence gathered first* (minutes, phone); PR-B needs desk captures, PR-C needs six per-emblem approvals, S3b needs a full interview. S5/S6 are lowest priority, behind every ready S row.
- **RESOLVED 2026-07-07 — resume PDF conflict:** owner-ruled, resume stays off the site. The 2026-07-02 audit's "top gap" finding is explicitly overruled and closed. Do not re-propose.
- **Declined (don't re-propose):** resume PDF (see resolved item above) · Reserve/PlotArmor + one other pulled entry · SSR migration (OG tags chosen) · sprite-based VFX (procedural only) · **Compass roster entry** (2026-07-03; roster is 6+1) · **Dynatrace softening/citation** (2026-07-03: guild is private, no public citation exists; "invited" claim stays verbatim).

### Durable constraints & lineage
- Owner voice + confidentiality constraints: spec §Hard constraints — they bind every future milestone including S5/S6 (spell names/slugs are leak surfaces).
- Site job = differentiator (owner, 2026-07-02); skimmer bounce accepted; share-preview/contact/no-placeholder floor is non-negotiable.
- Roster locked at **6 + 1 meta entry** (owner 2026-07-03, superseding spec §Roster's 7+1: Compass declined); battle = content-woven navigation (spells are the work); enemy roster = four-boss rush per the 2026-07-25 addendum ("the Silent Failure" is boss 3). Battle gate is opt-in (M3c); the dive lands directly in battle; the menu world is the post-battle landing.
- **Owner punctuation rule (HARD, 2026-07-03):** owner prose site-wide uses NO em dashes, NO en dashes, NO semicolons; every future prose asset must pass this before it reaches him. Full voice profile in agent memory (`writing_voice_profile.md`).
- **Art direction is BINDING (spec §Art direction, 2026-07-02):** stained-glass-first wow arc, staged dive (v1 fake → v2 3D) · proudly-AI-built messaging (A+C) · opt-in audio, safe-licensing menu only (never unlicensed music) · KH-inspired-never-KH-assets · stylized-avatar sprite brief · motion non-negotiables: skippable, reduced-motion (ambient-only; dive cinematic always plays), mobile-light — repeat-skip retired.
- Confidentiality: every asset passes the standing private checklist (kept outside this repo); §4.4 citation rules for named UWM products; private backups stay in `_portfolio-private`.

Canon extraction, the `yrpg.progress` schema guard, the figure-system measured constants, and the CI
Node-22 pin have all moved to `docs/LESSONS.md` (2026-08-03 hygiene pass) — grep there for
`canon-extraction`, `schema-guard`, `figures`, or `ci`.
