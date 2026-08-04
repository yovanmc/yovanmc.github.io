# Portfolio RPG — Lessons

This is the repo's pull-based lessons file for the `/roadmap` workflow: planners grep the `### [keyword]`
headings for the milestone's surface and read only the matching entries. `ROADMAP.md` never holds
lessons or shipped-milestone retros — that content lives here, moved verbatim, newest-first.

### [owner-voice, prose, content-ts, tone, provenance] Owner voice pass (2026-08-02, PR #49) — read before touching any prose in `content.ts`

Owner voice pass SHIPPED (#49, 2026-08-02), and it found a pattern worth reusing rather than a list of
typos. The owner read `content.ts` end to end and said parts of it were not his voice. The punctuation
rule was clean (verified: the only em dash is the file-header code comment, all 25 semicolons are
TypeScript), so the problem was tone. **The dividing line is provenance, and it is sharp: the entries
drafted from owner interviews (Curio, ASU) read like him, and the four carried over from the old Astro
case studies (MIA, backend-harness, the-failure, observability) read templated.** The strongest tell was
one construction — "The piece/parts/part I am proudest of" — appearing in three separate case studies,
which no person writing three things independently would do. Secondary tells: aphoristic closers,
rule-of-three lists, and contact blurbs in pure copywriter voice. **Shipped:** four owner-worded
replacements ("most proud of building", "This isn't possible with a shared short code", "I am most proud
that it was not a one-off"). **Ruled and shipped alongside it:** captions off all six figures (see the
design-lock entry below) — three of the six captions were themselves the aphoristic closers. **Standing
lesson: when prose across a site needs to sound like one person, check for a repeated frame before
checking for bad sentences — the repetition is the tell, and it is invisible entry by entry.**

### [figures, registry, slug-coverage, s3b, captions] S3 PR-A obligation on S3b, narrowed (2026-08-02) — read before scoping S3b's meta-entry figure

S3 PR-A created a live, machine-enforced obligation on S3b, and it is now shipped rather than planned.
`registry.test.ts` asserts bidirectional slug coverage (every project slug has a figure, every figure key
is a project slug) and `vite.config.ts` errors the build if the shell count is not 8. So the sanctioned
7th roster entry ("Building this site") **cannot ship without its own figure**. **The caption half of that
obligation is GONE as of 2026-08-02 (PR #49) and S3b is easier for it.** The original coupling was that
the figure's caption had to be a verbatim substring of prose that did not exist yet, so S3b could not
ship a figure before the owner interview produced the prose. The owner then ruled captions off all six
figures outright (he found them parroting the sentence they were drawn from), so `caption`, its six
values, the rendered element and the whole caption-provenance test no longer exist. **What still binds
S3b:** slug coverage is bidirectional and the shell-count guard still errors at anything but 8, so the 7th
entry needs a figure and a shell. **What no longer binds it:** the figure needs no prose to exist first,
because a figure's accessible name is now derived from the project title rather than hand-written. Node
labels are still agent-written and still a leak surface, so the confidentiality gate on them is unchanged.

### [s4, predecessor-repos, recon-verification, triage] S4 planning corrections (2026-07-31) — read before trusting a recon subagent's claim about live repo state

Two S4 corrections worth keeping, because both were wrong in a *briefed* artifact before they were
caught. (a) A draft claimed "only 3 predecessor repos exist, not the 4 the spec says" and tagged
`AudioShelf` private. Both false: the spec's list of four at
`2026-07-02-spectacle-and-battle-design.md:40` is correct and complete, and live visibility is
VideoTriage/AudioShelf/VideoShelf PUBLIC, MangaReader PRIVATE. Root cause: a recon subagent's reading of
live GitHub state entered the claim ledger without first-hand re-verification. (b) `VideoTriage`'s
successor is **`Triage`**, not Curio, and `Triage` is private, so it must never get a "superseded by
Curio" note and needs its own ruling. Both are now lenses (165) rather than notes.

### [git-identity, commit-email, github-merge, confidentiality] Personal email exposed via PR merges (2026-07-31) — read before assuming local commit-identity config covers a public repo

THIS repo publishes the owner's personal email on every PR merge, and nobody had noticed (found
2026-07-31 while checking S4's commit convention). Measured: 58 commits across all refs, **47 on
`main`**, are authored `yovanmc <personal address>`; all 152 hand-made commits correctly use
`yovanmc@users.noreply.github.com`. The exposing commits are **GitHub's server-side PR-merge commits**,
which use the account's *primary* email rather than the noreply identity — so the repo's own
commit-identity discipline was never the gap, the merge path was. Curio has zero such commits. **Fix is
one owner action at the account level, not a repo change:** GitHub Settings → Emails → *Keep my email
addresses private* + *Block command line pushes that expose my email*, after which future merges use
noreply. The existing 47 are not worth rewriting a published repo to remove. Standing lesson: **a
commit-identity rule that only governs the commits you author leaves the ones the platform authors for
you unguarded** — check `git log --all --format=%ae | Group-Object` on every public repo, not just the
local config.

### [publish-milestone, leak-surface, dissect, confidentiality] The plan itself is a leak surface (2026-07-31) — read before writing any future publish-readiness plan into a public repo

The S4 plan is itself a leak surface, and that is a general rule now, not an S4 quirk. This repo is
public, so a publication-readiness plan written into it would publish the very strings it exists to
evaluate. Dissect pass 2 caught the plan enumerating its own landmine **detector** set inline — the
ID-split had been applied to findings but not to the search terms, which disclose which associations are
treated as sensitive. **Standing shape for any future publish milestone: workflow and gates in the public
artifact referring to findings by ID only; all finding content and the detector in a private companion
outside every git repo; and the rule binds the target repo's own commit messages too**, since commits
made during a scrub postdate the scrub and cannot be removed by it. Lens 166.

### [dissect, critique-gate, model-diversity, fable] Model-diverse second dissect pass (2026-07-31) — read before trusting a single-model critique pass, especially on a fix round

A model-diverse second dissect pass paid again, and larger than before (S4 planning, 2026-07-31). Pass 1
(`sonnet`) ran the full six passes and returned 7 MAJORs; the plan was fixed against all of them. Pass 2,
pinned **`fable`** because the plan was Opus-authored and an Opus critic shares the author's blind spots,
then found **a BLOCKER and six MAJORs pass 1 had missed — and four of those were defects in pass 1's own
fixes**: a guard that landed in the prose preamble but never in the task's step list, a guard whose
predicate false-passes the exact case it guards (`gh repo view` exits 0 for the owner on a *private*
repo, so it cannot prove a link works for visitors), a coverage floor applied to one axis while the
sibling axis kept the bug, and a composition gate that could never have had a passing run. **Standing
inference: the pass after a fix round is the highest-yield pass, because fixes are written under time
pressure by the author and no one re-attacks them.** Prior measurement was +3 must-fixes (2026-07-14);
this was materially bigger.

### [preflight, ledger-format, recheck-script] Preflight failures are ledger format, not stale claims (2026-07-31) — read before writing a claim-ledger recheck command

Preflight failures are usually ledger FORMAT, not stale claims — and the format rule is narrower than "a
dash". S4's first preflight FAILed 14 of 23 rows. Every one was formatting: the unautomatable cells were
written as `` `—` `` (backtick-wrapped), which the parser reads as a *command* and then executes a dash.
The house format is a **bare** `—` followed by an unbacked parenthetical. One further row broke on an
escaped `\|` inside the recheck command, which the table parser split on. **Write rechecks with no pipes
at all** — `if (-not (Select-String ... -Quiet)) { exit 0 } else { exit 1 }` covers nearly every case.
After the fix: PASS, 10 verified and 13 correctly skipped. This is the S3 build session's lesson
recurring with a new sub-case, so it is now stated as a rule rather than an anecdote.

### [design-lock, figures, s3, wireframe, visual-style] S3 PR-A shipped — the design lock (2026-07-31, PR #46) — read before touching site visual direction or the figure system

S3 PR-A SHIPPED (#46, 2026-07-31). The design lock in `docs/design-system.md` is now implemented, and it
is still the file every later design round starts from. Owner picked in two rounds (wireframe layout
first, then visual style on the winner, so the layout call was not contaminated by palette): **layout
D**, banner deleted and the figure moved into the body at readable height; **figure style 4
(command-menu native) as house style with style 2 (terminal evidence) as a per-project override**,
rendered as components off `content.ts` rather than as images so they reflow on mobile. Decisive
argument for D: it is the only direction where the top of the page does not demand a strong asset per
project, and two of six figures are confidentiality-shadowed by construction. **Rejected, with rationale
in the design lock:** a diagram in the old banner slot (~200px on a phone, unreadable), leaded glass as
the figure language (kept for the sigil only), blueprint schematic as house style (the generic dark-mode
diagram the design phase existed to avoid), terminal evidence as house style (MIA and Curio have no log
story, so it would force fabricated artifacts), and no figures at all. **Scope correction the spec never
had:** S3 is Curio screenshots plus **five** other figures — Compass left the roster 2026-07-03 and
`content.ts` holds six projects.

### [capture, screenshot, scroll, viewport-clip] A valid capture of the wrong region (2026-07-31, S3 PR-A build) — read before trusting a capture-sanity check

A capture can be a perfectly valid image of the wrong region, and every sanity check passes it (found S3
PR-A build, 2026-07-31). `Test-CaptureSane` screens for missing, tiny and near-uniform images. A
screenshot of the page *header* — taken because the figure sat below the fold — is none of those: right
dimensions, healthy stddev, twenty colours, PASS. All 18 captures came back **byte-identical across a
change that provably altered the DOM**, and that identity is the tell; the geometry probe reading
`scrollWidth` in JS saw a change the pixels could not. The fix belongs at capture time, where the
subject's rect is knowable: scroll it into frame, assert `top >= 0 && bottom <= viewport.height`, and
throw WITHOUT writing the file, recording every verified rect to `frames.json` so a reviewer can confirm
the guard ran. Two riders. The guard immediately caught a defect nobody suspected — **the desktop 1440
shots were clipping too** (`bottom` 1003 against a 900px viewport), so "it's a mobile problem" was
already wrong. And **`window.scrollTo` is a no-op on this app**: `CaseStudyPage` scrolls a
`[data-scroll]` div with `overflow-y:auto`, so the first fix changed nothing and looked like the guard
was faulty. Drive `closest('[data-scroll]')`'s `scrollTop`.

### [figures, uniformity, layout, flow-vs-log] Uniformity fix applied to one axis only (2026-07-31, S3 PR-A build) — read before applying a uniformity fix to one axis of a multi-axis figure system

A uniformity fix gets applied to the axis someone complained about, and the sibling axis keeps the bug
(found S3 PR-A build, 2026-07-31). Pass 2 of the critique found that a per-figure threshold let a 3-node
figure render horizontally while a 4-node one stacked at the same width, and replaced it with
`uniformRowThresholdPx` derived across the whole registry. That was the *flow* axis. The *log* axis kept
deciding inline-vs-stacked per figure, so at a 390px viewport one log figure went inline and the other
stacked — the same defect, unfixed, in the same file, after two dissect passes. It surfaced from the
verification gate's geometry output, not from any test, because the tests asserted `inline ⟹ it fits` and
never that the two figures agreed. **When a finding says "derive this across the whole population, not
per item," grep for every other decision of the same shape before closing it.** Corollary: an assertion
over a set must derive each item's value *from that item* — `items.map(() => f(shared, w))` ignores its
argument and makes `Set.size === 1` true by construction, which is how a vacuous version of this exact
test shipped alongside the real fix and had to be caught in diff review.

### [figures, measured-constants, webfont, node-min-px] Figure-system layout constants are measured (2026-07-31, S3 PR-A) — read before touching `src/figures/` layout constants

The figure system's layout constants are MEASURED, and the rig that measures them emits the fixture the
tests assert against (S3 PR-A). `NODE_MIN_PX = 110` and `MONO_CH_PX = 7.49` come from
`tools/measure-figure-type.mjs` driving a real headless-Edge render, gated on `document.fonts.ready` plus
a `document.fonts.check` hard-fail so a fallback face can never be recorded as JetBrains Mono. The plan's
placeholders (96, 6.6) were wrong by ~13% for one reason worth remembering: **6.6px is JetBrains Mono's
0.6em advance at 11px, and the spec adds `.08em` letter-spacing (0.88px) that the placeholder forgot** —
6.6 + 0.88 = 7.48. `maxLabelWordChars()` is exactly 12 and `ORCHESTRATOR` is exactly 12 characters, so
**that cap has zero margin**: any change pushing `MONO_CH_PX` above 7.5 makes a shipped label illegal.
The rig writes both `docs/design-labs/s3-figures/measured-figure-type.json` and
`src/figures/__fixtures__/measuredFigureType.ts` — never hand-edit the latter, or a re-measurement
silently stops disagreeing with the constants.

### [command-menu, battle-ui, scroll-budget] M12 shipped — command-menu redesign (2026-07-30, PR #41 #42) — read before touching the battle command-menu panel

M12 SHIPPED (#41 #42, 2026-07-30). Ruling 3 was amended mid-build, and that amendment is the binding
version. The plan promised residual scroll at **800×600 Spells only**; measurement at the build's chrome
gate refuted the arithmetic it rested on (3-row levels render at 162/174px against a predicted ~148, and
Spells at 205px once every cursor position is walked). Owner ruled: **all three levels may scroll at
800×600**, gated on the fade+chevron affordance, rather than compact further or edit copy. Declined then
and still declined: a further compaction pass (row gap, body padding — would have rescued only the top
level while tightening every desktop viewport), and shortening the long ability descriptions. The
deviation stays narrow because 205px is the largest level and the smallest budget outside 800×600 is
210px, so **every other swept viewport is scroll-free**. Semi-transparent panel remains the declined
secondary; two-column stays rejected (M7 measurement). The locked-Spells teaser ships greyed with no
spell-name leak, visually judged.

### [panel-budget, battle-geometry, layout-constants] 800×600 panel budget is 148px (2026-07-30, M12) — read before adding a new ability description or chrome change to the battle command panel

The 800×600 panel budget is 148px and the 1280×800 margin is 5px — treat both as live constraints, not
history. The budget is the combined legal max over ALL FOUR bosses' fresh compositions plus the hero,
derived through the pure `layout.ts` seams (148/210/217/245 desktop-tight, 315+ mobile, unbounded
elsewhere) and re-derived independently by `panelBudget.test.ts`'s property test, which also asserts the
cap is TIGHT (height+1 does intersect). **Alert Storm's swarm is the binding actor at most tight
viewports**, not the imposter clones — an imposter-only actor set overshoots by 2-4px, which is how the
shipped M7 flat-150 panel came to overlap the swarm by 2px at 800×600. M12's 148 retires it. At 1280×800
the worst-case rendered level is 205 against a 210 budget: **any new ability description that wraps an
extra line, or any chrome change, consumes that margin.**

### [geometry-invariant, actor-coverage, hero-clip, battle] Geometry invariant only guards named actors (2026-07-30, M7 B5) — read before writing any collision/overlap invariant

A geometry invariant only guards the ACTORS you named, and the bug report names the actor someone
happened to notice (found M7 B5, 2026-07-30). The clip invariant was built around the clone group because
that is what the M6 report described. It went green while the same COMMAND panel was also clipping the
**player hero's legs** at 360×640 — a different sprite, stamped separately at `HERO_AT`, never part of the
composed clone canvas, so no amount of clone-side coverage could ever have reported it. It surfaced only
because a visual judge looked at the frames. Standing rule: when writing a collision/overlap invariant,
enumerate **every actor drawn on that surface** and add a case per actor, not just the one in the ticket.
Both actors are now `it.each` cases over all 12 viewports, derived through the real seams (`IDLE[0]` at
`HERO_AT`, the composed clone canvas at `stampOrigin`), never hardcoded rects.

### [layout, rendered-dimension, content-driven, menu-budget] A rendered dimension is a hypothesis (2026-07-30, M12) — read before an owner ruling is built on plan-arithmetic dimensions

A rendered dimension predicted by plan arithmetic is a hypothesis, and one driven by variable-length
content is state-dependent (found M12, 2026-07-30 — both, in the same milestone). The plan derived the
compacted menu heights analytically (rows × row height + chrome), an owner ruling was built on the
result, and the arithmetic was wrong by 14-26px because it never modelled the footer. Worse, the footer
renders the **currently selected row's** description and long descriptions wrap ~12px, so panel height
changes with the cursor: the rig's landing-cursor measurement said 193px while the true worst case over
all cursor positions was 205px, against a 210px budget — a real margin of 5px, not 17px. Standing rules:
any predicted rendered dimension is a ledger claim a builder measures EARLY, expecting dependent rulings
to move; and any rig measuring a content-driven dimension walks every selectable state and keeps the max.
Now enforced — `measure-battle-layout.mjs` walks every row of every level, and `layout.test.ts` gates the
recorded max against the budget.

### [measurement-rig, artifact-directory, output-path] Measurement rig output directory (2026-07-30, M12) — read before running any measurement rig that writes baseline artifacts

The measurement rig writes to a PER-MILESTONE output directory, and must keep doing so (found M12,
2026-07-30). `tools/measure-battle-layout.mjs` originally hardcoded `docs/battle-prototypes/m7-clip` with
M7's `before`/`after` subdirs, so the first M12 run silently rewrote all 12 of M7's `before/` clip
baselines with M12-era post-fix renders — the working tree then asserted that new frames were M7's
historical evidence. Restored byte-identical from git history and the output root is now an argv/env
parameter (`npm run measure:layout` passes `m12-menu`). **Pass the next milestone's own directory; never
let a run inherit a previous milestone's.** When reviewing any diff touching an artifact directory, check
for pre-existing binaries MODIFIED rather than added — that is the only signal this leaves.

### [scoping, freeze, sequencing, north-star] Post-M12 scoping call (2026-07-30) — read before trusting a summary block over its source constraints

Post-M12 scoping call (2026-07-30) — owner ruled S3 next, and corrected the board's own map of what is
blocked. The session was called on the premise that every remaining row was gated. It was not: **the
freeze began after S3/S3b/S4** (it was removed outright later the same day, see the freeze-removal entry
below), so all three were live the whole time. Four sources agreed (North Star bullet 3, path-phases
line, sequencing note, `NORTHSTAR.md` Phase 0/1) plus this table's row order; only the NEXT UP block
written in the M12 hygiene pass said otherwise, and it has been corrected. **Lesson: a summary block that
restates constraints stated elsewhere is a divergence risk — the M12 pass rewrote it from memory of the
freeze rather than from the four sources, and it stood as the board's headline for a day.** Owner's
reasoning for S3 over the cheaper S4: `CaseStudyPage.tsx:153` still renders the `PROJECT SHOT / DIAGRAM`
placeholder on every case study, which is the page an application link lands on, and C2's higher
application volume starts Sep 1 regardless of the C1 gate. Rejected in this call, still available: S4
(lowest desk-time, protects C1 drill hours) and a single owner interview (would unblock S3b + M10
together, same prose constraint).

### [freeze, priority-ordering, north-star] Freeze removal rationale (2026-07-30) — read before questioning why the S-series outranks the M-series

FREEZE REMOVED (owner, 2026-07-30) — full rationale, because this overrode a locked 2026-07-07 amendment
in both ROADMAP.md and `NORTHSTAR.md`. The freeze was a **time guard, not a battle guard**:
`NORTHSTAR.md` framed it as subordinating site polish to job-search work, and the site's kill-criteria
section leaned on it as the only thing keeping the site from becoming a time sink. It was aimed at S5/S6
because `NORTHSTAR.md` calls the battle "the hobby continuation," i.e. the fun-not-load-bearing half. **By
2026-07-30 it had inverted.** The 2026-07-28 M-series pierce let M3 through M12 ship in three days (eight
milestones, 805 tests) while the freeze's remaining binding scope was the S-series — the portfolio-facing
work an application link actually lands on. The guard was blocking the useful half and passing the hobby
half. Owner ruled removal plus a priority inversion (S-series outranks M-series) rather than a repoint, on
the grounds that it does what the guard was for. **Two facts the owner accepted going in:** (a) nothing
structural now protects C1 drill hours in the sprint's final month (C1 runs to Aug 31, C2 starts Sep 1
regardless of the gate) — the ruling reprioritizes site work, it does not reduce it; (b) the release
condition was in any case unobservable, since `C:\Agent Zone\_career\ROADMAP.md` was last modified
2026-07-02, five days before the C1 window opened, and carries no gate-status field, so no session could
ever have read the freeze as lifted. That defect now belongs to the career doc alone and gates nothing
here.

### [test-design, tautology, figures, layout] A test that restates its own formula (2026-07-30, S3 planning) — read before writing a "legibility"/invariant test derived algebraically from the code under test

A test that restates its own formula proves nothing, and it is the easiest kind of gate to write by
accident (found S3 planning, 2026-07-30, by both dissect passes independently). The S3 plan shipped a
"legibility invariant" asserting `nodeWidthPx(n, w) >= NODE_MIN_PX` whenever `rowFits(n, w)` had returned
true. Those two functions are algebraic rearrangements of one inequality, so the test passes for *any*
value of `NODE_MIN_PX`, including absurd ones — while reading, in the plan, as the reason the module
existed. The plan had cited the M12 "a predicted rendered dimension is a hypothesis" lesson two paragraphs
earlier and then built the thing it warns against. **The working chain is: measure the constant against a
real render, commit the measurement as a fixture, assert the constant against the fixture, derive every
downstream cap from the constant, and then look at the result.** Test the *intent* (this figure stacks
below that width) rather than the arithmetic.

### [webfont, measurement-rig, figures, fonts-ready] A measurement rig that doesn't wait for the webfont (2026-07-30, S3 planning) — read before writing any rig that measures rendered type metrics

A measurement rig that does not wait for the webfont measures the fallback and looks successful (found S3
planning, 2026-07-30). `index.html:10` loads JetBrains Mono, Marcellus and Sora with `display=swap`, so
text is renderable and measurable in a fallback face immediately, and permanently if the headless run has
no network. Any rig measuring type metrics must `await document.fonts.ready`, hard-fail on
`document.fonts.check("<size> '<family>'")`, and record the resolved family in its output. Without that,
the numbers are confident, wrong, and then pinned by a 1px assertion.

### [layout, box-model, resize-observer, viewport-vs-container] Declare which box a width is (2026-07-30, S3 planning) — read before writing layout code that consumes widths

Declare which box a width is, once, before writing any layout code (found S3 planning, 2026-07-30).
`ResizeObserver`'s `entry.contentRect` is the CONTENT box: padding and border already excluded. A layout
function that subtracts the element's padding again is double-counting, and the error is invisible
because everything still renders — it just renders more conservatively than intended, so no test and no
screenshot flags it. The S3 figure system now states "every width in `src/figures/` is a content-box
width" above the first constant. Same class: a viewport width is not a container width. Sweeping `[320,
360, ..., 1440]` through a function that consumes container widths asserts behaviour at widths that never
occur, since a 768px viewport yields a ~649px figure content box through this page's padding chain.

### [uniformity, figures, layout, registry] A "uniformity" constant is a claim (2026-07-30, S3 planning) — read before picking a round-number threshold across a figure registry

A "uniformity" constant is a claim, and claims get tested (found S3 planning, 2026-07-30). A single
stack-below-this-width threshold does not make two figures agree if their row requirements differ: between
the threshold and the widest figure's requirement there is a band where a 3-node figure renders
horizontally and a 4-node one stacks, on the same device. Derive the threshold across the whole registry
(max requirement) instead of picking a round number, which makes the property true by construction, and
assert it directly (the set of orientations across all figures has exactly one member at every swept
width).

### [verification-caveat, mobile-capture, staleness, cdp] A verification caveat expires (2026-07-30, S3 planning) — read before citing a standing "cannot verify" caveat

A verification caveat expires when a later milestone builds the workaround, and nobody goes back to
un-scope the plans that quoted it (found S3 planning, 2026-07-30). "Mobile is not capturable" has been
true in this repo since S1a — of `msedge --headless --window-size`, which clamps to ~478px. M6 then built
the CDP path (`Emulation.setDeviceMetricsOverride` before first paint, `Page.captureScreenshot`), which
has no such clamp. The S3 plan still cited the S1a caveat to justify verifying mobile by geometry alone,
which would have left the stacked form — the form the whole design lock exists to protect — with zero
visual judgment. Before accepting "X cannot be verified," check whether a later milestone made it
verifiable.

### [completeness, capture, enumerate-actors] A completeness fix that enumerates n-1 (2026-07-30, S3 planning) — read before trusting a "cover every X" fix's own enumeration

A fix that says "enumerate every actor" and then enumerates n-1 is the M7 lesson recursing (found S3
planning, 2026-07-30). Pass 1 caught a capture list covering two of six figure pages; the fix rewrote it
to claim every actor and listed five, silently dropping the one page where the `fault` and `muted` tones
render as flow nodes rather than as a log rule. When a completeness fix lands, re-derive the population
from the data (the registry, the roster, the enum) and count it, rather than trusting the list you just
wrote.

### [imposter, footer, target-copy, phase-aware] M7 shipped — imposter footer (2026-07-30, PR #35 #38) — read before touching the imposter fight's footer copy or phase-aware seams

M7 SHIPPED (#35 #38, 2026-07-30), and one owner-overridable default rides on it. Both M6 Imposter design
calls were ruled into M7 rather than riding along with M4. The footer shipped as `n/N TARGET` where N =
slots that exist, so a killing blow during CLONES renders **`0/3 TARGET`** through the death animation —
player-visible, and the ordinary fast-kill display, since a killing blow never advances the phase and
CLONES is the opening phase. Changing it to `0/1` is a one-line edit; the six pinned strings live in
`scenes/imposter.test.ts`.

### [imposter, clip, viewport-sweep, layout] M7 B4 measured candidate table (2026-07-30) — read before touching the imposter clip/panel geometry; this is M12's starting constraint set

M7 B4 measured candidate table — kept because it is M12's starting constraint set, not M7 history. Driven
through the real `layout.ts` seams at all 12 viewports; **do not re-derive by hand.** The clip invariant
failed at 5 of 12 (1440×900, 1280×800, 1024×768, 800×600, 360×640). Every **art-side** lever is
infeasible: `CLONE_GAP` caps at 8/12 at any value down to 2; the stamp origin reaches 11/12 at
`originCol=88` but 360×640 needs ~241 on a 256-column stage and the clones enter the hero's band
`[184,207]` past ~101. Every **partial chrome** lever fails too: panel width reaches 10/12 and cannot
touch mobile at all, whose arm computes `vw-20` and never reads the 262 constant; the `bottom` offset
reaches 8/12 at absurd magnitudes. Two further candidates measured and refuted: shifting the stage right
of the panel overflows the viewport at every gutter (at 800×600 the stage is 768px inside 800px), and
raising the desktop scale floor needs 8–12× scale and never executes for mobile (the mobile arm forces
`scale = vw/SC`, bypassing the floor). **Panel HEIGHT ≤151px was the only single parameter that clears
all 12**, which is what shipped.

### [routing, router, url-prefix] Route prefixes are `/work/` and `/experience/`, never `/projects/` (2026-07-29, M4 planning) — read before writing a URL into a verification step

Route prefixes are `/work/<slug>/` and `/experience/<slug>/`, never `/projects/` (`src/router.ts:9,14`;
trailing slash canonical, matching the static shells GitHub Pages serves). The *category key* is
`"projects"` but the URL is `/work/`. A plan used `/projects/curio` as a literal verification step;
`pageForPath`'s regex never matches it, so the check would have passed by resolving to nothing (M4
planning, caught by dissect 2026-07-29).

### [animation, jsdom, z-index, coverage-blind-spots] A green suite can't see two classes of UI defect (2026-07-29, M6 PR-2) — read before shipping an animation beat or a stacked overlay

A green suite cannot see two whole classes of UI defect (found M6 PR-2, 2026-07-29 — both shipped past 306
passing tests): (a) tests assert FINAL states, so anything wrong only DURING an animation is unobserved —
the boss layer had stopped compositing on victory since M5, making every boss's death animation dead
code, and nothing went red; (b) JSDOM has no layout engine, so the mobile FIGHT chooser rendering
underneath two higher-`z-index` siblings was completely invisible to players while every assertion about
its rows passed. Any milestone adding an animation beat or an overlay must produce evidence unit tests
structurally cannot: a capture timed INSIDE the animation window, and a computed-style/geometry
measurement at the target viewport. Also: dark-palette frames defeat brightness-threshold pixel checks (a
`#181818` fade reads as "blank"), so use a colour-histogram region diff against a known-empty baseline.

### [battle-engine, acceptance-line, reducer, legality] A number can be right about a fight that can't be played (2026-07-29, M6 PR-3) — read before hand-deriving a battle acceptance line

A number can be right about a fight that cannot be played (found M6 PR-3, 2026-07-29 — twice, and both
cleared two dissect passes). The plan's fastest-line derivation was arithmetically correct and
MP-feasible, and step H5 was still ILLEGAL: PULSE's fire crosses the phase boundary inside the same
reducer call, so the boss was already untargetable when the hero next acted. Pass 1 had explicitly
recorded the arithmetic as verified — arithmetic and legality are different checks, and the evidence was
already in the plan (the signed Silent Failure line carries a forced `whiff` step for exactly this timing
on the same cycle shape). Then the re-derived line aimed at the seeded real clone slot, which a player
cannot see, making its turn count a claim about ORACLE play. Standing rules now: any hand-derived line
used as an acceptance criterion must be run through the real reducer; the generated-line test asserts
**zero invalid events**; and no targeted hit may consult `realIndex` before a mark reveals it.

### [coverage, v8-ignore, branch-coverage] A coverage-ignore annotation can suppress a real branch (2026-07-29, M6 PR-3 task 1) — read before placing a `v8 ignore` comment

A coverage-ignore annotation can suppress a REAL branch (found M6 PR-3 task 1). `/* v8 ignore */` placed
above a single-line `if (kind === X) return <ternary>;` swallowed the ternary — one of the two genuinely
uncovered gaps — and the file read 100%. Deleting that one comment dropped it to 98.83%. Annotations now
sit only on bare closing-brace lines, and every engine change re-runs a discrimination probe (skip a
test, confirm coverage DROPS). Never respond to a coverage gap by lowering the threshold.

### [break-count, test-probe, staleness] A break-count measured earlier in the same PR goes stale (2026-07-29, M6 PR-3 task 5) — read before trusting an earlier-measured failure count

A break-count measured earlier in the same PR goes stale (found M6 PR-3 task 5). The plan's "append the
flag, run the suite, exactly 4 failures" was measured at the PR's base commit; by task 5 it was 6, because
intervening tasks added new readers of that same flag. Re-measure the probe at current HEAD immediately
before the task that flips it, and treat any authorized-reconciliation list as a floor. When the newly
failing test is a GUARD, re-point its input to a still-invalid value instead of flipping its expectation
— flipping keeps the suite green while deleting the invariant.

### [cdp, headless-edge, browser-pane, mobile-input] CDP over headless Edge as a Browser-pane fallback (2026-07-29, M6 PR-3 task 7) — read when the Browser pane won't composite frames

CDP over headless Edge is the fallback when the Browser pane cannot composite (M6 PR-3 task 7). The pane
fails with "not compositing frames" in some sessions, and the battle renders into a single `<canvas>` so
cursor/animation state is pixels-only. Driving Edge's `--remote-debugging-port` gives real key AND mouse
input, emulated mobile metrics, and `Page.captureScreenshot` — enough to arm the target cursor, hit a
specific animation frame, and measure mobile hit-rects. Two traps: Edge silently delegates to a running
instance unless given its own `--user-data-dir`, and Node 20 needs `--experimental-websocket`.

### [localstorage, capture, iframe-probe, mobile-resize] Storage-dependent UI states aren't capturable by plain headless Edge (2026-07-29, M4) — read before capturing any state behind saved progress

Storage-dependent UI states are NOT capturable by plain headless Edge (found M4, 2026-07-29):
`--screenshot` runs cannot seed `localStorage`, so any state behind saved progress (partial unlocks, full
unlocks, cursor-on-locked-row) is unreachable that way — only the zero-progress default renders. Verify
those states with same-origin **iframe DOM probes** in the Browser pane instead (set `localStorage`, load
`/?phase=play` in an iframe, read `contentDocument.body.innerText`), which is also stronger than pixels
for content-leak questions: it proves what content EXISTS, not merely what is painted. Two traps on this
machine: `--headless=new` exited 0 and silently wrote **no PNG** while classic `--headless` worked, and
the Browser pane's `resize_window` does **not** fire a page `resize` event, so the app's `w`/`isMobile`
state stays stale and keeps rendering desktop chrome at a 390px viewport — dispatch `new
Event('resize')` before measuring mobile geometry, or you will measure the wrong layout.

### [victory, deterministic-battle, seed, toast] Deterministic App-level victory covers only the boot battle (2026-07-29, M4) — read before scripting a second in-session battle victory

An App-level victory can be driven deterministically, but only the BOOT battle (found M4, 2026-07-29):
`?phase=battle&seed=42&actions=pt:1,pt:1,attack:1` wins Alert Storm outright and fires the real
`onBattleVictory`, which is how M4 verified persist-on-victory and the unlock toast end to end. Take the
line from `engine.test.ts`'s `winBySeed` rather than deriving one (the M6 lesson above), and note the real
bat id for seed 42 is `1`. **A second in-session victory is not scriptable:** the FIGHT chooser starts the
rematch with a random seed and `actions=` only drives the boot battle, so M4's "two sequential victories
fire exactly one toast" check is **verified by code inspection only** (`prevDefeated =
stateRef.current.defeatedBosses`, ref reassigned every render) and was never observed live. The engine's
own rematch test does not cover it — the bug would live in App.tsx's closure, not the reducer. Anyone
adding a second victory-driving rig should close this.

### [localstorage, schema-guard, persisted-state, progress] `yrpg.progress` is the only persisted store (2026-07-29, M4 PR #31) — read before touching persisted progression state

`yrpg.progress` is the only persisted store, and its shape is pinned by a guard test (M4, PR #31).
Versioned envelope `{"v":1,"defeated":[...]}` under a single localStorage key; any value whose `v` is
absent/non-numeric/`!== 1` is treated as ABSENT, never partially read, and unknown top-level fields are
dropped on read and never round-tripped. `src/progress/schema.guard.test.ts` hard-codes the raw on-disk
literals — changing them is a breaking storage change needing a version bump and a migration, not a test
edit. Every read revalidates through the shared `coerceRushPrefix` (rush-order prefix, order-sensitive)
and caps at `IMPLEMENTED_BOSSES.length`; there is exactly ONE validator and adding a second is a design
violation.

### [scene-module, optional-seam, boss-scene] `BossSceneModule`/`ScenePlate` grow by optional seams (idiom since M6 PR-2, confirmed M7 planning, 2026-07-29) — read before widening a shared BossSceneModule/ScenePlate member

`BossSceneModule`/`ScenePlate` grow by OPTIONAL additive seams, not by widening shared members (idiom
since M6 PR-2, confirmed M7 planning). `arenaFor?`, `stampOrigin?`, `labelFor?` and now `footerFor?` each
pair a per-boss override with a `scene.plate.X?.(state) ?? scene.plate.staticX` fallback at the call
site, so unimplementing modules stay **byte-identical** and their tests need no edits — which is why a
"phase-aware footer" is a 3-file change, not a four-scene contract migration. Two supporting facts, both
measured 2026-07-29: the same object literal already carries two deliberately-dead structural properties
(`arena`, `hiddenLabel`), so a dead `footer` is precedent, not smell; and on the widening alternative, TS
**parameter covariance** means a 1-param implementation satisfies a 2-param member with no
`noUnusedParameters` complaint, but every 1-arg *call* then fails `TS2554`, and `tsconfig.app.json`
type-checks all of `src` — so widening costs test-call edits, never impl edits. **Four seams is the cap: a
fifth is the trigger to generalize the mechanism.**

### [battle-geometry, viewport-scale, dom-overlay, canvas] A DOM overlay over a canvas scene is viewport-dependent (2026-07-29, M7 planning) — read before writing or trusting a DOM-over-canvas collision check

A DOM overlay over a canvas scene makes a collision VIEWPORT-DEPENDENT, so one frame cannot validate a fix
(found M7 planning, 2026-07-29). The COMMAND panel is a DOM `<div>` in CSS px (`BattleScene.tsx:880`); the
battle is canvas pixels in a 256×144 logical grid blitted at a viewport-derived `scale` whose desktop arm
is a 0.5-step function. Worked from the real formulas: at 1440×900 the leftmost clone sits inside the
panel's column band (x 207 vs panel right edge 300), and at 1440×**720** — same width, height only — it
sits clear (x 321), because a shorter viewport drops `scale` 4.5→3.5 and pushes the centred stage 128px
right. Any such fix needs a **viewport sweep**, and the collision is best expressed as a rect-intersection
unit test over extracted pure geometry — `BattleScene.tsx` is `.tsx` and so matches none of
`vitest.config.ts`'s `src/battle/**/*.ts` coverage globs, which is exactly why this math is untested and
how M6's mobile z-index defect escaped 306 green tests. **Refined by measurement at the M7 B4 gate
(2026-07-29), and this is the load-bearing part:** the overlay's size is FIXED CSS px while the stage is
scaled, so the stage-column span the overlay covers grows as `1/scale` — at 1440×900 the panel eats stage
columns −24→35 (one clone's leg), at 800×600 it eats 7→95 and swallows the entire 3-clone group.
**Severity is therefore worst on the smallest screens, the inverse of where anyone looks first, and the
fix belongs on the OVERLAY, not the art:** every art-side lever (spread, stamp origin) was measured
infeasible because the art must move further than the stage is wide, while the one lever that cleared all
12 viewports was the panel's own height. Corollary for the test: `paintedBounds`/`gridRect` return the
UNION bbox of every sprite in a composed canvas, so the invariant asserts "no part of the group is under
the overlay" and cannot say WHICH sprite is occluded — pair it with a visual verdict, which is how the
near-total 800×600 occlusion was found (the numbers alone read as just another overlap).

### [tsc, build, typecheck, solution-style] Bare `npx tsc --noEmit` is a no-op (2026-07-03, S2 planning) — read before trusting a bare `tsc --noEmit` typecheck

Bare `npx tsc --noEmit` is a NO-OP in this repo (found S2 planning, 2026-07-03): the root tsconfig is
solution-style (`"files": []` + references), so `tsc --noEmit` type-checks nothing and exits 0 even on
broken code (empirically verified with an injected type error). Verify with `npx tsc -b` or `npm run
build`.

### [preview-pane, css-transitions, puppeteer] Puppeteer-preview tab freezes CSS transitions (2026-07-02, S1b) — read before verifying open/close animation state via the Claude-Preview pane

Puppeteer-preview tab freezes CSS transitions (found S1b, 2026-07-02): the Claude-Preview emulated tab
produces no frames — `preview_screenshot` times out and transition-driven styles (e.g. the case-study
overlay fade) stay stuck at their START value in `getComputedStyle`. Verify open/closed state via INLINE
style + DOM state (`el.style.opacity`, aria attributes, `location.pathname`), and take visual captures
with headless Edge (desktop widths) instead.

### [headless-edge, mobile-capture, window-clamp] Headless-Edge min-width clamp (2026-07-02, S1a) — read before trusting a sub-478px headless Edge capture

Headless-Edge min-width clamp (found S1a, 2026-07-02): on this machine `msedge --headless --screenshot
--window-size=390,844` lays the page out at ~478px wide (window min-width clamp; height honored;
`--force-device-scale-factor=1` and `--headless=new` don't help) and crops the PNG to 390 — producing a
FALSE "right-edge clip" on any sub-478 capture. Empirically verified: 600px request renders true-600;
emulated 390 viewport shows the bar fits exactly (Contact tab x 261–376, untruncated). The S1 review's
original "mobile 390 Contact clip" was likely this artifact; the S1a `minWidth:0`+ellipsis fix is kept as
harmless defensive CSS.

### [ci, node-version, github-actions] CI pins Node 22 (2026-07-02, S1a) — read before touching `.github/workflows/check.yml` or the Node version anywhere in this repo

CI pins Node 22 (fixed in S1a, PR #4, after a 24-vs-22 skew broke the build); `.github/workflows/check.yml`
runs `npm ci` → `verify:canon` → `npm test` → `npm run build` in that order.

### [full-review, router, mobile-clip, og-tags] 2026-07-02 full review baseline — read for the site's pre-redesign starting-state findings

2026-07-02 full review (source + live-render agents): single state machine no router (Back exits site) ·
mobile 390px Contact clip · OG-less SPA previews blank · placeholder banners on every case-study page ·
confidentiality sweep CLEAN incl. dist bundle. Detail in memory `project_portfolio_rpg_redesign.md`.

### [progression, defeated-bosses, persisted-state] `defeatedBosses` is the entire cross-fight progression surface (durable) — read before touching cross-fight progression state

`defeatedBosses: string[]` is the entire cross-fight progression surface. Hero max HP/MP (`100 + RIDER_HP
* length`), the ability kit (`deriveKit`), and fight routing (`deriveFightChoice`) are all pure functions
of it, derived per fight and never stored — so persisting that one array persists the whole game, and
corrupting it silently over-stats the hero with no error surface. Any read of it from outside the app must
re-validate through `coerceRushPrefix` (rush-order prefix, order-sensitive), never as a plain id set.

### [play-menu, gating, detail-panel, aria-disabled] Hiding a play-menu item means gating the detail panel (durable) — read before hiding or gating any play-menu row

Hiding an item from the play menu means gating the detail panel, not the row. `onMouseEnter` and arrow
keys both move `subIdx` (`App.tsx:912`), and the detail panel renders whatever `subIdx` points at — title,
meta, stat, body, tags. Masking only the row label leaves the content one hover away, and `aria-disabled`
prevents nothing. Same for the mobile sheet row's meta/stat.

### [vitest, test-config, test-include] A new test directory is invisible until `vitest.config.ts` says so (durable) — read before writing the first test in a new folder

A new test directory is invisible until `vitest.config.ts` says so. `test.include` is an explicit glob
list (battle-only as of M6), there is no jsdom/happy-dom/testing-library, and zero `.test.tsx` exist — so
a TDD red step in a new folder silently collects nothing. Add the glob before writing the first test, and
keep new modules pure with dependencies injected so they test under the node environment.

### [webfetch, spa, verification] WebFetch can't render this SPA (durable) — read before trying to verify this app via WebFetch

WebFetch can't render this SPA (title-only) — always verify via headless-Edge capture, never text-fetch.

### [canon-extraction, generated-code, asset-pipeline] Canon extraction is the only way boss/hero art enters the app (durable, since M1–M3a) — read before touching `docs/battle-prototypes/`, `tools/extract-canon.mjs`, or `src/generated/`

Canon extraction is the only way boss/hero art enters the app (M1–M2 built the labs, M3a built the
pipeline, every milestone since depends on it): the standalone labs in `docs/battle-prototypes/` are the
source of truth, `tools/extract-canon.mjs` carves VERBATIM two-anchor slices out of them into
`src/generated/`, and `npm run verify:canon` byte-compares the committed output against a fresh
extraction. Never hand-edit a generated module, never carve a partial slice (inert draft reels ride along
deliberately), and always run the free-identifier check on a new slice with comments stripped — a naive
grep false-positives on comments that name hero symbols.
