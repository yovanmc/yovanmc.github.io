import type { FlowFigure, LogFigure, Orientation, LogMode } from "./types";

/**
 * Narrowest a node may render and still hold its longest word on one line:
 * "ORCHESTRATOR" at max-content with 9px 10px padding measured 109.765625
 * (measuredFigureType.ts), rounded UP. Too generous stacks a row that would
 * have fit (safe); too tight ships an unreadable node.
 */
export const NODE_MIN_PX = 110;
/** Gap + arrow glyph + gap between two nodes. */
export const CONNECTOR_PX = 22;
/** Node's own horizontal padding, one side. A node renders `9px 10px`. */
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
 * Advance of one JetBrains Mono char at 11px + .08em: measured 7.480078125,
 * rounded UP to 2 decimals only. Above 7.5, maxLabelWordChars() drops from 12
 * to 11 and ORCHESTRATOR, the longest label, becomes illegal.
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
 * Figure content-box width at a viewport width. A replication of the CSS
 * chain, not a measurement, so the viewport sweep asserts in the domain the
 * layout functions consume. A test pins it to the measured fixture at 320px;
 * that test fails if the page padding or figure chrome changes.
 */
export function contentWidthForViewport(vw: number): number {
  return Math.min(960, vw) - 2 * pagePadPx(vw) - 2 * FIGURE_PAD_PX - 2;
}

export function rowFits(nodeCount: number, availablePx: number): boolean {
  if (nodeCount <= 1) return true;
  return nodeCount * NODE_MIN_PX + (nodeCount - 1) * CONNECTOR_PX <= availablePx;
}

/**
 * The one width at which every flow figure in the registry flips orientation.
 * A per-figure fit test would let a 3-node figure stay horizontal while a
 * 4-node one stacks on the same device; a fixed constant would not track the
 * registry.
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

/**
 * The one width at which every log figure in the registry flips mode, for the
 * same reason as `uniformRowThresholdPx`: at 390px a per-figure rule would
 * render `the-failure-that-left-no-logs` (39 chars, fits) inline and
 * `notification-dispatch` (40 chars, does not) stacked.
 */
export function uniformLogThresholdPx(figures: LogFigure[]): number {
  let widest = 0;
  for (const f of figures) {
    for (const l of f.lines) {
      widest = Math.max(widest, logLineWidthPx(l));
    }
  }
  return widest;
}

export function logModeFor(thresholdPx: number, availablePx: number): LogMode {
  if (!Number.isFinite(availablePx)) return "stacked";
  return logTextWidthPx(availablePx) >= thresholdPx ? "inline" : "stacked";
}
