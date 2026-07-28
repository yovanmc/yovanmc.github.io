# Dive to the Heart — intro sequence, approved design v1

Owner-approved 2026-07-28 (milestone 2 of the backlog). The working lab is `docs/battle-prototypes/dive-intro.html` — a self-contained page; open it in a browser to play the sequence. The intro brings a visitor from site entry down onto the heart-station (`station-glass.html`, spec `2026-07-27-station-glass-design.md`) and hands off to the site UI.

## The sequence (~14 s to settle, skippable from frame one)

Two shots with a hard cut, timeline in ms:

1. **Shot 1 — frontal, falling with the hero (0–4700).** Void with slanted light rays and motes streaming upward (rising motes = falling camera). The pixel hero — the battle sprite, rendered from its real grid — hangs INVERTED in frame, drifting side to side like sinking through water. The sprite holds a single frozen frame for the whole fall (owner rule: no limb animation until landing). A warm glow builds at the bottom edge as the station nears.
2. **Cut to shot 2 — bird's eye (4700).** The station art's natural face-on view. The covered station (14% opacity dim layer) grows from 0.6× to full as the hero shrinks away from the camera toward it, still inverted, a shadow tightening beneath him.
3. **Flip and slow touchdown (6600–8400).** The hero rotates 180° to feet-first just before contact (flip completes at 7800), then floats the last stretch down. Feet land exactly on station center at 8400.
4. **Bird-burst reveal (8400–12300).** Triple expanding ripple from the landing point; 48 birds release CONTINUOUSLY in a spiral (one every ~67 ms, rotating emission angle, curved outward arcs, two-frame wingbeat) while the lit station is revealed by an expanding clip-circle from the landing point — the KH dove-burst mechanic. Peak ~35 birds airborne.
5. **Atmosphere handoff (12300–13600).** The live site's `Atmosphere` ambience fades in over the scene: both aurora glows and all 54 particles generated with the identical Park–Miller `rng(29)` sequence and the `tokens.css` keyframes ported 1:1 (`-108vh` → stage px). The end frame wears the site's ambient look before any UI appears.
6. **Menu (13000–13600).** Command-menu placeholder rises bottom-left; the hero stays standing at station center, idling on his two real idle frames. End state holds.

## Owner decisions (locked for this milestone)

- Direction: "the plunge" (watched fall), upgraded through four motion-plan gates: two-shot POV structure, inverted Sora-style fall with last-moment flip, slow floating touchdown, continuous spiral bird burst.
- The faller is the battle hero sprite; side-view sprite on the face-on glass is the deliberate JRPG map-sprite convention (same pairing as the battlefield).
- No sprite limb animation during the fall; idle starts only after touchdown.
- **Repeat visits: the full intro plays every visit** (skip always available). The game/portfolio split at entry is milestone 3 and attaches after this sequence; nothing here forecloses it.
- The end state must match the site's Final Fantasy ambience (Atmosphere component); enhancement of that ambience is a deferred later pass.

## Construction and verification (extends BUILDING.md)

- **Locked assets are extracted, never retyped:** the lab embeds the `station-glass.html` builder function and the battlefield's hero grids + palette verbatim (`build-dive.js` pattern — regex-extract from the repo files, token-substitute into the template). Two station copies (dim + lit) with id-suffixed defs; the lit copy is clipped by the reveal circle.
- **Pure deterministic timeline:** all choreography lives in `computeState(t)` inside `<script id="pure">` — no DOM access, no `Math.random`, no `Date`. Bird parameters are index-derived. Node audits eval the pure block standalone.
- **`?t=<ms>` freeze parameter** renders any exact frame statically — deterministic headless screenshots of any beat.
- **Skip** (click or any key) jumps to the end state; **`prefers-reduced-motion`** renders the end state statically.
- Audits (29, all passing at merge): sprite integrity vs source grids, bird spacing/angles, no-NaN sweep, monotonic reveal and atmosphere fades, flip-before-touchdown, feet-on-center, frame-frozen-until-touchdown, end-state stability, tone-vs-void contrast ≥40. Render gate: headless-Edge screenshots at five beats, green marker + JSERROR banner check, independent reviewer verdict with pixel-coordinate evidence.
- Renderer-compat rule inherited from the station spec: band fills are thick-stroked circles; never the degenerate-arc annulus trick.

## Deferred / open items

- Final Fantasy ambience enhancement pass (owner-flagged at approval).
- Integration into the React site (mount as the entry sequence; swap the atmosphere layer for the real `Atmosphere` component; real command menu replaces the placeholder).
- Game/portfolio split at the handoff (milestone 3).
- Optional: snappier 3-step pixel flip if the smooth rotation reads floaty at integration scale.
