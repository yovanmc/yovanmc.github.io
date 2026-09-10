import type { FlowFigure } from "./types";

/**
 * The verification-pipeline figure BuildPage renders. Lives outside
 * src/figures/registry.ts's FIGURES map on purpose: it has no owning project
 * slug, so App.tsx's BuildPage passes it straight to `<Figure
 * figure={PIPELINE_FIGURE} projectTitle="How this site is verified" />`
 * rather than going through figureFor()/FIGURES - no PageRef, no content.ts
 * entry, no registry.test.ts key to add.
 *
 * Kept in src/figures/ anyway (not src/buildCopy.ts or src/components/) so
 * pipelineFigure.test.ts can hold it up against the exact same
 * uniformRowThresholdPx population every registered figure answers to. See
 * that test for why the equality check is the actual tripwire.
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
