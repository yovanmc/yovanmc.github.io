// Pure command-menu model. M12 plan PR-A Task A1
// (docs/superpowers/specs/2026-07-30-m12-command-menu-plan.md). No React, no
// DOM: every dependency (commands, mp) is injected.
import { describe, expect, it } from "vitest";
import {
  deriveMenuView,
  initialMenuState,
  menuReduce,
  type MenuState,
} from "./commandMenu";
import { commandsForKit } from "./abilities";
import { deriveKit } from "./engine";
import { RUSH_ORDER } from "./rushOrder";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";
const SEMICOLON = "\u003B";
const BANNED = new RegExp(`[${EM_DASH}${EN_DASH}${SEMICOLON}]`);

const FULL_KIT = commandsForKit(["attack", "ct", "pt", "debug", "fo", "rb", "rc", "conv"]);
const BASE_KIT_COMMANDS = commandsForKit(["attack", "ct", "pt", "debug"]); // no spells unlocked

describe("deriveMenuView: partition (rule 1)", () => {
  it("top level is always exactly 3 rows: attack, Skills category, Spells category", () => {
    const view = deriveMenuView(FULL_KIT, "top");
    expect(view.rows).toHaveLength(3);
    expect(view.rows[0]).toEqual({ kind: "ability", cmd: FULL_KIT.find((c) => c.id === "attack") });
    expect(view.rows[1]).toMatchObject({ kind: "category", id: "skills" });
    expect(view.rows[2]).toMatchObject({ kind: "category", id: "spells" });
    expect(view.title).toBeNull();
  });

  it("attack is present at top even with only the base kit", () => {
    const view = deriveMenuView(BASE_KIT_COMMANDS, "top");
    expect(view.rows[0]).toMatchObject({ kind: "ability", cmd: { id: "attack" } });
  });

  it("skills submenu lists the kit's skills in commands order", () => {
    const view = deriveMenuView(FULL_KIT, "skills");
    expect(view.rows.map((r) => (r.kind === "ability" ? r.cmd.id : r.id))).toEqual(["ct", "pt", "debug"]);
    expect(view.title).toBe("SKILLS");
  });

  it("spells submenu lists the kit's unlocked spells in commands order", () => {
    const view = deriveMenuView(FULL_KIT, "spells");
    expect(view.rows.map((r) => (r.kind === "ability" ? r.cmd.id : r.id))).toEqual(["fo", "rb", "rc", "conv"]);
    expect(view.title).toBe("SPELLS");
  });

  it("spells submenu is empty when no spells are unlocked", () => {
    const view = deriveMenuView(BASE_KIT_COMMANDS, "spells");
    expect(view.rows).toHaveLength(0);
  });

  it("a partial spell unlock (only Fan Out) surfaces just that one row", () => {
    const partial = commandsForKit(["attack", "ct", "pt", "debug", "fo"]);
    const view = deriveMenuView(partial, "spells");
    expect(view.rows.map((r) => (r.kind === "ability" ? r.cmd.id : r.id))).toEqual(["fo"]);
  });
});

describe("deriveMenuView: locked teaser (rule 2, owner ruling 2)", () => {
  it("Spells row is locked with the locked hint when zero spells are unlocked", () => {
    const view = deriveMenuView(BASE_KIT_COMMANDS, "top");
    const spellsRow = view.rows[2];
    expect(spellsRow).toMatchObject({ kind: "category", id: "spells", locked: true, desc: "Sealed until a boss falls." });
  });

  it("Spells row is unlocked once at least one spell is present, and no spell name leaks into it", () => {
    const partial = commandsForKit(["attack", "ct", "pt", "debug", "fo"]);
    const view = deriveMenuView(partial, "top");
    const spellsRow = view.rows[2];
    expect(spellsRow).toMatchObject({ kind: "category", id: "spells", locked: false, desc: "Spells won from fallen bosses." });
    expect((spellsRow as { desc: string }).desc).not.toMatch(/Fan Out/);
  });

  it("confirm on the locked Spells row yields blocked and leaves state unchanged", () => {
    const menu: MenuState = { ...initialMenuState, cursor: { ...initialMenuState.cursor, top: 2 } };
    const { menu: next, effect } = menuReduce(menu, "confirm", BASE_KIT_COMMANDS, 10);
    expect(effect).toEqual({ type: "blocked" });
    expect(next).toEqual(menu);
  });

  it("confirm on the unlocked Spells row descends", () => {
    const partial = commandsForKit(["attack", "ct", "pt", "debug", "fo"]);
    const menu: MenuState = { ...initialMenuState, cursor: { ...initialMenuState.cursor, top: 2 } };
    const { menu: next, effect } = menuReduce(menu, "confirm", partial, 10);
    expect(effect).toEqual({ type: "descend" });
    expect(next.level).toBe("spells");
  });

  it("the Skills category is never locked", () => {
    const view = deriveMenuView(BASE_KIT_COMMANDS, "top");
    expect(view.rows[1]).toMatchObject({ kind: "category", id: "skills", locked: false });
  });
});

describe("menuReduce: navigation (rule 3)", () => {
  it("down moves the cursor forward with wrap", () => {
    let menu = initialMenuState;
    ({ menu } = menuReduce(menu, "down", FULL_KIT, 10));
    expect(menu.cursor.top).toBe(1);
    ({ menu } = menuReduce(menu, "down", FULL_KIT, 10));
    expect(menu.cursor.top).toBe(2);
    const { menu: wrapped, effect } = menuReduce(menu, "down", FULL_KIT, 10);
    expect(wrapped.cursor.top).toBe(0);
    expect(effect).toEqual({ type: "moved" });
  });

  it("up moves the cursor backward with wrap", () => {
    const { menu, effect } = menuReduce(initialMenuState, "up", FULL_KIT, 10);
    expect(menu.cursor.top).toBe(2); // wraps to the last row
    expect(effect).toEqual({ type: "moved" });
  });

  it("a 1-row level wraps onto itself and still reports moved", () => {
    const partial = commandsForKit(["attack", "ct", "pt", "debug", "fo"]);
    const menu: MenuState = { ...initialMenuState, level: "spells", cursor: { ...initialMenuState.cursor, spells: 0 } };
    const { menu: next, effect } = menuReduce(menu, "down", partial, 10);
    expect(next.cursor.spells).toBe(0);
    expect(effect).toEqual({ type: "moved" });
  });

  it("confirm on a category switches level and reports descend", () => {
    const menu: MenuState = { ...initialMenuState, cursor: { ...initialMenuState.cursor, top: 1 } };
    const { menu: next, effect } = menuReduce(menu, "confirm", FULL_KIT, 10);
    expect(next.level).toBe("skills");
    expect(effect).toEqual({ type: "descend" });
  });

  it("confirm on an affordable ability yields cast, state unchanged", () => {
    const menu: MenuState = { ...initialMenuState, level: "skills", cursor: { ...initialMenuState.cursor, skills: 1 } }; // pt, mp 3
    const { menu: next, effect } = menuReduce(menu, "confirm", FULL_KIT, 10);
    expect(effect).toEqual({ type: "cast", cmd: FULL_KIT.find((c) => c.id === "pt") });
    expect(next).toEqual(menu);
  });

  it("confirm on an unaffordable ability yields blocked, state unchanged", () => {
    const menu: MenuState = { ...initialMenuState, level: "skills", cursor: { ...initialMenuState.cursor, skills: 1 } }; // pt, mp 3
    const { menu: next, effect } = menuReduce(menu, "confirm", FULL_KIT, 0);
    expect(effect).toEqual({ type: "blocked" });
    expect(next).toEqual(menu);
  });

  it("back in a submenu ascends to top, cursor untouched", () => {
    const menu: MenuState = { ...initialMenuState, level: "skills", cursor: { top: 0, skills: 2, spells: 0 } };
    const { menu: next, effect } = menuReduce(menu, "back", FULL_KIT, 10);
    expect(next.level).toBe("top");
    expect(next.cursor.skills).toBe(2); // preserved
    expect(effect).toEqual({ type: "ascend" });
  });

  it("back at top yields pause, state unchanged", () => {
    const { menu: next, effect } = menuReduce(initialMenuState, "back", FULL_KIT, 10);
    expect(effect).toEqual({ type: "pause" });
    expect(next).toEqual(initialMenuState);
  });
});

describe("menuReduce: cursor memory (rule 4)", () => {
  it("descending into Skills, moving, and ascending back to top preserves the Skills cursor untouched", () => {
    let menu = initialMenuState;
    ({ menu } = menuReduce(menu, "down", FULL_KIT, 10)); // top cursor -> 1 (Skills row)
    ({ menu } = menuReduce(menu, "confirm", FULL_KIT, 10)); // -> skills
    expect(menu.level).toBe("skills");
    ({ menu } = menuReduce(menu, "down", FULL_KIT, 10)); // skills cursor -> 1
    ({ menu } = menuReduce(menu, "down", FULL_KIT, 10)); // skills cursor -> 2
    expect(menu.cursor.skills).toBe(2);
    ({ menu } = menuReduce(menu, "back", FULL_KIT, 10)); // -> top, top cursor still 1
    expect(menu.level).toBe("top");
    expect(menu.cursor.top).toBe(1);
    expect(menu.cursor.skills).toBe(2); // survives the round trip
  });

  it("re-descending into Skills resumes at the preserved cursor, not row 0", () => {
    let menu: MenuState = { ...initialMenuState, cursor: { top: 1, skills: 2, spells: 0 } };
    ({ menu } = menuReduce(menu, "confirm", FULL_KIT, 10)); // -> skills, cursor untouched by descend
    expect(menu.level).toBe("skills");
    expect(menu.cursor.skills).toBe(2);
  });

  it("casting an ability never resets any cursor", () => {
    const menu: MenuState = { ...initialMenuState, level: "skills", cursor: { top: 1, skills: 1, spells: 0 } };
    const { menu: next } = menuReduce(menu, "confirm", FULL_KIT, 10); // cast pt
    expect(next).toEqual(menu);
  });

  it("up/down on a level with zero rows (locked Spells never entered, but the model must not crash) stays at 0", () => {
    const menu: MenuState = { ...initialMenuState, level: "spells" };
    const { menu: downed, effect: downEffect } = menuReduce(menu, "down", BASE_KIT_COMMANDS, 10);
    expect(downed.cursor.spells).toBe(0);
    expect(downEffect).toEqual({ type: "moved" });
    const { menu: upped, effect: upEffect } = menuReduce(menu, "up", BASE_KIT_COMMANDS, 10);
    expect(upped.cursor.spells).toBe(0);
    expect(upEffect).toEqual({ type: "moved" });
  });

  it("confirm on a level with zero rows (defensive, no crash) yields blocked, state unchanged", () => {
    const menu: MenuState = { ...initialMenuState, level: "spells" };
    const { menu: next, effect } = menuReduce(menu, "confirm", BASE_KIT_COMMANDS, 10);
    expect(effect).toEqual({ type: "blocked" });
    expect(next).toEqual(menu);
  });

  it("every cursor stays within its level's row count after every transition on the full kit", () => {
    let menu = initialMenuState;
    const inputs: Array<"up" | "down" | "confirm" | "back"> = [
      "down", "down", "confirm", "up", "back", "down", "down", "confirm", "up", "up", "back",
    ];
    for (const input of inputs) {
      const result = menuReduce(menu, input, FULL_KIT, 10);
      menu = result.menu;
      const rows = deriveMenuView(FULL_KIT, menu.level).rows;
      expect(menu.cursor[menu.level]).toBeLessThan(rows.length === 0 ? 1 : rows.length);
    }
  });
});

describe("row cap guard: M8 tripwire (rule 5)", () => {
  const prefixes: string[][] = [[]];
  for (let i = 1; i <= RUSH_ORDER.length; i++) prefixes.push([...RUSH_ORDER.slice(0, i)]);

  it("exactly 5 valid rush prefixes are exercised", () => {
    expect(prefixes).toHaveLength(5);
  });

  it.each(prefixes.map((p) => [p] as const))("kit derived from defeated=%j keeps every level's row count <= 4", (defeated) => {
    const kit = deriveKit(defeated);
    const commands = commandsForKit(kit);
    for (const level of ["top", "skills", "spells"] as const) {
      expect(deriveMenuView(commands, level).rows.length).toBeLessThanOrEqual(4);
    }
  });
});

describe("commandMenu.ts strings: punctuation gate (rule 6)", () => {
  // Same assertion pattern as scenes/punctuation.test.ts: unicode-escaped
  // banned characters so this file never contains a banned literal itself.
  const lockedView = deriveMenuView(BASE_KIT_COMMANDS, "top");
  const unlockedView = deriveMenuView(FULL_KIT, "top");
  const skillsView = deriveMenuView(FULL_KIT, "skills");
  const spellsView = deriveMenuView(FULL_KIT, "spells");
  const strings: { label: string; value: string }[] = [
    { label: "top.skills.label", value: (lockedView.rows[1] as { label: string }).label },
    { label: "top.skills.desc", value: (lockedView.rows[1] as { desc: string }).desc },
    { label: "top.spells.label (locked)", value: (lockedView.rows[2] as { label: string }).label },
    { label: "top.spells.desc (locked)", value: (lockedView.rows[2] as { desc: string }).desc },
    { label: "top.spells.desc (unlocked)", value: (unlockedView.rows[2] as { desc: string }).desc },
    { label: "skills.title", value: skillsView.title! },
    { label: "spells.title", value: spellsView.title! },
  ];

  for (const { label, value } of strings) {
    it(`${label} has no em dash, en dash, or semicolon`, () => {
      expect(BANNED.test(value)).toBe(false);
    });
  }

  it("skills row 1 label matches the pinned default", () => {
    expect((lockedView.rows[1] as { label: string }).label).toBe("Skills");
  });
  it("skills row 1 desc matches the pinned default", () => {
    expect((lockedView.rows[1] as { desc: string }).desc).toBe("Core moves. Always ready.");
  });
  it("spells row label matches the pinned default", () => {
    expect((lockedView.rows[2] as { label: string }).label).toBe("Spells");
  });
  it("spells row locked desc matches the pinned default", () => {
    expect((lockedView.rows[2] as { desc: string }).desc).toBe("Sealed until a boss falls.");
  });
  it("spells row unlocked desc matches the pinned default", () => {
    expect((unlockedView.rows[2] as { desc: string }).desc).toBe("Spells won from fallen bosses.");
  });
  it("skills submenu title matches the pinned default", () => {
    expect(skillsView.title).toBe("SKILLS");
  });
  it("spells submenu title matches the pinned default", () => {
    expect(spellsView.title).toBe("SPELLS");
  });
});
