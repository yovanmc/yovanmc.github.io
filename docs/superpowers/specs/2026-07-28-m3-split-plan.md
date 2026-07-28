# Milestone 3 — game/portfolio separation + intro integration (plan v2)

Owner-gated plan, drafted 2026-07-28, revised same day after a full dissect pass (16 findings + 6 minors folded in; blast-radius tier raised to HIGH — auto-deploy repo, no staging, front-door rewrite). Design direction picked from four wireframes: **"the gate"** — an explicit two-path choice at the intro's handoff — with the skip-adjacent "portfolio only" control folded in.

## Owner rulings (locked before this plan)

- **Intro integration is in M3 scope.** The dive-intro lab is ported into the React site per BUILDING.md §8.
- **Fork = the gate**: two labeled paths at the handoff. Skip lands ON the gate, never past it.
- **Skip-adjacent escape**: "portfolio only" beside the skip hint jumps straight to browse.
- **Deep links bypass the intro** (intro-every-visit governs root entry only). Closing a deep-linked case study lands in browse.
- **No content gating.** Lore/unlocks are milestone 4.
- Supersession note: the intro-every-visit ruling (M2, 2026-07-28) supersedes ROADMAP.md's older "repeat-skip" motion non-negotiable; recorded here so the contradiction is explained.

## Roadmap reconciliation (owner ruling required before build)

`ROADMAP.md` (S-series, 2026-07-02) declares a FREEZE after S3 pending the career C1 OA gate, and assigns "v1 faked dive" to S5. The owner-ordered M-series backlog (2026-07-25) is the newer sequence and M3 was explicitly ordered started 2026-07-28 — but M3 is the first M-milestone to touch `src/` and ship live. Required ruling: M3 pierces the freeze, and the dive shipping here supersedes the S5 line. On confirmation, the M3 PR adds an M-series row to `ROADMAP.md` recording both.

## Delivery structure — two PRs (dissect F11)

- **PR-A — station canon swap, standalone.** `Station.tsx` re-points to the extracted locked canon; old `buildStationSvg.ts` deleted; before/after captures of the same keys. Ships first so PR-B's captures have a stable baseline and either change can be reverted alone.
- **PR-B — intro + split.** Everything below.

## Architecture — App phase machine

`App.tsx` gains a top-level phase: `intro → gate → play | browse`.

- **intro** — `DiveIntro` plays the full sequence. Skip (click / any key except Tab) → gate. "Portfolio only" (stopPropagation) → browse. `prefers-reduced-motion` → static end state + gate immediately.
- **gate** — appears at T≈13600 (menu-rise beat, per m5), replacing the lab's menu placeholder: identity block + two in-world buttons **Enter the game** / **View the work**. Keyboard ←/→/Enter; blip synth wired. Replaces the old un-booted splash.
- **play** — today's booted experience. Esc past menu root → gate.
- **browse** — one scannable index panel over the dimmed scene: three section headers (Work / Experience / Contact), every item visible, rows reuse `activate()`/`openPage()` semantics verbatim (contact rows copy/link, no fake pages; slug-less items never link to pages). Mobile reuses the existing sheet pattern. "Enter game ▸" cross-link. Esc → gate. *Deviation from wireframe: tabs collapsed to one flat index (thinner, ctrl-F-able, no second nav surface to desync — dissect F16); owner veto point at the capture gate.*
- **Geometry seam (dissect F3)** — one added integration beat after atmosphere handoff: the stage scene settles (transform-animates) so the station lands exactly at the site's hero geometry (680 box, top 40% / 31% mobile). After the settle, gate/play/browse all share site coordinates — no snap on "Enter the game". Verified by a bounding-rect equality assertion across the gate→play transition, not screenshots.

### Path ↔ phase table (dissect F6/F7 — every arm explicit)

| Situation | Result |
|---|---|
| `/` initial load | intro |
| `/` via popstate | phase recorded in that history entry's state object (never intro replay) |
| `/browse` | browse index, no intro |
| `/work\|/experience/<slug>` initial | browse + page open, no intro |
| unknown path | 404.html stashes `location.pathname` in sessionStorage → `replace("/")` → boot restores it BEFORE the phase decision (restored deep link bypasses intro) |
| close deep-linked/browse-opened page | pushState `/browse` (not `/`) |
| close play-opened page | pushState `/`, phase stays play (from history state) |

### Per-phase input table (dissect F5 — global handlers phase-gated)

| Input | intro | gate | browse | play |
|---|---|---|---|---|
| Click (non-control) | skip → gate | — | — | un-boot → gate |
| Esc | skip → gate | — | → gate | back-walk → gate |
| Arrows/Enter/Space | skip → gate | button nav/select | row nav/open | menu nav (as today) |
| Tab | native focus (never skips) | native | native | native |
| Mobile command bar | hidden | hidden | hidden | visible |
| Mobile sheet | hidden | hidden | own list | as today |

## Asset canon (BUILDING.md §8 — extraction contract, dissect F1/F2/m1/m3)

- Source of truth: `station-glass.html` (station canon) and `dive-intro.html` `<script id="pure">` (whole block — includes `clamp01`/`easeOut`/`easeIO`/`SCX`/`SCY`, no symbol cherry-picking).
- `tools/extract-canon.mjs` applies a **specified transform, re-runnable byte-for-byte**: exact start/end anchors; strip the two trailing DOM writes from the station script; wrap as `buildStationCanon(idSuffix = ""): string` returning a full `<svg viewBox="-510 -510 1020 1020">`; id-suffix list (`fcL`,`skL`,`wtL`) as data for the dim/lit pair.
- Output: `src/generated/*.js` + hand-written `.d.ts`, with a `// @ts-nocheck`-style generated header; "verbatim" means verbatim **below the header** (strict TS cannot compile the lab JS — F1). All extracted symbols exported.
- `npm run verify:canon` re-runs the transform and diffs below-header content — **and** asserts `dive-intro.html`'s embedded station copy still matches canon under the same transform (3-copy drift guard, F15). Wired into CI on PRs (deploy workflow gains the check), not just convention.
- `Station.tsx` adapts to the canon viewBox; existing dim/scale behavior preserved.

## DiveIntro port

- Desktop: 1152×648 stage, contain-fit, lab coordinates preserved through the reveal; then the settle beat (above).
- **Mobile (dissect F8)**: cover-fit crop centered on the station — full-height framing, choreography (`computeState`) untouched, honoring the BINDING mobile-light rule by framing rather than redesign. Gate controls render in site space (full-size, stacked), never inside the scaled stage. If the mobile perf check fails, bird rendering (not the timeline) degrades on mobile only.
- rAF + `applyState` via refs; StrictMode-safe teardown.
- **Atmosphere (dissect F14)**: the lab's cloned stage-px atmosphere layer is kept through the intro (preserving the locked 1:1 port); the real viewport `<Atmosphere/>` cross-fades in at the gate.
- **Capture keys (dissect F12)**: `?t=<ms>` frozen frame (with skip listeners installed — a frozen frame must still be escapable) plus `?phase=gate|browse|play` deterministic entry, dev/capture-guarded.

## Router / share shells

- `/browse` client-side; `shareShells` writes `browse/index.html`. Shell assert keeps its discriminating power: slug-shell count stays `=== 8`, browse shell checked separately (m2).
- `404.html` becomes the path-preserving stash described in the path table (F6).

## Copy (draft — final wording on the built gate screen)

Gate: "Enter the game" / "View the work". Intro corner: "skip ▸" + "portfolio only ▸".
**Identity block (dissect F10):** the canon station's upper-center is occupied art (medallion cluster) — the old "name sits in clear sky" layout dies with the old builder. Proposed: identity sits below the disc at the gate, scrim-free; final placement is an owner veto at the gate composition capture.

## Out of scope

Battle engine in-site; lore/unlocks (M4); FF-ambience enhancement; dialogue; per-spell VFX; S7 3D dive.

## Verification (goal-driven, in order — instruments per repo conventions)

1. `npm run verify:canon` clean (includes lab-copy drift guard).
2. Timeline parity audit (Node): generated `computeState` ≡ lab at sampled timestamps. *(Extractor check only — not counted as port coverage.)*
3. **Render-port assertions (dissect F13)**: per-beat DOM state (element inline transforms/opacities, bird count, atmo opacity) asserted against `computeState(t)` at the same `t`, via emulated-viewport eval — one assertion per `st.*` key.
4. `npm run build` passes; `npm run preview` smoke-checked pre-merge (m6).
5. Desktop captures (headless Edge 1440, pinned cheap subagent, text verdicts): 5 intro beats via `?t=`, gate, browse, play, deep-linked page. PR-A supplies the station-swap before/after baseline.
6. **Mobile (dissect F9 — repo-recorded instrument constraints)**: NO raw sub-478 headless captures; emulated-viewport DOM measurement instead (stage rect, scale factor, letterbox/crop numbers, gate button hit-rects, inline-style states). Real-phone check by owner = named desk debt.
7. Interactive gate (dev server, driven browser): gate→play, gate→browse→case study→close→browse, skip mid-intro, portfolio-only mid-intro, keyboard per the input table, browser back/forward per the path table, deep-link bypass, gate→play station bounding-rect equality.
8. Confidentiality 3-lens panel (pinned sonnet) over the full publish surface.
9. Owner approval → branch → PR → merge → Pages deploy → live spot check. **Rollback line:** revert the merge commit on main; Pages redeploys the revert (~2 min exposure floor — reason for the two-PR split).

## M3c addendum — intro moved behind the play button (owner ruling 2026-07-28, post-ship)

Owner ruling, same day M3b shipped, superseding M2's "full intro every visit":
**root entry lands directly on the gate; the cinematic plays when "Enter the
game" is chosen.** Consequences applied:

- Entry gate shows the lit station + identity + both buttons, **no hero** — the
  hero only stands on the glass after the dive brings him there (he persists at
  the gate afterward, `hasDived`).
- "Enter the game" → full cinematic → the menu rises at the handoff (the lab's
  original ending, now literal). Skip lands in play. Reduced-motion = instant play.
- The intro runs on the **first play-entry per page load**; re-entries within
  the same load go straight to the menu. A fresh visit dives again.
- The skip-adjacent "portfolio only" control is removed — the visitor already
  chose the play path; browse stays one Esc away.
- Deep links, `/browse`, and the path table are unchanged; `?t=` still boots
  straight into a frozen cinematic frame for captures.
- **Reduced-motion exemption (owner ruling 2026-07-28, second same-day
  addendum):** `prefers-reduced-motion` does NOT suppress this cinematic — it
  is solicited motion (explicit "Enter the game" click, skip one keypress
  away). The reduce flag still governs unsolicited/ambient site motion.
  Context: Windows with "Animation effects" off reports reduce browser-wide
  (empirically verified via `SPI_GETCLIENTAREAANIMATION` on the owner's own
  machine), so honoring it here silently hid the cinematic from a large
  technical audience. This narrows M2's "reduced-motion renders the end state
  statically" rule to the era when the intro was unsolicited at entry. The
  `?motion=` capture key is removed (its only purpose was bypassing reduce in
  verification).

## Known risks

- Station swap changes the hero art site-wide — isolated in PR-A with its own baseline for exactly this reason.
- Mobile intro is a framing compromise (cover-crop) on the most common device class; real-device verdict is desk debt until the owner looks.
- The settle beat is new choreography not in the locked lab; it is integration glue the M2 spec anticipated ("mount as the entry sequence"), owner-vetoable at the capture gate.
