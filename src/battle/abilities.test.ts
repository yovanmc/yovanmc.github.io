// M6 PR-1a task 6 — kit-driven command data.
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md
import { describe, expect, it } from "vitest";
import { commandsForKit } from "./abilities";

describe("commandsForKit", () => {
  it("returns the base four for a fresh kit — no Fan Out row", () => {
    const cmds = commandsForKit(["attack", "ct", "pt", "debug"]);
    expect(cmds.map((c) => c.id)).toEqual(["attack", "ct", "pt", "debug"]);
  });

  it("appends Fan Out when the kit includes it (rematch with Alert Storm beaten)", () => {
    const cmds = commandsForKit(["attack", "ct", "pt", "debug", "fo"]);
    expect(cmds.map((c) => c.id)).toEqual(["attack", "ct", "pt", "debug", "fo"]);
    const fo = cmds.find((c) => c.id === "fo")!;
    expect(fo.label).toBe("Fan Out");
    expect(fo.mp).toBe(3);
    expect(fo.needsTarget).toBe(false);
    expect(fo.desc).toContain("8");
  });

  it("keeps the fixed menu order regardless of the kit array's own order", () => {
    const cmds = commandsForKit(["fo", "attack"]);
    expect(cmds.map((c) => c.id)).toEqual(["attack", "fo"]);
  });

  it("drops ids the kit doesn't grant", () => {
    const cmds = commandsForKit(["attack"]);
    expect(cmds.map((c) => c.id)).toEqual(["attack"]);
  });

  it("preserves the pre-M6 desc/label/mp text for the base four (unchanged strings)", () => {
    const cmds = commandsForKit(["attack", "ct", "pt", "debug"]);
    expect(cmds).toEqual([
      { id: "attack", label: "Attack", mp: 0, needsTarget: true, desc: "12 dmg · +1 MP on hit" },
      { id: "ct", label: "Critical Thinking", mp: 2, needsTarget: false, desc: "3 turns · +50% dealt · −25% taken · screams linger" },
      { id: "pt", label: "Power Through", mp: 3, needsTarget: true, desc: "28 dmg" },
      { id: "debug", label: "Debug", mp: 2, needsTarget: true, desc: "6 dmg · 4×3 DoT · marks the target" },
    ]);
  });
});
