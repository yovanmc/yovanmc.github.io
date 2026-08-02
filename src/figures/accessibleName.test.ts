import { describe, expect, it } from "vitest";
import { CATS } from "../content";
import { FIGURES } from "./registry";
import { accessibleNameFor } from "./accessibleName";

// The figure system dropped per-figure captions (owner ruling). The caption
// used to double as the figure's accessible name (`aria-label={figure.caption}`
// in Figure.tsx). Removing it without a replacement leaves every figure an
// unlabeled graphic, so the accessible name is now derived from the
// project's own title instead of a hand-written per-figure string.
//
// There is no jsdom/testing-library in this repo (vitest.config.ts's
// `test.include` is an explicit glob list that does not pull in a DOM
// environment), so this exercises the pure derivation function directly
// rather than rendering <Figure/> and reading its computed accessible name.

const allProjectItems = CATS.find((c) => c.key === "projects")!.items;

describe("accessibleNameFor", () => {
  it("produces a non-empty accessible name containing the project title, for every figure in FIGURES", () => {
    expect(Object.keys(FIGURES).length).toBeGreaterThan(0);
    for (const slug of Object.keys(FIGURES)) {
      const item = allProjectItems.find((i) => i.slug === slug);
      expect(item, `no CATS project item for slug "${slug}"`).toBeTruthy();
      const name = accessibleNameFor(item!.title);
      expect(name.length, `"${slug}" produced an empty accessible name`).toBeGreaterThan(0);
      expect(name, `"${slug}" accessible name does not contain its title`).toContain(item!.title);
    }
  });
});
