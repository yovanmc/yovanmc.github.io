import { describe, expect, it } from "vitest";
import { deriveFightChoice } from "./fight";

describe("deriveFightChoice (FIGHT submenu chooser derivation, defeatedBosses ∩ IMPLEMENTED_BOSSES)", () => {
  it("direct-launches Alert Storm for a fresh visitor (no defeats yet)", () => {
    expect(deriveFightChoice([])).toEqual({ mode: "direct", boss: "alert-storm" });
  });

  it("opens a chooser once Alert Storm is defeated: Cascade on top (not a rematch), Alert Storm below as REMATCH", () => {
    expect(deriveFightChoice(["alert-storm"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "cascade", label: "The Cascade", isRematch: false },
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
      ],
    });
  });

  it("shows the defeated roster only, no next row, once every IMPLEMENTED boss is defeated", () => {
    expect(deriveFightChoice(["alert-storm", "cascade"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        { boss: "cascade", label: "The Cascade", isRematch: true },
      ],
    });
  });

  it("ignores an unimplemented boss id in defeatedBosses (defensive — never reachable via validated parseDefeatedBosses)", () => {
    expect(deriveFightChoice(["silent-failure"])).toEqual({ mode: "direct", boss: "alert-storm" });
  });

  it("ignores duplicate ids in defeatedBosses", () => {
    expect(deriveFightChoice(["alert-storm", "alert-storm"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "cascade", label: "The Cascade", isRematch: false },
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
      ],
    });
  });
});
