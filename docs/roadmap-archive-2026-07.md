# Roadmap archive — shipped milestone detail (2026-07)

Pointer file. `ROADMAP.md` keeps a compact history table (one row per shipped milestone);
this file preserves the fuller shipped-milestone notes that predated the 2026-07-07
North Star prune, for anyone digging into why a past PR did what it did. Full
step-by-step detail always lives in the linked plan docs under
`docs/superpowers/plans/`; this file is the middle layer between the one-line
table and the full plan.

## M5 — Battle engine + the Alert Storm fight (PRs #19 #20 #21, merged)

Plan: `docs/superpowers/specs/2026-07-28-be1-battle-engine-plan.md`

Owner-ordered 2026-07-28; pierced the post-S3 freeze and superseded S5's
placeholder-engine scope entirely. Three PRs: **A** a pure TDD'd turn-discrete
reducer plus the vitest suite every later battle milestone is gated on (≥95%
branch coverage, config kept in `vitest.config.ts` — a `test:` key in
`vite.config.ts` fails `tsc -b`); **B** the lazy-loaded battle scene composed from
the M1–M2 lab primitives, behind a FIGHT command; **C** the dive rerouted to land
in the fight. The renderer decision recorded there — DOM/canvas composition on the
M3 extraction pipeline rather than a canvas-vs-PixiJS spike — still binds, and that
spike stays cancelled. Archived from the main table 2026-07-30 during the M7
hygiene pass; the coverage gate, the `defeatedBosses` progression surface, and the
canon extraction pipeline all survive as durable constraints in `ROADMAP.md`.

## M1–M2 — Battlefield system + Dive to the Heart design (PRs #12–#14, merged)

Backlog: `docs/superpowers/specs/2026-07-25-milestones-backlog.md`

Design-only milestones, no `src/` changes. Produced the canon prototype labs in
`docs/battle-prototypes/` (standalone HTML, each carrying its own embedded hero
half plus a boss half) and the battlefield/corruption-variant specs. Those labs
became the single source of truth that `tools/extract-canon.mjs` carves verbatim
slices out of from M3a onward, so every later boss's art enters the app through
that pipeline rather than by hand transcription. Archived from the main table
2026-07-29 during the PR #25 hygiene pass; the pipeline itself is recorded as a
durable constraint in `ROADMAP.md`.

## S1a — Visual & copy fixes (PR #4, merged)

Plan: `docs/superpowers/plans/2026-07-02-S1a-visual-copy-fixes.md`

Station hero turned ON; mobile tab `minWidth:0` + ellipsis fix; stale `content.ts`
and README doc comments corrected; CI Node version skew fixed (24 → 22).

## S1b — Routing + share previews + a11y (PR #6, merged)

Plan: `docs/superpowers/plans/2026-07-02-S1b-routing-shells-a11y.md`

10 static OG shells (one per case-study slug) + a share card + 404 bounce page;
`pushState`/`popstate`-based path deep links so case studies are directly linkable;
dialog accessibility (focus trap + restore, ARIA roles) added to the case-study
overlay.

Note: the root `og:description` meta tag was orchestrator-authored (not owner
prose) — flagged in the PR #6 description as something the owner may still want
to veto/rewrite. Carried forward here in case it resurfaces.

## S2 — Roster & content (PR #9, merged)

Plan: `docs/superpowers/plans/2026-07-03-S2-roster-content.md`

Removed 4 superseded roster entries; added Curio (repo link withheld until S4
publication gate clears) and ASU; revised the Software Engineer entry (3-field
rewrite); site-wide punctuation sweep to the owner's no-em-dash/no-en-dash/
no-semicolon rule — including one em dash on content.ts line 90 that the
original plan missed (owner approved a colon mid-run as the fix once found).
OG shell count dropped 10 → 8 as part of the roster trim. Owner approved the
full `content.ts` diff on 2026-07-03 before merge.

---

For anything not covered above (art direction, confidentiality rules, declined
items, cross-cutting gotchas), see the Decision log & gotchas section in
`ROADMAP.md` directly — those are living/current, not archival, and were not moved.

## M3a — Station canon swap (PR #15, merged)

PR-A of the M3 split. The site hero renders the locked v1 Station canon; added the
extraction tooling (`tools/extract-canon.mjs`) and the `verify:canon` CI step that
byte-compares committed generated modules against a fresh extraction. `og-station.png`
regenerated. This is the pipeline every later boss extraction depends on.

## M3c — Intro moved behind the play button (PRs #17, #18, merged)

Entry became the gate; the cinematic plays on the first play-entry per page load and
the hero appears post-dive. Owner ruling 2026-07-28 taken right after M3b, superseding
M2's intro-every-visit behavior. PR #18 carried the reduced-motion exemption (the reduce
flag governs unsolicited/ambient motion only — the opt-in dive cinematic plays regardless,
skip one keypress away), which is recorded as a living constraint on the Art direction
line in `ROADMAP.md`. Archived from the main table in the M4 hygiene pass (2026-07-29)
once M4 shipped and the table exceeded the last-3-shipped cap.

## M3b — Game/portfolio separation + intro integration (PR #16, merged)

Phase machine intro -> gate -> play | browse, the `/browse` path, and a path-preserving
404. Superseded S5's "v1 faked dive" line by the owner's 2026-07-28 ruling: the dive
ships here. Archived from the main ROADMAP table in the M6 PR-3 hygiene pass
(2026-07-29) once M6 shipped and the table exceeded the last-3-shipped cap.

## M6 — Bosses 2-4: Cascade, Silent Failure, Imposter Syndrome (PRs #22 #23 #25 #28, merged)

Plan: `docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md`

Completed the four-boss rush, which is live. PR-3 shipped the Imposter finale, the Root Cause
and Conviction abilities, HP-linked erosion, and mobile chooser tap-dismiss. 472 tests at ship.

Archived from `ROADMAP.md`'s history table in the M12 hygiene pass (2026-07-30) under the
keep-the-last-3-shipped rule. Nothing here is load-bearing for future work: M6's two open owner
design calls (the clone/COMMAND panel overlap and the `1/1 TARGET` footer copy) were both ruled
into **M7** and shipped there, and all four of M6's durable engineering lessons already live in
`ROADMAP.md`'s "Cross-cutting lessons & gotchas" section rather than here — a green suite being
blind to animation-window and layout defects, a fastest-line derivation that is arithmetically
right but illegal to play, a `/* v8 ignore */` annotation swallowing a real uncovered branch,
and a break-count going stale within the same PR.
