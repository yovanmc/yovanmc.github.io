import { describe, expect, it } from "vitest";
import { deriveFightChoice, nextUndefeatedBoss } from "./fight";

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

  it("shows Imposter Syndrome as the next-undefeated row (not a rematch) once Alert Storm, Cascade, and Silent Failure are all beaten", () => {
    expect(deriveFightChoice(["alert-storm", "cascade", "silent-failure"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "imposter-syndrome", label: "Imposter Syndrome", isRematch: false },
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        { boss: "cascade", label: "The Cascade", isRematch: true },
        { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
      ],
    });
  });

  it("shows the defeated roster only, no next row, once every IMPLEMENTED boss is defeated", () => {
    expect(
      deriveFightChoice(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"]),
    ).toEqual({
      mode: "chooser",
      rows: [
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        { boss: "cascade", label: "The Cascade", isRematch: true },
        { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
        { boss: "imposter-syndrome", label: "Imposter Syndrome", isRematch: true },
      ],
    });
  });

  it("shows Silent Failure as the next-undefeated row (not a rematch) once Alert Storm and Cascade are both beaten", () => {
    expect(deriveFightChoice(["alert-storm", "cascade"])).toEqual({
      mode: "chooser",
      rows: [
        { boss: "silent-failure", label: "The Silent Failure", isRematch: false },
        { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        { boss: "cascade", label: "The Cascade", isRematch: true },
      ],
    });
  });

  it("ignores a fake boss id in defeatedBosses (defensive, never reachable via validated parseDefeatedBosses)", () => {
    expect(deriveFightChoice(["not-a-real-boss"])).toEqual({ mode: "direct", boss: "alert-storm" });
  });

  it("shows silent-failure as a chooser REMATCH row even though defeating it alone (without alert-storm/cascade first) is unreachable in real play", () => {
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

describe("nextUndefeatedBoss (shared by deriveFightChoice and the dive handoff, so the two can never disagree)", () => {
  it("is alert-storm for a fresh visitor (0 bosses beaten)", () => {
    expect(nextUndefeatedBoss([])).toBe("alert-storm");
  });

  it("is cascade once alert-storm alone is beaten (1 boss beaten)", () => {
    expect(nextUndefeatedBoss(["alert-storm"])).toBe("cascade");
  });

  it("is imposter-syndrome once alert-storm, cascade, and silent-failure are beaten (3 bosses beaten)", () => {
    expect(nextUndefeatedBoss(["alert-storm", "cascade", "silent-failure"])).toBe("imposter-syndrome");
  });

  it("is undefined once every IMPLEMENTED boss is beaten (4 bosses beaten, rush complete)", () => {
    expect(
      nextUndefeatedBoss(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"]),
    ).toBeUndefined();
  });
});
