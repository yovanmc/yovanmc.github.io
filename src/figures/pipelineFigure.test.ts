// PIPELINE_FIGURE renders through <Figure> but sits outside FIGURES (no
// project slug). Figure.tsx derives ROW_THRESHOLD_PX from every FIGURES flow
// figure, so a PIPELINE_FIGURE wider than the widest registered figure would
// reflow every other figure if it ever joined them. This equality is the
// tripwire: its one 4-node row ties the registry's max and fails the moment
// it grows a 5th node.
import { describe, expect, it } from "vitest";
import { FIGURES } from "./registry";
import { uniformRowThresholdPx } from "./layout";
import { PIPELINE_FIGURE } from "./pipelineFigure";
import type { FlowFigure } from "./types";

// Same FIGURES source and filter as Figure.tsx's own (unexported) list.
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
