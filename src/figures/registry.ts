import type { Figure } from "./types";

export const FIGURES: Record<string, Figure> = {
  mia: {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "VOICE OR TEXT", tone: "default" },
          { label: "DEDICATED NUMBER", tone: "default" },
          { label: "PERSONAL MIA", tone: "fix" },
        ],
      },
    ],
  },
  "backend-harness": {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "ORCHESTRATOR", tone: "default" },
          { label: "IMPLEMENTER", tone: "default" },
          { label: "EVALUATOR", tone: "default" },
          { label: "MUTATION GATE", tone: "fix" },
        ],
      },
      {
        nodes: [
          { label: "OSCILLATION", tone: "fault" },
          { label: "ESCALATE", tone: "fix" },
        ],
      },
    ],
  },
  "the-failure-that-left-no-logs": {
    kind: "log",
    lines: [
      { channel: "topic.events", value: "delivered", tone: "muted" },
      { channel: "topic.events.retry", value: "attempt 1", tone: "muted" },
      { channel: "topic.events.retry", value: "error 400 html body", tone: "fault" },
      { channel: "app.ingress", value: "no entry", tone: "muted" },
      { channel: "app.handler", value: "no entry", tone: "muted" },
    ],
  },
  "observability-by-default": {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "MANUAL SETUP", tone: "muted" },
          { label: "PER TEAM", tone: "muted" },
          { label: "SKIPPED", tone: "fault" },
        ],
      },
      {
        nodes: [
          { label: "API AUTOMATION", tone: "fix" },
          { label: "GOLDEN SIGNALS", tone: "default" },
          { label: "HEALTH PICTURE", tone: "default" },
        ],
      },
    ],
  },
  "notification-dispatch": {
    kind: "log",
    lines: [
      { channel: "stream.notify", value: "queued", tone: "muted" },
      { channel: "stream.notify", value: "attempt 1 failed", tone: "default" },
      { channel: "stream.notify", value: "attempt 2 failed", tone: "fault" },
      { channel: "stream.notify.dead", value: "held for inspection", tone: "fix" },
      { channel: "metrics.dispatch", value: "depth and lag exported", tone: "muted" },
    ],
  },
  curio: {
    kind: "flow",
    rows: [
      {
        nodes: [
          { label: "ONE LIBRARY", tone: "default" },
          { label: "DESKTOP APP", tone: "default" },
          { label: "SELF HOSTED", tone: "default" },
          { label: "PHONE COMPANION", tone: "fix" },
        ],
      },
    ],
  },
};

export function figureFor(slug: string | undefined): Figure | null {
  if (!slug) return null;
  return FIGURES[slug] ?? null;
}
