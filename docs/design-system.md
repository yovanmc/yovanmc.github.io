# Portfolio RPG — design system

> Durable reference for the site's visual language. **Start every design round from this file** rather than re-deciding tokens. Written at the S3 design phase (2026-07-30); extend it, do not fork it.
>
> Authority: this file records what is LOCKED. `ROADMAP.md` remains the authority on sequencing, and the base spec (`docs/superpowers/specs/2026-07-02-spectacle-and-battle-design.md`) remains the authority on hard constraints.

## Tokens (as shipped, read out of `src/styles/tokens.css` + `src/components/CaseStudyPage.tsx`)

### Surfaces
| Token | Value | Used for |
|---|---|---|
| page | `#070b18` | `html, body` |
| case-study field | `radial-gradient(ellipse 110% 90% at 50% 0%, #16284a 0%, #0a1124 52%, #060a16 100%)` | the case-study overlay |
| panel fill | `rgba(80,150,255,.1)` | back button, period chip, stack pills |
| card fill | `linear-gradient(160deg, rgba(20,40,78,.5), rgba(10,18,38,.45))` | metric cards |
| emphasis fill | `linear-gradient(100deg, rgba(80,150,255,.26), rgba(80,150,255,.06))` | primary outbound button |

### Borders
`rgba(140,185,255,.24)` hairline · `.26` chip · `.3` control · `.4` emphasis. Radii: `9px` chip · `11px` control · `13px` card · `18px` banner · `20px` pill.

### Text
| Token | Value | Used for |
|---|---|---|
| title | `#f2f6fc` | case-study title |
| primary | `#eaf1ff` / `#eaf2ff` | body root, metric values |
| body | `#c2cee2` | overview prose |
| accent | `#7fb0ff` | section labels, glyphs, arrows |
| accent-soft | `#9fc0ec` / `#aec6ee` / `#cfe0ff` | meta line, tags, control text |
| muted | `#8ea0bd` / `#7f93b8` | metric labels |
| dim | `#5f7196` | secondary chrome, unreached state |

### Type
- **Marcellus** (serif) — case-study titles `clamp(38px,8vw,62px)`, metric values `30px`.
- **Sora** — body prose `17px / 1.78`, max measure `680px`.
- **JetBrains Mono** — all chrome. Section labels `11px / .34em` uppercase, meta line `12px / .32em`, tags `12px`, metric labels `10.5px / .1em` uppercase.

Letter-spacing is the site's signature: mono chrome always carries `.1em` or wider, up to `.4em` on the category rail.

## S3 locked decisions (owner, 2026-07-30)

**Layout: D — compact head, figure below.** The full-width `PROJECT SHOT / DIAGRAM` banner is deleted. Deleting it *is* the compaction: the head is the existing meta line above the title, with the sigil mark added beside it when PR-C lands. Then the period chip and metric cards, then OVERVIEW, then the figure at full readable height with a caption, then STACK and the outbound links. **If PR-C is dropped, amend this paragraph** — the mark is the only part of the head that does not ship with PR-A, and a design doc describing a head the site never renders is the same divergence the ROADMAP decision log already records the cost of. Chosen over four alternatives because it is the only direction where the top of the page does not require a strong asset per project, which matters because two of six figures sit on confidentiality-shadowed material.

**Figure style: 4 (command-menu native) as the house style, 2 (terminal evidence) as a per-project override.** Figures are built from the tokens above so they read as the interface rather than as an embedded image, and they are **rendered from data, not shipped as image files**, so they reflow to a vertical stack on narrow viewports. An image cannot reflow, which is the same legibility failure the layout decision just fixed, one level down.

**Identity mark: a leaded-glass sigil per project**, in the station's glass vocabulary (see `2026-07-27-station-glass-design.md`). This is the only image-shaped asset in S3 and is deliberately the last thing built, so a stall in art production cannot block the milestone.

### Rejected in the S3 design round (do not re-propose without new information)
- **Diagram in the old banner slot.** `clamp(200px,46vw,340px)` is ~200px tall on a phone, and a real architecture diagram there is an unreadable thumbnail.
- **Leaded glass as the figure language.** Most on-brand of the options and the most expensive: six bespoke figures, and the thick came borders eat the space labels need at mobile width. Kept for the sigil only.
- **Blueprint schematic as the house style.** Most legible and cheapest, and the closest to a generic dark-mode diagram, which is the specific failure mode the design phase existed to avoid.
- **Terminal evidence as the house style.** Excellent where the story has a log shape, but MIA and Curio have none, so as a system it would force fabricated artifacts for a third of the roster.
- **No figures at all.** A real option rather than a strawman (a missing diagram beats a decorative one), rejected because the case-study page is where application links land.

## Figure vocabulary (new in S3)

Two figure kinds, both data-driven.

**`flow`** — the house style. Nodes are panel-fill boxes with mono uppercase labels at the site's letter-spacing, connected by `▸` in accent. Rows read left to right on wide viewports and stack top to bottom with `▾` connectors when the legibility floor would be breached.

**`log`** — the override. A mono block of channel/value lines. The one line carrying the finding is marked with a left rule in the fault tone. Everything else stays dim, so the eye lands on the evidence.

### Node tones
| Tone | Fill | Border | Text |
|---|---|---|---|
| `default` | `rgba(80,150,255,.1)` | `rgba(140,185,255,.24)` | `#aec6ee` |
| `fix` | emphasis fill | `rgba(140,185,255,.4)` | `#eaf2ff` |
| `fault` | `rgba(255,110,80,.12)` | `rgba(255,139,107,.5)` | `#ffb9a3` |
| `muted` | `rgba(80,150,255,.04)` | `rgba(140,185,255,.12)` | `#5f7196` |

`fault` is the only new colour family S3 introduces to the site. It exists so a diagram can say "this is where it broke" without prose, and it is reserved for that meaning.

## Binding rules for every figure

1. **Labels are not new prose.** Every node label must be a bare technical noun, and every log channel and value must be synthetic technical output rather than a sentence. This keeps hard constraint 1 (owner voice) untriggered exactly the way M4 kept it untriggered: ship the mechanism over prose already approved. New sentences require an owner interview, not agent drafting. **Figures no longer carry captions at all (owner ruling 2026-08-02, PR #49)** — the caption field, its six values, the rendered element and the caption-provenance test are gone, because the owner found the captions parroted the prose they were drawn from. The figure's bordered box is what closes the block visually, verified across 18 captures at four widths. A figure's accessible name is now derived from the project title (`accessibleNameFor` in `src/figures/`), never hand-written, so no per-figure string needs owner provenance. **Do not reintroduce a caption without an owner ruling**, and if one ever returns, the verbatim-fragment rule returns with it.
2. **Punctuation rule applies.** No em dashes, no en dashes, no semicolons in any figure string, same as every other user-facing string on the site.
3. **Confidentiality gate is per asset.** Every node label, log line, screenshot and sigil passes the standing private checklist before commit. Node labels are a leak surface: internal service names, team names and service counts never appear. UWM-sourced figures stay at an altitude where the diagram would be true of any company.
4. **Legibility rests on a measurement and a human, never on arithmetic.** The layout module owns the reflow decision, but its constants are measured against a real render of the site's real typeface and pinned to a committed fixture, because a test asserting "the node is at least as wide as the minimum" is an algebraic identity that passes for any value of the minimum. Both critique passes of S3 caught a version of that mistake. The chain that actually works is: measure the type metrics, derive every cap from them, sweep orientation in the container domain, and then look at the rendered result at desktop **and** emulated mobile widths. A geometry check proves nothing overflows. It cannot see whether the result is ugly.
5. **Every width in the figure system is a content-box width**, because that is what `ResizeObserver` reports. Never subtract the figure's own padding inside a layout function.
