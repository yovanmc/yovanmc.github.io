// PIPELINE_FIGURE renders through the same <Figure> component every
// registered flow figure does (Figure.tsx), but it lives outside FIGURES: it
// has no owning project slug, so there is no registry.test.ts entry for it.
// Figure.tsx derives its ROW_THRESHOLD_PX once from every FIGURES flow figure
// at module load, so if PIPELINE_FIGURE were ever wider than the widest
// registered figure, adding it to that population would raise the threshold
// and silently reflow every OTHER figure on the site along with it. This
// equality is the tripwire: it holds today because PIPELINE_FIGURE's one row
// has 4 nodes, tying (not exceeding) the registry's current max
// (backend-harness and curio both have a 4-node row), and it starts FAILING
// the moment PIPELINE_FIGURE grows a 5th node, which is the point.
import { describe, expect, it } from "vitest";
import { FIGURES } from "./registry";
import { uniformRowThresholdPx } from "./layout";
import { PIPELINE_FIGURE } from "./pipelineFigure";
import type { FlowFigure } from "./types";

// Same derivation Figure.tsx itself uses for FLOW_FIGURES (not imported from
// there - Figure.tsx does not export it - but reads the identical FIGURES
// source with the identical filter, so this cannot drift from what the
// component actually renders against).
const FLOW_FIGURES = Object.values(FIGURES).filter((f): f is FlowFigure => f.kind === "flow");

describe("PIPELINE_FIGURE stays within the registry's row-threshold population", () => {
  it("does not raise uniformRowThresholdPx over the registry alone", () => {
    expect(uniformRowThresholdPx([...FLOW_FIGURES, PIPELINE_FIGURE])).toBe(uniformRowThresholdPx(FLOW_FIGURES));
  });

  it("has exactly 4 nodes in its one row, today's registry max and the equality's actual margin", () => {
    expect(PIPELINE_FIGURE.rows).toHaveLength(1);
    expect(PIPELINE_FIGURE.rows[0].nodes).toHaveLength(4);
  });

  it("vacuity check: a 5-node figure DOES raise the threshold (proves the equality is a real check, not a tautology)", () => {
    const wider: FlowFigure = {
      kind: "flow",
      rows: [{ nodes: Array.from({ length: 5 }, (_, i) => ({ label: `N${i}`, tone: "default" as const })) }],
    };
    expect(uniformRowThresholdPx([...FLOW_FIGURES, wider])).toBeGreaterThan(uniformRowThresholdPx(FLOW_FIGURES));
  });
});
