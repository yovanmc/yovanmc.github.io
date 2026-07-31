import type { FlowFigure, LogFigure, Orientation, LogMode } from "./types";

/**
 * Narrowest a node may render and still hold its longest word on one line.
 * MEASURED in task A2a (docs/design-labs/s3-figures/measured-figure-type.json,
 * nodeMinPx: 109.765625 — a real render of "ORCHESTRATOR" at max-content with
 * the node's 9px 10px padding) and rounded UP to 110, per the plan: a
 * too-generous floor stacks a row that would have fit (safe); a too-tight one
 * ships an unreadable node (not safe).
 */
export const NODE_MIN_PX = 110;
/** Gap + arrow glyph + gap between two nodes. */
export const CONNECTOR_PX = 22;
/** Node's own horizontal padding, one side. Task A4 renders `9px 10px`. */
export const NODE_PAD_PX = 10;
/**
 * Figure container padding, one side. Reference only: it is already excluded
 * from every width in this module, because ResizeObserver reports the content
 * box. Do not subtract it in a layout function.
 */
export const FIGURE_PAD_PX = 20;
/** Left rule (2px) plus the stacked-mode value indent. */
export const LOG_INDENT_PX = 12;
/**
 * Advance width of one JetBrains Mono char at the figure's 11px + .08em.
 * MEASURED in task A2a (measured-figure-type.json, monoChPx: 7.480078125)
 * and rounded UP to 7.49 (2 decimal places, no further — anything above 7.5
 * drops maxLabelWordChars() from 12 to 11 and makes ORCHESTRATOR, the
 * registry's longest label, illegal).
 */
export const MONO_CH_PX = 7.49;

/** Text width available to a log line. `contentPx` is already padding-free. */
export function logTextWidthPx(contentPx: number): number {
  return contentPx - LOG_INDENT_PX;
}

/** Longest log value, in characters, that fits at the narrowest real container. */
export function maxLogValueChars(narrowestContentPx: number): number {
  return Math.floor(logTextWidthPx(narrowestContentPx) / MONO_CH_PX);
}

/** Longest single word, in characters, a node can hold on one line. */
export function maxLabelWordChars(): number {
  return Math.floor((NODE_MIN_PX - 2 * NODE_PAD_PX) / MONO_CH_PX);
}

/** Page padding at a viewport width. Replicates `clamp(20px, 5vw, 44px)`. */
export function pagePadPx(vw: number): number {
  return Math.min(Math.max(20, vw * 0.05), 44);
}

/**
 * Figure content-box width at a viewport width. This is a REPLICATION of the
 * CSS chain, not a measurement, and it exists so the viewport sweep can assert
 * in the domain the layout functions actually consume. It is pinned to reality
 * at one point: a test asserts it agrees with the A2a fixture at 320px. If the
 * page's padding or the figure's chrome changes, that test is what fails.
 */
export function contentWidthForViewport(vw: number): number {
  return Math.min(960, vw) - 2 * pagePadPx(vw) - 2 * FIGURE_PAD_PX - 2;
}

export function rowFits(nodeCount: number, availablePx: number): boolean {
  if (nodeCount <= 1) return true;
  return nodeCount * NODE_MIN_PX + (nodeCount - 1) * CONNECTOR_PX <= availablePx;
}

export function nodeWidthPx(nodeCount: number, availablePx: number): number {
  if (nodeCount <= 0) return 0;
  const connectors = (nodeCount - 1) * CONNECTOR_PX;
  return (availablePx - connectors) / nodeCount;
}

/**
 * The one width at which EVERY flow figure in the registry flips orientation.
 * Deriving a single threshold across the whole registry is what makes the
 * uniformity claim true. A per-figure `rows.every(rowFits)` test would let a
 * 3-node figure render horizontally while a 4-node one stacked, on the same
 * device, in a real band of viewport widths. Pass 2 caught that: the original
 * `STACK_BELOW_PX = 420` constant claimed uniformity it did not deliver.
 */
export function uniformRowThresholdPx(figures: FlowFigure[]): number {
  let widest = 0;
  for (const f of figures) {
    for (const r of f.rows) {
      const n = r.nodes.length;
      if (n <= 1) continue;
      widest = Math.max(widest, n * NODE_MIN_PX + (n - 1) * CONNECTOR_PX);
    }
  }
  return widest;
}

export function orientationFor(thresholdPx: number, availablePx: number): Orientation {
  if (!Number.isFinite(availablePx)) return "column";
  return availablePx >= thresholdPx ? "row" : "column";
}

export function logLineWidthPx(line: { channel: string; value: string }): number {
  return (line.channel.length + 2 + line.value.length) * MONO_CH_PX;
}

export function logModeFor(figure: LogFigure, availablePx: number): LogMode {
  if (!Number.isFinite(availablePx)) return "stacked";
  const widest = figure.lines.reduce((m, l) => Math.max(m, logLineWidthPx(l)), 0);
  return widest <= logTextWidthPx(availablePx) ? "inline" : "stacked";
}
