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
    expect(deriveFightChoice(["alert-storm", "cascade", "silent-failure"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        { boss: "cascade", label: "The Cascade", isRematch: true },
        { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
      ],
    });
  });

  it("shows Silent Failure as the next-undefeated row (not a rematch) once Alert Storm and Cascade are both beaten (implemented as of PR-2)", () => {
    expect(deriveFightChoice(["alert-storm", "cascade"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "silent-failure", label: "The Silent Failure", isRematch: false },
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        { boss: "cascade", label: "The Cascade", isRematch: true },
      ],
    });
  });

  it("ignores an unimplemented boss id in defeatedBosses (defensive — never reachable via validated parseDefeatedBosses)", () => {
    expect(deriveFightChoice(["imposter-syndrome"])).toEqual({ mode: "direct", boss: "alert-storm" });
  });

  it("shows silent-failure as a chooser REMATCH row once implemented, even though defeating it alone (without alert-storm/cascade first) is unreachable in real play", () => {
    expect(deriveFightChoice(["silent-failure"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "alert-storm", label: "Alert Storm", isRematch: false },
        { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
      ],
    });
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
