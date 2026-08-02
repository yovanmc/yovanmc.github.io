import { describe, expect, it } from "vitest";
import {
  CONNECTOR_PX,
  MONO_CH_PX,
  NODE_MIN_PX,
  contentWidthForViewport,
  logLineWidthPx,
  logModeFor,
  logTextWidthPx,
  maxLabelWordChars,
  maxLogValueChars,
  nodeWidthPx,
  orientationFor,
  rowFits,
  uniformLogThresholdPx,
  uniformRowThresholdPx,
} from "./layout";
import type { FlowFigure, LogFigure } from "./types";
import { MEASURED_FIGURE_TYPE } from "./__fixtures__/measuredFigureType";

// Local test-only flow figures. Deliberately NOT importing `./registry`,
// which does not exist yet at this task (task A3 creates it) — this module
// tests the algorithm's general behaviour, task A3's registry tests exercise
// it against the real six figures.
const THREE_NODE: FlowFigure = {
  kind: "flow",
  rows: [{ nodes: [{ label: "A", tone: "default" }, { label: "B", tone: "default" }, { label: "C", tone: "default" }] }],
};
const FOUR_NODE: FlowFigure = {
  kind: "flow",
  rows: [
    { nodes: [{ label: "A", tone: "default" }, { label: "B", tone: "default" }, { label: "C", tone: "default" }, { label: "D", tone: "default" }] },
    { nodes: [{ label: "E", tone: "default" }, { label: "F", tone: "default" }] },
  ],
};
const TEST_FIGURES: FlowFigure[] = [THREE_NODE, FOUR_NODE];

describe("rowFits", () => {
  it("boundary is exact both ways, computed from the constants", () => {
    const b = 4 * NODE_MIN_PX + 3 * CONNECTOR_PX;
    expect(rowFits(4, b)).toBe(true);
    expect(rowFits(4, b - 1)).toBe(false);
  });

  it("a single node always fits", () => {
    expect(rowFits(1, 0)).toBe(true);
    expect(rowFits(0, 0)).toBe(true);
  });
});

describe("uniformRowThresholdPx", () => {
  it("equals the widest single row requirement across the figures", () => {
    const expected = 4 * NODE_MIN_PX + 3 * CONNECTOR_PX; // FOUR_NODE's first row
    expect(uniformRowThresholdPx(TEST_FIGURES)).toBe(expected);
  });

  it("ignores single-node rows, which never gate on width", () => {
    const single: FlowFigure = {
      kind: "flow",
      rows: [{ nodes: [{ label: "SOLO", tone: "default" }] }],
    };
    expect(uniformRowThresholdPx([single])).toBe(0);
  });

  it("dominates every individual figure's own requirement (the registry-wide threshold is never smaller)", () => {
    const combined = uniformRowThresholdPx(TEST_FIGURES);
    for (const figure of TEST_FIGURES) {
      expect(uniformRowThresholdPx([figure])).toBeLessThanOrEqual(combined);
    }
  });

  it("never asks a figure to render a row in a space too small for it", () => {
    const threshold = uniformRowThresholdPx(TEST_FIGURES);
    const sweep = [threshold - 50, threshold - 1, threshold, threshold + 1, threshold + 50];
    for (const width of sweep) {
      for (const figure of TEST_FIGURES) {
        if (orientationFor(threshold, width) !== "row") continue;
        for (const row of figure.rows) {
          expect(rowFits(row.nodes.length, width), `width=${width}`).toBe(true);
        }
      }
    }
  });
});

describe("orientationFor", () => {
  it("stacks (column) for NaN and Infinity — an unmeasured container never renders horizontal", () => {
    expect(orientationFor(500, NaN)).toBe("column");
    expect(orientationFor(500, Infinity)).toBe("column");
  });
});

describe("contentWidthForViewport", () => {
  it("agrees with the A2a fixture at 320px, within 1px", () => {
    expect(Math.abs(contentWidthForViewport(320) - MEASURED_FIGURE_TYPE.narrowestContentPx)).toBeLessThanOrEqual(1);
  });
});

describe("measured constants", () => {
  it("NODE_MIN_PX is within 1px of the A2a fixture", () => {
    expect(Math.abs(NODE_MIN_PX - MEASURED_FIGURE_TYPE.nodeMinPx)).toBeLessThanOrEqual(1);
  });

  it("MONO_CH_PX is within 1px of the A2a fixture", () => {
    expect(Math.abs(MONO_CH_PX - MEASURED_FIGURE_TYPE.monoChPx)).toBeLessThanOrEqual(1);
  });
});

describe("logModeFor", () => {
  it("returns stacked when the widest line (threshold) exceeds the text width", () => {
    const contentPx = 300;
    const textPx = logTextWidthPx(contentPx);
    const thresholdPx = textPx + MONO_CH_PX * 5;
    expect(logModeFor(thresholdPx, contentPx)).toBe("stacked");
  });

  it("returns inline when the widest line (threshold) exactly equals the text width", () => {
    const line = { channel: "chan", value: "value", tone: "muted" as const };
    const exactWidth = logLineWidthPx(line);
    // Build a synthetic content width where textPx exactly equals this line's width.
    const exactContentPx = exactWidth + 12; // LOG_INDENT_PX inverse of logTextWidthPx
    expect(logModeFor(exactWidth, exactContentPx)).toBe("inline");
    // sanity: confirm the width really is exactly the text width at that content size
    expect(logTextWidthPx(exactContentPx)).toBeCloseTo(exactWidth, 6);
  });

  it("stacks for an unmeasured (non-finite) container, same rule as orientationFor", () => {
    expect(logModeFor(500, NaN)).toBe("stacked");
    expect(logModeFor(500, Infinity)).toBe("stacked");
  });
});

describe("uniformLogThresholdPx", () => {
  const SHORT_LINE: LogFigure = {
    kind: "log",
    lines: [{ channel: "a", value: "v", tone: "muted" }],
  };
  const LONG_LINE: LogFigure = {
    kind: "log",
    lines: [
      { channel: "a", value: "v", tone: "muted" },
      { channel: "channel.longer", value: "a much longer value here", tone: "fault" },
    ],
  };
  const LOG_TEST_FIGURES: LogFigure[] = [SHORT_LINE, LONG_LINE];

  it("equals the widest single line requirement across the figures", () => {
    const expected = Math.max(
      ...LONG_LINE.lines.map((l) => logLineWidthPx(l)),
      ...SHORT_LINE.lines.map((l) => logLineWidthPx(l)),
    );
    expect(uniformLogThresholdPx(LOG_TEST_FIGURES)).toBe(expected);
  });

  it("dominates every individual figure's own requirement (the registry-wide threshold is never smaller)", () => {
    const combined = uniformLogThresholdPx(LOG_TEST_FIGURES);
    for (const figure of LOG_TEST_FIGURES) {
      expect(uniformLogThresholdPx([figure])).toBeLessThanOrEqual(combined);
    }
  });

  it("returns 0 for a figure list with no lines", () => {
    expect(uniformLogThresholdPx([])).toBe(0);
  });
});

describe("maxLabelWordChars / maxLogValueChars", () => {
  it("maxLabelWordChars() holds the registry's longest label word, ORCHESTRATOR (12 chars), with zero margin to spare", () => {
    // Not "equals the implementation restated" (that passes for any constants
    // — the registry.ts defect this replaces). ORCHESTRATOR is the actual
    // 12-character boundary NODE_MIN_PX exists to guard; if this ever drops
    // below 12 the registry's own label-cap test goes red for real content.
    expect(maxLabelWordChars()).toBeGreaterThanOrEqual(12);
  });

  it("maxLogValueChars(238) holds the registry's longest log value, \"depth and lag exported\" (22 chars), with zero margin to spare", () => {
    expect(maxLogValueChars(238)).toBeGreaterThanOrEqual(22);
  });
});

describe("nodeWidthPx", () => {
  it("splits available width evenly minus connectors", () => {
    expect(nodeWidthPx(0, 100)).toBe(0);
    const w = nodeWidthPx(2, 222);
    expect(w).toBeCloseTo((222 - CONNECTOR_PX) / 2, 6);
  });
});
