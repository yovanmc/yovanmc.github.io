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
    caption: "You cannot do that with a shared short code",
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
    caption: "the implementer cannot pass by grading its own work",
  },
  "the-failure-that-left-no-logs": {
    kind: "log",
    lines: [
      { channel: "topic.orders", value: "delivered", tone: "muted" },
      { channel: "topic.orders.retry", value: "attempt 1", tone: "muted" },
      { channel: "topic.orders.retry", value: "error 400 html body", tone: "fault" },
      { channel: "app.ingress", value: "no entry", tone: "muted" },
      { channel: "app.handler", value: "no entry", tone: "muted" },
    ],
    caption: "just because every tool says everything is fine does not mean it is",
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
    caption: "Observability became a one-button setup, realistic to roll out across many services.",
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
    caption: "routes anything that ultimately fails into a dead-letter queue",
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
    caption: "The desktop app self-hosts as the server for that companion.",
  },
};

export function figureFor(slug: string | undefined): Figure | null {
  if (!slug) return null;
  return FIGURES[slug] ?? null;
}
