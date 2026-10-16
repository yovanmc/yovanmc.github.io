import { describe, expect, it } from "vitest";
import { deriveFightChoice, nextUndefeatedBoss } from "./fight";

describe("deriveFightChoice (FIGHT submenu chooser derivation, defeatedBosses ∩ IMPLEMENTED_BOSSES)", () => {
  it.each([
    {
      name: "direct-launches Alert Storm for a fresh visitor (no defeats yet)",
      defeated: [],
      expected: { mode: "direct", boss: "alert-storm" },
    },
    {
      name: "opens a chooser once Alert Storm is defeated: Cascade on top (not a rematch), Alert Storm below as REMATCH",
      defeated: ["alert-storm"],
      expected: {
        mode: "chooser",
        rows: [
          { boss: "cascade", label: "The Cascade", isRematch: false },
          { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        ],
      },
    },
    {
      name: "shows Imposter Syndrome as the next-undefeated row (not a rematch) once Alert Storm, Cascade, and Silent Failure are all beaten",
      defeated: ["alert-storm", "cascade", "silent-failure"],
      expected: {
        mode: "chooser",
        rows: [
          { boss: "imposter-syndrome", label: "Imposter Syndrome", isRematch: false },
          { boss: "alert-storm", label: "Alert Storm", isRematch: true },
          { boss: "cascade", label: "The Cascade", isRematch: true },
          { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
        ],
      },
    },
    {
      name: "shows the defeated roster only, no next row, once every IMPLEMENTED boss is defeated",
      defeated: ["alert-storm", "cascade", "silent-failure", "imposter-syndrome"],
      expected: {
        mode: "chooser",
        rows: [
          { boss: "alert-storm", label: "Alert Storm", isRematch: true },
          { boss: "cascade", label: "The Cascade", isRematch: true },
          { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
          { boss: "imposter-syndrome", label: "Imposter Syndrome", isRematch: true },
        ],
      },
    },
    {
      name: "shows Silent Failure as the next-undefeated row (not a rematch) once Alert Storm and Cascade are both beaten",
      defeated: ["alert-storm", "cascade"],
      expected: {
        mode: "chooser",
        rows: [
          { boss: "silent-failure", label: "The Silent Failure", isRematch: false },
          { boss: "alert-storm", label: "Alert Storm", isRematch: true },
          { boss: "cascade", label: "The Cascade", isRematch: true },
        ],
      },
    },
    {
      name: "ignores a fake boss id in defeatedBosses (defensive, never reachable via validated parseDefeatedBosses)",
      defeated: ["not-a-real-boss"],
      expected: { mode: "direct", boss: "alert-storm" },
    },
    {
      name: "shows silent-failure as a chooser REMATCH row even though defeating it alone (without alert-storm/cascade first) is unreachable in real play",
      defeated: ["silent-failure"],
      expected: {
        mode: "chooser",
        rows: [
          { boss: "alert-storm", label: "Alert Storm", isRematch: false },
          { boss: "silent-failure", label: "The Silent Failure", isRematch: true },
        ],
      },
    },
    {
      name: "ignores duplicate ids in defeatedBosses",
      defeated: ["alert-storm", "alert-storm"],
      expected: {
        mode: "chooser",
        rows: [
          { boss: "cascade", label: "The Cascade", isRematch: false },
          { boss: "alert-storm", label: "Alert Storm", isRematch: true },
        ],
      },
    },
  ])("$name", ({ defeated, expected }) => {
    expect(deriveFightChoice(defeated)).toEqual(expected);
  });
});

describe("nextUndefeatedBoss (shared by deriveFightChoice and the dive handoff, so the two can never disagree)", () => {
  it.each([
    { name: "is alert-storm for a fresh visitor (0 bosses beaten)", defeated: [], expected: "alert-storm" },
    { name: "is cascade once alert-storm alone is beaten (1 boss beaten)", defeated: ["alert-storm"], expected: "cascade" },
    {
      name: "is imposter-syndrome once alert-storm, cascade, and silent-failure are beaten (3 bosses beaten)",
      defeated: ["alert-storm", "cascade", "silent-failure"],
      expected: "imposter-syndrome",
    },
    {
      name: "is undefined once every IMPLEMENTED boss is beaten (4 bosses beaten, rush complete)",
      defeated: ["alert-storm", "cascade", "silent-failure", "imposter-syndrome"],
      expected: undefined,
    },
  ])("$name", ({ defeated, expected }) => {
    expect(nextUndefeatedBoss(defeated)).toBe(expected);
  });
});
