# Heart-station glass — locked design v1

Owner-approved 2026-07-27. This is the full-resolution stained-glass design for the heart-station: the platform the Dive to the Heart intro (milestone 2) lands on, and the source design the pixel battlefield (`battlefield.html`, spec `2026-07-27-battlefield-system.md`) echoes at scene scale. The working lab is `docs/battle-prototypes/station-glass.html` — a self-contained page; open it in a browser to render the canon.

The station ships **figure-less** for the initial release ("awaiting its figure") — a commissioned artist pass adds the central figure later.

## Locked geometry (master radius R, field radius 0.63R)

1. **Moon-phase rim** (r 0.90–1.0): 24 cells with alternating deep fills, each holding a leaded moon disc. Eight phases × three full cycles, new moon at 12 o'clock, phases in order clockwise. The new-moon disc intentionally matches the even-cell glass and reads as an outline ring.
2. **Bead ring** (r 0.80–0.90): 48 beads, alternating pale (larger) and deep violet (smaller).
3. **Binary chain** (r 0.63–0.80): 27 touching pale medallions sized to fit the band exactly, each rotating with its clock position (upright at 12, fully inverted at 6). Glyphs are binary digits counting upward (0, 1, 10, 11, 100, …), one digit per medallion clockwise from the top, drawn as paths (no font dependency).
4. **Backing disc**: radius 178 units, centered so its top edge sits exactly on the r = 0.80R lead line — it overlaps only the inner field and the binary band. Deep violet glass with double gold hairlines.
5. **Bond cluster** on the disc: seven medallions in a hexagonal perfect pack (center distance = 2r + one stroke width, so the leads kiss with zero overlap). Center: manga/comics. Ring clockwise from top: graduation cap, music, video games, basketball, this portfolio (recursive rings), terminal cursor.
6. **Field**: New York sunset backdrop in the Station-of-Serenity mechanic — true gradients inside leaded cels, hairline leads, no clouds. Max-detail pass locked: recognizable skyline silhouettes with four depth layers, rooftop furniture (water towers, AC units, parapets, antennas with beacons), a suspension bridge with necklace lights and gothic pylon arches, first stars in the side sky pockets, bird flocks; water carries building reflections, a widening sun-glitter fan, necklace and beacon reflections, a ferry with wake, wave leads, and a white sun core under the horizon.

## Construction rules

- All randomness is hash-based — zero `Math.random`; the render is fully deterministic.
- **Renderer-compat rule:** annular band fills use a plain thick-stroked circle, never the degenerate-arc trick (a full-circle arc with a ~0.01-unit chord). Some SVG renderers miscompute that arc's center and paint a giant stray disc offset from the design (caught live 2026-07-27).
- Tall skyline elements sit at the field's sides where the sky is open; the center skyline stays low and backlit against the sun glow. One spire deliberately tucks behind the backing disc for depth.

## Deferred / open items

- Medallion emblem style lock (geometric sigil vs pictorial vs sketch-linework) — judged against the finished glass.
- Ring motif revisit pass (owner-flagged: geometry locked, motifs may still evolve).
- Artist figure pass (central figure).
- Corruption variants re-derived against this glass; pixel-battlefield re-derivation (gradients → sequenced palette steps).
