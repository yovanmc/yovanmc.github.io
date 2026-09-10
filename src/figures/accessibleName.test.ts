import { describe, expect, it } from "vitest";
import { CATS } from "../content";
import { FIGURES } from "./registry";
import { accessibleNameFor } from "./accessibleName";

// The figure system carries no per-figure captions, so a figure has no
// hand-written string to hang an `aria-label` on and would render as an
// unlabeled graphic. Its accessible name is derived from the owning project's
// title instead.
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
