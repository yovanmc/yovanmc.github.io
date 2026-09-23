import type { FlowFigure } from "./types";

/**
 * The verification-pipeline figure BuildPage renders. Outside FIGURES because
 * it has no owning project slug. Kept in src/figures/ so
 * pipelineFigure.test.ts can hold it against the same uniformRowThresholdPx
 * population as every registered figure.
 */
export const PIPELINE_FIGURE: FlowFigure = {
  kind: "flow",
  rows: [
    {
      nodes: [
        { label: "HTML LAB", tone: "default" },
        { label: "EXTRACT CANON", tone: "default" },
        { label: "HEADLESS CAPTURE", tone: "default" },
        { label: "RECT ASSERTED", tone: "fix" },
      ],
    },
  ],
};
