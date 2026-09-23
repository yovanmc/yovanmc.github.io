import { describe, expect, it } from "vitest";
import { CATS } from "../content";
import { FIGURES } from "./registry";
import { accessibleNameFor } from "./accessibleName";

// Figures carry no captions, so their accessible name is derived from the
// owning project's title. No DOM environment here, so this tests the pure
// derivation rather than rendering <Figure/>.

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
