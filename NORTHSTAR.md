# Portfolio site (yovanmc.github.io) — North Star (2026-07-07 grilling session)

> **AMENDED 2026-07-30 — the freeze is removed.** Owner ruled the post-S3 career-gate freeze deleted outright, not deferred, and replaced it with a priority ordering: **the S-series outranks the M-series**, site polish first, battle track yields. The 2026-07-07 locked decision below that established the freeze is **superseded**; it is kept in place, struck through, because the reasoning is still the record of why the gate existed. Everything else on this page still stands. Authority for current sequencing is `ROADMAP.md`.

## What this builds up to be (end-state vision, owner-locked 2026-07-07)
**The finished site is the full RPG spectacle, battle included.** The Kingdom-Hearts-style command-menu portfolio reaches its complete form:

- **S3 visuals:** every case study carries real shots/diagrams in a deliberately chosen design direction (design-first, several visibly different options, per the locked process).
- **S5–S6 battle engine + assets:** the content-woven turn-based battle where spells = case studies — genuinely part of the end state, not decoration. Built post-career-gate as the hobby continuation of the site.
- **S7 (true 3D dive): a maybe, permanently.** Stays in the vision as the far-horizon option; never planned unless the owner asks.
- **Post-hire conversion:** once the job lands, the site's mission shifts from candidacy to professional presence + ongoing RPG playground — the battle work happens in that era, guilt-free, as the creative project it is.
- **Never:** resume PDF on-site (ruled), confidentiality-sensitive content, SSR migration, skimmer-funnel redesigns.

**v-final test:** a visitor can explore the station, dive into real-visual case studies, and fight a battle whose moves are the owner's actual work — and the owner still enjoys maintaining it after it stopped mattering for hiring.

## Path to v-final (rough build outline, 2026-07-07)
Ordering rationale: the existing S-sequence is sound; this outline fills in how the post-gate spectacle actually gets built.

**Phase 0 — S3, design-first (post-vacation).** Heavy design phase: several visibly different visual directions for case-study shots/diagrams (the SVG render+critique loop technique applies); owner picks; assets produced under the per-asset confidentiality gate; placeholders die. Then S3b (the "Building this site" meta case study — executes the already-made own-the-AI-process decision) and S4 (Curio publication track, its own gates). Why: the site must stop showing scaffolding while it's being linked from live applications.

**Phase 1 — ~~FREEZE until the career C1 OA gate passes~~ REMOVED 2026-07-30.** There is no freeze. Work proceeds S3 → S3b → S4 → S5 → S6 with the S-series outranking the M-series throughout. The two nags (repo pins, display name) remain outstanding phone-work.

**Phase 2 — S5 battle engine (post-gate, likely post-hire era).**
What: turn-based battle where the move-set is generated from `content.ts` — spells = case studies, damage/effects flavored by each project's real facts; losing is impossible but the fight is the tour. Why data-driven: content already lives in one typed file; the battle becomes a second *renderer* over the same content, so case-study edits never desync from the battle. How: state machine consistent with the existing command-menu architecture; no new framework; assets deferred to S6 so the engine proves fun with placeholder VFX first.

**Phase 3 — S6 battle assets.** The approved Station aesthetic extends to battle visuals; produce via the render+critique loop; sprite VFX stays declined — CSS/SVG effects within the established style.

**Phase 4 — Post-hire conversion.**
What: hero/roster copy shifts from candidacy ("hire me") to presence ("this is what I build"); case studies gain the new job's era over time (confidentiality rules of the new employer inherited into §4.4-style discipline). S7 (true 3D) remains a permanent maybe — never planned, only owner-initiated.

**v-final:** a visitor plays the battle, spells are your actual work, and the site is something you still enjoy touching after it stopped being a job-search asset.

## North Star (operating identity)
The site is a **differentiator / conversation piece** (Option B, owner decision 2026-07-02, reaffirmed): memorability over skimmer optimization, with broken-basics (shareable, contactable) non-negotiable. Repos and applications carry the evidence; the site makes the candidate memorable. Success metric: it comes up in interviews.

## Owner decisions locked this session
1. **Resume-PDF conflict RULED: resume stays off the site.** The 2026-07-02 audit's "top gap" finding is explicitly overruled — consistent with confidentiality rules and per-application tailoring. Do not re-propose. (The audit conflict that sat open since 07-02 is now closed.)
2. **S3 timing: post-vacation, design-first.** Before any screenshots or asset production, a **heavy design phase** happens — Claude works up the case-study visual design properly first. Per the standing owner preference: present several *visibly different* design directions to choose from, not one default. Screenshots/diagrams get produced only after a direction is picked. The placeholder "PROJECT SHOT / DIAGRAM" banners live until then — known and accepted.

## Roadmap (already sound; reaffirmed with the above amendments)
1. **S3 (post-vacation): design phase → owner picks direction → real visuals replace placeholders.** Per-asset confidentiality gate stands.
2. S3b (meta "Building this site" case study) — executes the already-made "own the AI-built process" decision (A+C).
3. S4 (Curio publication readiness) — independent track, gated on full-history sweep + dissect SHIP verdict, as documented.
4. ~~**Freeze after S3 until the career-track C1 OA gate passes** (tracked in C:\Agent Zone\_career\ROADMAP.md). This external gate is a feature, not a bug — it subordinates site polish to actual job-search work.~~ **SUPERSEDED 2026-07-30: freeze removed.** The guard inverted in practice — the 2026-07-28 M-series pierce let eight battle milestones ship in three days while the freeze's remaining scope was the portfolio-facing S-series, so it was blocking the job-relevant half and passing the hobby half. Replaced by a priority ordering (S-series over M-series) that serves the original intent directly. Full rationale in `ROADMAP.md` decision log.
5. S5–S7 (battle engine, battle assets, 3D dive) — post-career-gate, unchanged.

## Nags (manual, minutes each, pending since 2026-07-02)
- GitHub repo pins + profile display name — still manual-pending five days later. Do these from a phone; they're the cheapest storefront win available.
- Portfolio-repo dirty-tree cleanup flagged by the audit.

## Standing constraints (reaffirmed, do not re-litigate)
- Confidentiality: every asset passes the standing private checklist (kept outside this repo); §4.4 citation rules for named UWM products; private backups stay in `_portfolio-private`.
- Declined-and-do-not-re-propose list stands: resume PDF (now formally ruled), Reserve/PlotArmor and one other pulled roster entry, SSR migration, sprite VFX, Compass roster entry, Dynatrace claim softening.
- Owner prose style on-site: no em dashes, no en dashes, no semicolons.
- The stale local `yovanmc.github.io` Astro clone is scratch — never push from it; live content ships only from `portfolio-rpg`. (One preserved artifact there: the approved Station SVG at `design_handoff_portfolio/station-loop/station-PASS-v2.html`.)

## Kill criteria
None — the site is live infrastructure for the #1 goal. ~~The freeze-after-S3 gate already prevents it from becoming a time sink.~~ **Amended 2026-07-30:** with the freeze removed, nothing structural bounds site time, and the owner accepted that explicitly when ruling. The substitute is the priority ordering — the S-series (job-relevant polish) outranks the M-series (battle/hobby), so the time that does go in goes to the half that serves the #1 goal. If the job lands, the site's mission changes (professional presence, not candidacy) and S5+ becomes pure hobby — re-grill then.
