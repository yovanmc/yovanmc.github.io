// Unlock map test suite (M4 task B1). Drives unlockedSlugs/isGateable, the
// pure leaf helpers that turn `defeatedBosses` into "which project slugs may
// the play path open" (D6, D8). CATS is imported here, in the test file
// ONLY, to cross-check the slug maps against the real content — unlocks.ts
// itself stays a leaf module with no content.ts import (D6: content.ts is
// the owner-voice surface and is not touched by this milestone).
import { describe, expect, it } from "vitest";
import { CATS } from "../content";
import { IMPLEMENTED_BOSSES } from "../battle/rushOrder";
import { SEED_UNLOCKED, UNLOCK_BY_BOSS, isGateable, unlockedSlugs } from "./unlocks";

describe("unlockedSlugs", () => {
  it("with zero progress is exactly the seed set", () => {
    expect(unlockedSlugs([])).toEqual(new Set(SEED_UNLOCKED));
  });

  it("each boss adds exactly its mapped slug", () => {
    for (const [boss, slug] of Object.entries(UNLOCK_BY_BOSS)) {
      const set = unlockedSlugs([boss]);
      expect(set.has(slug)).toBe(true);
      expect(set.size).toBe(SEED_UNLOCKED.length + 1);
    }
  });

  it("beating all four bosses yields all 6 project slugs", () => {
    const realProjectSlugs = new Set(
      CATS.find((c) => c.key === "projects")!.items.map((it) => it.slug!),
    );
    expect(realProjectSlugs.size).toBe(6);
    const set = unlockedSlugs(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"]);
    expect(set).toEqual(realProjectSlugs);
  });
});

describe("coverage invariant (SEED_UNLOCKED / UNLOCK_BY_BOSS)", () => {
  it("are disjoint and their union has exactly 6 members", () => {
    const values = Object.values(UNLOCK_BY_BOSS);
    const seedSet = new Set(SEED_UNLOCKED);
    for (const v of values) expect(seedSet.has(v)).toBe(false);
    const union = new Set([...SEED_UNLOCKED, ...values]);
    expect(union.size).toBe(6);
  });

  it("cross-checks the union against the real content.ts project slugs, not a second hardcoded list", () => {
    const realProjectSlugs = new Set(
      CATS.find((c) => c.key === "projects")!.items.map((it) => it.slug!),
    );
    const union = new Set([...SEED_UNLOCKED, ...Object.values(UNLOCK_BY_BOSS)]);
    expect(union).toEqual(realProjectSlugs);
  });

  it("every UNLOCK_BY_BOSS key is a member of IMPLEMENTED_BOSSES", () => {
    for (const bossId of Object.keys(UNLOCK_BY_BOSS)) {
      expect(IMPLEMENTED_BOSSES.includes(bossId)).toBe(true);
    }
  });
});

describe("isGateable", () => {
  it("is false for experience regardless of slug", () => {
    expect(isGateable("experience", "software-engineer")).toBe(false);
  });

  it("is false for contact regardless of slug", () => {
    expect(isGateable("contact", undefined)).toBe(false);
  });

  it("is false for projects with an undefined slug", () => {
    expect(isGateable("projects", undefined)).toBe(false);
  });

  it("is true for a gateable projects slug", () => {
    expect(isGateable("projects", "curio")).toBe(true);
  });

  it("is true for a seed-unlocked projects slug (still gateable, just open from the start)", () => {
    expect(isGateable("projects", "mia")).toBe(true);
  });
});
