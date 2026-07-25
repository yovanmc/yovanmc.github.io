# Milestones backlog — from battle prototypes to shipped game

Owner-ordered backlog, captured 2026-07-25 at the close of the battle-animation design sessions. This is the sequence; each milestone gets its own design/plan pass when it starts. The sprite/animation pipeline that everything below builds on is documented in `docs/battle-prototypes/BUILDING.md` — that file plus the lab HTMLs are the persistence layer, and any new sprite work MUST follow it (grid-as-data, shared palette, auto-outline re-posting, Node-audit verification, owner approval loop) so the visual consistency achieved in these sessions is never re-derived from scratch.

## Carried asset backlog (precedes or joins the first milestone)

- **Per-spell impact VFX** layered on top of the enemy for each hero ability. Standing rule: the spell gets the special animation at the target; the enemy itself only flashes or flinches (their own hit frames already exist).

## Milestone sequence

1. **Battlefield redesign** — redesign the battle scene itself (arena, backdrop, framing) that the finished hero and boss sprites fight in.
2. **Dive to the Heart** — an animation sequence (falling/descent intro in the style the name implies) leading into the battle experience.
3. **Game / portfolio separation** — a visitor who doesn't want to play must be able to review the experience/work section directly. Two clean paths from entry: play the game, or browse the portfolio straight.
4. **Lore** — stories and experience unlock as the game progresses; playing reveals the owner's real work history as collectible/unlockable lore rather than static pages.
5. **Bosses for every work section** — as more work, experience, and stories are added, each section gains its own boss. The palette-swap and remap recipes in BUILDING.md make new bosses cheap; new content and new bosses grow together.
6. **Rebalancing** — after all content is in: tune the full boss rush end to end; consider a store or XP-based upgrades as the balancing lever.
7. **Dialogue** — in-battle and story dialogue, written last so it covers the final cast and lore.
8. **Productionize** — full review and critique pass over the complete game, fix what it surfaces, then ship the final product.

## Ordering rationale (owner-stated)

Content-shaped milestones (lore, section bosses) come before balance and dialogue because both depend on the final roster and story set; productionize is last and is a distinct review→critique→ship gate, not a cleanup afterthought.
