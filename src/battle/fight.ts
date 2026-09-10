// FIGHT submenu chooser derivation. Pure and side-effect-free so the
// chooser-row logic (defeatedBosses ∩
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
 * rush is complete. Shared by deriveFightChoice and the intro dive handoff
 * (App.tsx onIntroHandoff) so the two can never disagree: deriveFightChoice
 * exposes no next-undefeated-boss field once a chooser exists, and nothing
 * useful at all once every implemented boss is beaten, so callers that need
 * just "what is next" ask here instead of re-deriving chooser logic. */
export function nextUndefeatedBoss(defeatedBosses: string[]): string | undefined {
  return IMPLEMENTED_BOSSES.find((id) => !defeatedBosses.includes(id));
}

/** Next undefeated IMPLEMENTED boss on top (labeled, not a rematch) plus
 * every already-defeated IMPLEMENTED boss below as a REMATCH row, in rush
 * order. Rows only ever come from IMPLEMENTED_BOSSES, the same set kit
 * derivation and the `boss=` whitelist intersect with, so a row can never
 * point at a boss with no module behind it. A single resulting option
 * direct-launches with no chooser (a fresh visitor goes straight to
 * alert-storm); two or more open the chooser. When every IMPLEMENTED boss is
 * defeated, the chooser shows the defeated roster only, with no "next" row. */
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
