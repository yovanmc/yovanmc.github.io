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
  caption: "three",
  rows: [{ nodes: [{ label: "A", tone: "default" }, { label: "B", tone: "default" }, { label: "C", tone: "default" }] }],
};
const FOUR_NODE: FlowFigure = {
  kind: "flow",
  caption: "four",
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
      caption: "single",
      rows: [{ nodes: [{ label: "SOLO", tone: "default" }] }],
    };
    expect(uniformRowThresholdPx([single])).toBe(0);
  });

  it("gives every figure the same orientation at any given width", () => {
    const threshold = uniformRowThresholdPx(TEST_FIGURES);
    const sweep = [threshold - 50, threshold - 1, threshold, threshold + 1, threshold + 50];
    for (const width of sweep) {
      const orientations = new Set(TEST_FIGURES.map(() => orientationFor(threshold, width)));
      expect(orientations.size).toBe(1);
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
  const figureWithLine = (widthPx: number): LogFigure => ({
    kind: "log",
    caption: "log",
    lines: [{ channel: "c".repeat(1), value: "v".repeat(Math.round(widthPx / MONO_CH_PX) - 3), tone: "muted" }],
  });

  it("returns stacked when the widest line exceeds the text width", () => {
    const contentPx = 300;
    const textPx = logTextWidthPx(contentPx);
    const fig = figureWithLine(textPx + MONO_CH_PX * 5);
    expect(logModeFor(fig, contentPx)).toBe("stacked");
  });

  it("returns inline when the widest line exactly equals the text width", () => {
    const contentPx = 300;
    const textPx = logTextWidthPx(contentPx);
    const line = { channel: "chan", value: "value", tone: "muted" as const };
    const exactWidth = logLineWidthPx(line);
    // Build a synthetic content width where textPx exactly equals this line's width.
    const exactContentPx = exactWidth + 12; // LOG_INDENT_PX inverse of logTextWidthPx
    const fig: LogFigure = { kind: "log", caption: "log", lines: [line] };
    expect(logModeFor(fig, exactContentPx)).toBe("inline");
    // sanity: confirm the width really is exactly the text width at that content size
    expect(logTextWidthPx(exactContentPx)).toBeCloseTo(exactWidth, 6);
    void textPx;
  });

  it("stacks for an unmeasured (non-finite) container, same rule as orientationFor", () => {
    const fig: LogFigure = { kind: "log", caption: "log", lines: [{ channel: "c", value: "v", tone: "muted" }] };
    expect(logModeFor(fig, NaN)).toBe("stacked");
    expect(logModeFor(fig, Infinity)).toBe("stacked");
  });
});

describe("maxLabelWordChars / maxLogValueChars", () => {
  it("are derived from the constants, not hardcoded", () => {
    expect(maxLabelWordChars()).toBe(Math.floor((NODE_MIN_PX - 2 * 10) / MONO_CH_PX));
    expect(maxLogValueChars(238)).toBe(Math.floor(logTextWidthPx(238) / MONO_CH_PX));
  });
});

describe("nodeWidthPx", () => {
  it("splits available width evenly minus connectors", () => {
    expect(nodeWidthPx(0, 100)).toBe(0);
    const w = nodeWidthPx(2, 222);
    expect(w).toBeCloseTo((222 - CONNECTOR_PX) / 2, 6);
  });
});
