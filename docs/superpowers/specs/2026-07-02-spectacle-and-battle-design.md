# Portfolio Spectacle & Battle System — Design Spec

> Owner-approved design from the 2026-07-02 Fable grill session. Source of truth for milestones S1–S6 in ROADMAP.md.
> Confidentiality rules and owner-voice rules in this spec are HARD constraints, not preferences.

## Purpose (owner decision, locked)

The site's job is **differentiator / conversation piece** ("the RPG portfolio guy"), NOT the primary evidence artifact — the GitHub repos and the resume carry the evidence. Accepted cost: pure skimmers may bounce. Non-negotiable floor even for a conversation piece: shareable links must preview properly, contact must work on every viewport, and nothing on the site may be broken or placeholder-visible.

End state: a visitor lands on the RPG command menu, can browse 7 curated case studies — or enter **the Battle**: an Octopath-Traveler-inspired 2.5D turn-based fight where a pixel sprite of Yovan casts spells the visitor picks. **The spells ARE the work** (owner: option B): each spell maps to a roster entry ("Dead Letter Queue", "Distributed Trace", "Mutation Gate", …), casting it plays procedural VFX, damages the boss, and unlocks/links its case study. The enemy personifies production failure (working name: *the Silent Failure*). The battle doubles as navigation — playing it teaches the visitor the resume.

## Art direction (owner style grill, 2026-07-02 — binding)

- **The wow arc:** first impression = the stained-glass Station. From there, a staged "dive to the heart": **v1** — a faked dive (scale/parallax/blur through layered 2D planes; CSS/canvas) that settles into the 2.5D battle world; **v2 (later, own milestone)** — a true 3D camera dive (Three.js/WebGL). Long-term trajectory: the site becomes progressively more game-like (owner: Tier 2 now, drifting Tier-3-ward across releases — never at the cost of the classic menu fallback).
- **The message the wow must carry (owner's words):** "motivation and inspiration — not just someone who had access to AI, but someone who truly created something with their ability." Standard this implies: every visual decision must be *defensible as a decision* — owner can point at any pixel and say what he chose about it.
- **Process ownership = A + C (owner):** the site proudly owns being AI-built. (A) A "How this was built" presence on the site in the same voice as the repos — designed, art-directed, and written by me; built with the multi-agent tooling I build. (B was rejected.) (C) A meta case study about building this site itself (the SVG render-critique loop that produced the Station glass; the harness workflow) — interview-drafted like all new prose, added post-S3 when the story is complete. Roster becomes 7 + 1 meta entry.
- **Motion non-negotiables:** the dive is skippable on first visit, auto-skipped on repeat visits (localStorage), respects `prefers-reduced-motion`, and mobile gets a lighter cut. An unskippable intro is friction wearing a costume.
- **Audio (owner: opt-in, sourcing deferred):** site always loads silent; a deliberate sound toggle awakens ambient + menu/battle SFX. Sourcing from the safe menu ONLY: licensed game-audio packs · CC without NC clauses · AI-generated (check generator terms) · commissioned. **Never unlicensed commercial music — "non-commercial site" is NOT a copyright defense** (and the actual KH OST is categorically off the table).
- **IP line (encode once, applies forever):** KH-*inspired* is fine (style, menu structure, dive concept are not protectable); KH *assets* never (music, artwork, logos, name). Nothing on the site says "Kingdom Hearts". Spell names are the owner's own work terms — no franchise spell names.
- **Sprite brief (owner):** stylized avatar, NOT a literal likeness — his real skin color, hair, and height; everything else (outfit, face detail, gear) unique to the character. One-way-door likeness explicitly declined.

## Hard constraints

1. **Owner voice.** All existing description prose in `content.ts` was written by Yovan deliberately, word by word. Agents NEVER rewrite, "improve", or re-tone it. New prose (Compass, Curio, Experience additions) is produced case-study-interview style: grill one question at a time, assemble ONLY from his own sentences, he approves every line before commit. Typo/mechanics fixes to published output are allowed (standing rule).
2. **Confidentiality (public site + public repo).** EVERY new asset (prose, diagram, screenshot, sprite, spell name, slug, filename, commit message) passes the standing private confidentiality checklist (kept outside this repo) before commit — slugs and filenames are leak surfaces too. Named UWM products only with public citations (§4.4 rule). Screenshots of local apps must show sample/demo data only, never the owner's real library/personal data.
3. ~~**Career-roadmap coupling.** After S1–S3 ship, the site FREEZES until the C1 OA gate passes (`C:\Agent Zone\_career\ROADMAP.md`). S4–S6 execute in bounded chunks that never displace drill hours.~~ **REMOVED 2026-07-30 (owner) — this is no longer a hard constraint.** There is no freeze and the career track gates nothing in this repo. Replaced by a priority ordering: the S-series outranks the M-series (site polish first, battle track yields). S4–S6 keep the bounded-chunk discipline as good practice, not as a coupling. Full rationale in `ROADMAP.md` North Star + decision log. Constraints 1, 2 and 4 are untouched and remain hard.
4. Resume stays unpublished on the site (standing owner rule; under the differentiator framing the site doesn't need it).

## Roster (owner decision, locked — 7 entries)

1. **MIA** — flagship (existing prose, untouched)
2. **The failure that left no logs** (Http.sys) — existing, untouched
3. **Observability by default** (Dynatrace guardians) — existing; the uncited "invited to present to Dynatrace's global automation guild" claim must be cited (owner to supply a public link) or softened (owner approves wording). Blocking item for S2.
4. **backend-harness** — existing, untouched
5. **notification-dispatch** — existing, untouched
6. **Compass** — NEW entry (interview-drafted): zero-dependency pure recommender core + self-evaluation harness story; repo link (public, CI-green)
7. **Curio** — NEW entry (interview-drafted): unified local-first media platform that superseded four separate apps; ships with real UI screenshots and "code private" note FIRST; repo link added only after S4 passes.
8. **Building this site** — META entry (owner decision C, drafted post-S3 when the story is complete): the render-critique loop behind the Station glass, the multi-agent build process, owner as designer/art-director. Interview-drafted; tooling group.

REMOVED: VideoTriage, AudioShelf, MangaReader, VideoShelf (superseded by Triage/Curio). Their public GitHub repos get archived with a one-line "superseded by …" README note (part of S4's follow-through; archiving is reversible).
OUT (owner decisions): PlotArmor ("not yet"), Reserve (private one-way door), and one further entry deliberately pulled earlier.

## Milestones

### S1a — Visual & copy fixes (no prose changes; ~1–2h; small)
- Turn Station hero ON (`SHOW_STATION` → true; approved render preserved at `C:\Agent Projects\yovanmc.github.io\design_handoff_portfolio\station-loop\station-PASS-v2.html` — verify the integrated hero matches it via screenshot-subagent).
- Fix mobile 390px Contact-tab clip (verified bug).
- Fix stale "PLACEHOLDER" header comments (content.ts:4–7), stale README status, Vite-5-local vs Node-24-CI skew.
- Verification: build green, headless-Edge desktop+mobile captures judged by a pinned subagent (Station visible + matches approved render, no clip at 390px).

### S1b — Routing, share previews, a11y (~3–4h; the real S1 engineering — two from-scratch subsystems, verified absent from App.tsx today: no routing primitives, no aria/roles)
- Path-based deep links (`/work/<slug>`): every case study addressable, browser Back works inside the site. GitHub Pages SPA fallback via the standard `404.html` shim.
- **Per-slug static share shells generated at build time** (critique-gate finding: crawlers don't run JS and hash fragments never reach the server, so a single static index.html can NEVER give per-page previews). A small build script emits `/work/<slug>/index.html` per roster entry, each carrying its own `og:title`/`og:description`/`og:image` and hydrating into the SPA. Root og:image = Station render export. Acceptance: a cold fetch of `/work/<slug>/` returns HTML whose static meta names that case study — verified by curl, no JS.
- Basic a11y: roles on clickable divs, focus trap + Escape handling in the overlay.
- Verification: build green; curl checks per shell; headless-Edge capture confirms deep link renders the right case study cold.

### S2 — Roster & content (voice-gated; ~2–3h owner interview time)
- Remove 4 superseded entries from `content.ts`; add Compass + Curio entries via owner interview (constraint 1).
- Dynatrace citation resolution (owner input required). **Pre-drafted fallback so the interview never stalls** (critique-gate finding): if no public link exists, owner picks between (a) softening to a self-contained factual line built from his existing words — e.g. keeping the presentation fact but dropping the unverifiable "invited by Dynatrace" framing — or (b) appending "(details on request)" to the existing sentence. Both are candidate edits to HIS sentence; he approves the exact wording per constraint 1.
- Optional (owner's call during interview): Experience entry additions — ASU B.S., role tightening.
- Verification: owner reads and approves the full diff of `content.ts` before merge — no exceptions.

### S3 — Visuals (~3–4h + owner desk time for captures)
- Real UI screenshots: Compass + Curio (sample/demo data only; subagent confidentiality check per shot; owner approves each).
- Public-altitude architecture diagrams for the 4 backend entries, styled to the site's dark aesthetic. Show the owner 2–3 VISIBLY DIFFERENT style options (widget mockups) before producing the set; every diagram passes the private checklist; owner approves each visually.
- Replace the "PROJECT SHOT / DIAGRAM" placeholder banners; delete the banner fallback for entries that have assets.

### S4 — Curio publication readiness (independent; size unknown until swept; gates ONLY the Curio repo link + predecessor archiving)
- Full-history sweep of the local Curio repo BEFORE any push: secrets, personal data (library names, paths, fixtures, verify-harness screenshots), commit messages, agent-voice docs, TODOs. Dissect-style verdict; publish only on SHIP.
- Fallback if history isn't publishable: fresh-history public mirror (owner decides at that point).
- On publish: add repo link to the Curio site entry; archive the 4 predecessor repos with "superseded by Curio" notes; add Curio to the profile README/pins consideration.

### S5 — Battle engine (placeholder art; Opus-era; bounded)
- Turn-based battle state machine: menu → spell select → cast (procedural VFX: particles/glow/shake in canvas) → damage → enemy turn → victory/defeat. Placeholder rectangles/silhouettes for both combatants — the engine must be FUN and complete before any real art exists.
- Spell arsenal = the 7 roster entries; each cast unlocks/links its case study; defeating the Silent Failure = "you've seen the whole portfolio" moment (design the victory screen to land the contact CTA).
- Battle is an opt-in mode from the command menu; the classic menu remains the default navigation (a recruiter who won't play still gets everything).
- Acceptance item (self-contained, per critique gate): the spell-name ↔ roster mapping (names, slugs, any flavor text) passes the constraint-2 checklist before commit.
- Feasibility notes: React + `<canvas>` (or PixiJS if layering demands it — decide in the S5 plan with a spike task); deterministic, no backend, state in-memory + localStorage for unlocks. Keep the bundle lean; battle code lazy-loaded so the landing page stays fast.
- S5 also carries: the **v1 faked dive** as the battle-mode entry transition (art direction §wow arc, with all motion non-negotiables), and the **audio toggle infrastructure** (opt-in per art direction; ships silent with hook points — assets arrive whenever sourcing resolves).

### S6 — Battle assets (sequenced C → B-or-A; owner decision)
- Stage 1 (C): externally AI-generated sprite sheets (owner-produced, curated) for Yovan-sprite (idle/cast/hit) + Silent Failure (idle/hit/defeat). Known risk accepted: frame consistency; treat as an upgrade-ready placeholder tier.
- Stage 2 (B or A): owner attempts Aseprite himself, or commissions a pixel artist. **Concrete pricing-verification step (don't skip): the S6 planning session opens with a web-research pass on current pixel-art commission rates (itch.io/Fiverr/artist sites) and puts real numbers in front of the owner before the B-vs-A decision** — the "low hundreds USD" planning figure is UNVERIFIED.
- VFX stays procedural regardless (no VFX sprite art, ever — code owns it).
- Every sprite/asset passes constraint 2 (nothing identifying beyond the intentional likeness).

## Sequencing & ownership

**Superseded 2026-07-30 — `ROADMAP.md` is the sequencing authority; this paragraph is kept for the ownership/tooling half only.** ~~S1 → S2 → S3 ship the spectacle (this week / early C1, then freeze). S4 independent. S5/S6 post-C1-gate in bounded chunks~~ — S1/S2 shipped, S3 is next, there is no freeze, and S5/S6 are simply lowest priority behind every ready S row. Still current: milestones are planned via /roadmap with plans written to be executable by pinned sonnet builders under a top-tier orchestrator (Fable left the plan ~2026-07-07; this spec + ROADMAP.md are the handoff).

## Out of scope (declined, with rationale — don't re-propose)

- Resume PDF on the site (standing owner rule; differentiator framing doesn't need it).
- Reserve / PlotArmor / one pulled roster entry (owner decisions 2026-07-02).
- SSR/prerender migration (OG tags + og:image solve the share-preview problem at a fraction of the cost; revisit only if link-preview evidence shows it's insufficient).
- Sprite-based spell VFX (procedural only — cost control).
