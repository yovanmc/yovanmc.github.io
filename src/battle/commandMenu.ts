// Pure command-menu model (M12 plan, PR-A Task A1,
// docs/superpowers/specs/2026-07-30-m12-command-menu-plan.md). Replaces
// BattleScene.tsx's flat `cmdIdx` cursor with a nested top/skills/spells
// state machine. No React, no DOM: every dependency (commands, mp) is
// injected so this can be unit-tested directly under the node environment.
// PR-B wires this into BattleScene.tsx; PR-A ships it exercised only by
// tests (commandMenu.test.ts).
import type { AbilityCommand } from "./abilities";

export type MenuLevelId = "top" | "skills" | "spells";
export type MenuInput = "up" | "down" | "confirm" | "back";

/** Owner ruling 1 (2026-07-30): fixed partition of the full kit into the two
 * submenus. Attack stays outside both (BASE_KIT, always at the top level). */
export const SKILLS_IDS: readonly AbilityCommand["id"][] = ["ct", "pt", "debug"];
export const SPELLS_IDS: readonly AbilityCommand["id"][] = ["fo", "rb", "rc", "conv"];

// Owner-overridable string defaults (Task A1 rule 6). Punctuation rule is
// HARD (no em dash, no en dash, no semicolon). commandMenu.test.ts pins
// this with the same assertion pattern as scenes/punctuation.test.ts.
const SKILLS_LABEL = "Skills";
const SKILLS_DESC = "Core moves. Always ready.";
const SPELLS_LABEL = "Spells";
const SPELLS_UNLOCKED_DESC = "Spells won from fallen bosses.";
const SPELLS_LOCKED_DESC = "Sealed until a boss falls.";
const SKILLS_TITLE = "SKILLS";
const SPELLS_TITLE = "SPELLS";

export interface CategoryRow {
  kind: "category";
  id: "skills" | "spells";
  label: string;
  desc: string;
  locked: boolean;
}
export interface AbilityRow {
  kind: "ability";
  cmd: AbilityCommand;
}
export type MenuRow = CategoryRow | AbilityRow;

export interface MenuView {
  level: MenuLevelId;
  /** Breadcrumb title for submenus ("SKILLS" / "SPELLS"); null at top. */
  title: string | null;
  rows: MenuRow[];
}

export interface MenuState {
  level: MenuLevelId;
  cursor: Record<MenuLevelId, number>;
}
export const initialMenuState: MenuState = { level: "top", cursor: { top: 0, skills: 0, spells: 0 } };

export type MenuEffect =
  | { type: "moved" } // cursor changed -> playMove
  | { type: "descend" } // entered a submenu -> playEnter
  | { type: "ascend" } // submenu -> top -> playBack
  | { type: "pause" } // back at top level -> open pause, playBack
  | { type: "blocked" } // locked category or unaffordable ability -> playBack
  | { type: "cast"; cmd: AbilityCommand }; // caller handles needsTarget/commit

/** Rule 1 (partition): top level is always exactly 3 rows (attack, Skills,
 * Spells). Rule 2 (locked teaser): the Spells row is locked whenever the kit
 * carries zero SPELLS_IDS entries, its desc switches to the locked hint and
 * no spell name is ever present in that row. Skills is never locked. */
export function deriveMenuView(commands: AbilityCommand[], level: MenuLevelId): MenuView {
  if (level === "top") {
    const attack = commands.find((c) => c.id === "attack")!; // BASE_KIT: always present
    const hasSpell = commands.some((c) => SPELLS_IDS.includes(c.id));
    const rows: MenuRow[] = [
      { kind: "ability", cmd: attack },
      { kind: "category", id: "skills", label: SKILLS_LABEL, desc: SKILLS_DESC, locked: false },
      {
        kind: "category",
        id: "spells",
        label: SPELLS_LABEL,
        desc: hasSpell ? SPELLS_UNLOCKED_DESC : SPELLS_LOCKED_DESC,
        locked: !hasSpell,
      },
    ];
    return { level, title: null, rows };
  }
  if (level === "skills") {
    const rows: MenuRow[] = commands
      .filter((c) => SKILLS_IDS.includes(c.id))
      .map((cmd) => ({ kind: "ability" as const, cmd }));
    return { level, title: SKILLS_TITLE, rows };
  }
  const rows: MenuRow[] = commands
    .filter((c) => SPELLS_IDS.includes(c.id))
    .map((cmd) => ({ kind: "ability" as const, cmd }));
  return { level, title: SPELLS_TITLE, rows };
}

/** Rule 3 (navigation) and rule 4 (cursor memory): up/down move ONLY the
 * current level's cursor (wrap, same idiom as today's flat menu); confirm on
 * a category switches `level` (never touches any cursor); confirm on an
 * ability yields `cast` (MP-affordable) or `blocked` (not) with state
 * unchanged either way (the caller drives mode/commit); back ascends from a
 * submenu (state's `level` -> "top", cursor untouched) or pauses at top
 * (state unchanged). */
export function menuReduce(
  menu: MenuState,
  input: MenuInput,
  commands: AbilityCommand[],
  mp: number,
): { menu: MenuState; effect: MenuEffect } {
  const rows = deriveMenuView(commands, menu.level).rows;
  const cursor = menu.cursor[menu.level];

  if (input === "up" || input === "down") {
    const dir = input === "up" ? -1 : 1;
    const len = rows.length;
    const next = len === 0 ? 0 : (cursor + dir + len) % len;
    return { menu: { ...menu, cursor: { ...menu.cursor, [menu.level]: next } }, effect: { type: "moved" } };
  }

  if (input === "back") {
    if (menu.level === "top") return { menu, effect: { type: "pause" } };
    return { menu: { ...menu, level: "top" }, effect: { type: "ascend" } };
  }

  // confirm
  const row = rows[cursor];
  if (!row) return { menu, effect: { type: "blocked" } };
  if (row.kind === "category") {
    if (row.locked) return { menu, effect: { type: "blocked" } };
    return { menu: { ...menu, level: row.id }, effect: { type: "descend" } };
  }
  if (mp >= row.cmd.mp) return { menu, effect: { type: "cast", cmd: row.cmd } };
  return { menu, effect: { type: "blocked" } };
}
