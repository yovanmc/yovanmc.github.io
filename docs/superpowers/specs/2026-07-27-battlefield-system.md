# Battlefield system — glass platform, corruption variants, erosion

Owner-approved design, 2026-07-27. Extends `2026-07-25-battle-gameplay-addendum.md`. The working lab is `docs/battle-prototypes/battlefield.html`; the scene construction method is documented in `docs/battle-prototypes/BUILDING.md` §7.

## The system

The battle arena is a single place: a stained-glass platform floating in the void — the heart-station the Dive to the Heart sequence (milestone 2) will land on. It has three states:

1. **Pure base** — the standard look. Came-bounded stained-glass panes in the site's void blues, gold cames and rim, a gold center core, light shafts, rising motes, faceted side.
2. **Corrupted** — when a boss battle begins, the boss corrupts the platform into its own variant (end states below). The corruption *transition* animation (the sweep from pure to corrupted at battle start) is a deferred asset, designed after the detail pass.
3. **Eroding** — the finale only. Imposter Syndrome's fight runs on the fully corrupted platform, and the corruption recedes as the boss loses HP (HP-linked, not turn-based): ring by ring from the center outward, glitch calming in step, until at 0 HP the platform is pixel-identical to the pure base. Beating the final boss restores the heart-station.

## Corruption end states (approved wireframe fidelity; detail pass upcoming)

- **Alert Storm** — panes stained red in a noise pattern, rim glints run hot, glass cracks from an impact point, wing silhouettes circle in the void, motes fall as embers. Light shafts gone.
- **The Cascade** — chain links clamped around the rim, a traveling gold pulse lighting the outer ring's sectors in alternation, scorched panes, the void topology constellation lit.
- **The Silent Failure** — panes missing outright (void visible through the holes), chunks gone from the disc side, light shafts and motes dead. Glass under both combatants' footing always survives.
- **Imposter Syndrome** — all glass remapped to the corruption purples, cames cracked to red, glitch band displacement and static across the scene, purple motes. This is also erosion stage 0.

The corruption purples (`j`/`k` in the shared palette) appear in no other variant — they are reserved for corruption semantics, and the lab's audits enforce it.

## Interaction with the remaining asset backlog

Per-spell impact VFX (carried item) land on the enemy standing on the disc; the platform participates per-variant — cracks and ripples in the glass are the environmental echo layer. These are designed alongside the detail pass.

## Deferred / open items

- Detail pass on the glass itself (thicker disc or higher-res disc layer, per-pane bevels, pictorial center emblem) — owner-stated next workstream.
- Corruption-sweep transition animation per boss.
- Re-verify the arena's boss zone against Alert Storm's ten-bat swarm footprint (widest boss).
- Boss facing/mirroring is resolved per boss at engine time; the lab uses the Silent Failure model as its scale stand-in.
