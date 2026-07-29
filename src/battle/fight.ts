// FIGHT submenu chooser derivation (M6 plan §App wiring, PR-1b task 5,
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md). Pure and
// side-effect-free so the chooser-row logic (defeatedBosses ∩
// IMPLEMENTED_BOSSES) is unit-testable without a DOM harness; App.tsx's
// keyboard arm and JSX render whatever this returns, never re-deriving it.
import { BOSS_NAMES, IMPLEMENTED_BOSSES } from "./rushOrder";

export interface FightRow {
  boss: string;
  label: string;
  isRematch: boolean;
}

export type FightChoice =
  | { mode: "direct"; boss: string }
  | { mode: "chooser"; rows: FightRow[] };

/** Next boss in rush order the player has not beaten, or undefined when the
 * rush is complete (M4 D11). Shared by deriveFightChoice and the intro dive
 * handoff (App.tsx onIntroHandoff) so the two can never disagree — before
 * this extraction, the dive handoff had no way to ask "what's next" without
 * re-deriving chooser logic this module's header forbids (dissect pass 2
 * F4: deriveFightChoice itself returns no next-undefeated-boss field once a
 * chooser exists, and returns nothing useful at all once every IMPLEMENTED
 * boss is beaten). */
export function nextUndefeatedBoss(defeatedBosses: string[]): string | undefined {
  return IMPLEMENTED_BOSSES.find((id) => !defeatedBosses.includes(id));
}

/** Next undefeated IMPLEMENTED boss on top (labeled, not a rematch) + every
 * already-defeated IMPLEMENTED boss below as a REMATCH row, in rush order
 * (plan §Cross-boss table: "Kit, FIGHT next-boss, and `boss=` whitelist all
 * intersect with IMPLEMENTED_BOSSES" — pass-2 G1's live-crash guard applied
 * to the FIGHT row too, so a boss beaten ahead of its own PR never grows a
 * row with no module behind it). A single resulting option direct-launches
 * with no chooser (fresh visitor = alert-storm direct); two or more open the
 * chooser. When every IMPLEMENTED boss is defeated, the chooser shows the
 * defeated roster only — no "next" row, per the plan's "defeated-roster only
 * when the next boss is not yet shipped". */
export function deriveFightChoice(defeatedBosses: string[]): FightChoice {
  const nextBoss = nextUndefeatedBoss(defeatedBosses);
  const rows: FightRow[] = [];
  if (nextBoss) rows.push({ boss: nextBoss, label: BOSS_NAMES[nextBoss], isRematch: false });
  for (const id of IMPLEMENTED_BOSSES) {
    if (id !== nextBoss && defeatedBosses.includes(id)) {
      rows.push({ boss: id, label: BOSS_NAMES[id], isRematch: true });
    }
  }
  // rows[0] is always defined here in practice (rows.length === 0 would need
  // IMPLEMENTED_BOSSES empty, which never happens — alert-storm is always
  // first); the `?? IMPLEMENTED_BOSSES[0]` fallback only exists so the return
  // type never needs a third "nothing to fight" mode over an impossible input.
  if (rows.length <= 1) {
    /* v8 ignore next -- unreachable, see comment above */
    return { mode: "direct", boss: rows[0]?.boss ?? IMPLEMENTED_BOSSES[0] };
  }
  return { mode: "chooser", rows };
}
