export type Tone = "default" | "fix" | "fault" | "muted";

export interface FigureNode {
  label: string;
  tone: Tone;
}

export interface FlowRow {
  nodes: FigureNode[];
}

export interface LogLine {
  channel: string;
  value: string;
  tone: Tone;
}

export interface FlowFigure {
  kind: "flow";
  rows: FlowRow[];
  caption: string;
}

export interface LogFigure {
  kind: "log";
  lines: LogLine[];
  caption: string;
}

export type Figure = FlowFigure | LogFigure;

export type Orientation = "row" | "column";
export type LogMode = "inline" | "stacked";
