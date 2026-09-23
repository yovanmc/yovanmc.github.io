// FIGHT chooser derivation, pure. App.tsx renders whatever this returns and
// never re-derives it.
import { BOSS_NAMES, IMPLEMENTED_BOSSES } from "./rushOrder";

export interface FightRow {
  boss: string;
  label: string;
  isRematch: boolean;
}

export type FightChoice =
  | { mode: "direct"; boss: string }
  | { mode: "chooser"; rows: FightRow[] };

/** Next boss in rush order not yet beaten, or undefined once the rush is
 * complete. Shared by deriveFightChoice and the dive handoff so they never
 * disagree. */
export function nextUndefeatedBoss(defeatedBosses: string[]): string | undefined {
  return IMPLEMENTED_BOSSES.find((id) => !defeatedBosses.includes(id));
}

/** The next undefeated implemented boss on top, then every defeated one as a
 * REMATCH row, in rush order. Rows come only from IMPLEMENTED_BOSSES, so none
 * points at a boss with no module. One option launches directly (a fresh
 * visitor goes straight to alert-storm); two or more open the chooser. With
 * every boss defeated there is no "next" row. */
export function deriveFightChoice(defeatedBosses: string[]): FightChoice {
  const nextBoss = nextUndefeatedBoss(defeatedBosses);
  const rows: FightRow[] = [];
  if (nextBoss) rows.push({ boss: nextBoss, label: BOSS_NAMES[nextBoss], isRematch: false });
  for (const id of IMPLEMENTED_BOSSES) {
    if (id !== nextBoss && defeatedBosses.includes(id)) {
      rows.push({ boss: id, label: BOSS_NAMES[id], isRematch: true });
    }
  }
  // rows is never empty (alert-storm is always implemented); the fallback
  // only keeps the return type free of a "nothing to fight" mode.
  if (rows.length <= 1) {
    /* v8 ignore next -- unreachable, see comment above */
    return { mode: "direct", boss: rows[0]?.boss ?? IMPLEMENTED_BOSSES[0] };
  }
  return { mode: "chooser", rows };
}
