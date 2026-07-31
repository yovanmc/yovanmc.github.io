import { describe, expect, it } from "vitest";
import { CATS } from "../content";
import { FIGURES, figureFor } from "./registry";
import type { Figure, FlowFigure, LogFigure } from "./types";
import {
  contentWidthForViewport,
  logLineWidthPx,
  logModeFor,
  logTextWidthPx,
  maxLabelWordChars,
  maxLogValueChars,
  orientationFor,
  rowFits,
  uniformRowThresholdPx,
} from "./layout";
import { MEASURED_FIGURE_TYPE } from "./__fixtures__/measuredFigureType";

const NARROWEST_CONTENT_PX = MEASURED_FIGURE_TYPE.narrowestContentPx;

export const VIEWPORTS = [320, 360, 390, 480, 510, 560, 768, 800, 1024, 1280, 1440];

// Registry test 9's sole exception (dispatch item 7): an explicit allowlist,
// not a loosened regex. "OR" is a channel enumeration in this one label.
const CONJUNCTION_ALLOWLIST: readonly string[] = ["VOICE OR TEXT"];

const allProjectItems = CATS.find((c) => c.key === "projects")!.items;

function isFlow(fig: Figure): fig is FlowFigure {
  return fig.kind === "flow";
}
function isLog(fig: Figure): fig is LogFigure {
  return fig.kind === "log";
}

function allStrings(fig: Figure): string[] {
  if (isFlow(fig)) {
    return [fig.caption, ...fig.rows.flatMap((r) => r.nodes.map((n) => n.label))];
  }
  return [fig.caption, ...fig.lines.flatMap((l) => [l.channel, l.value])];
}

describe("caption provenance", () => {
  it("every figure caption is a verbatim substring of its item's summary (or body)", () => {
    for (const [slug, fig] of Object.entries(FIGURES)) {
      const item = allProjectItems.find((i) => i.slug === slug);
      expect(item, `no CATS project item for slug "${slug}"`).toBeTruthy();
      const prose = item!.summary ?? item!.body;
      expect(prose.includes(fig.caption), `caption for "${slug}" is not a substring of its prose`).toBe(true);
    }
  });
});

describe("slug coverage", () => {
  it("every project item with a slug has a figure, and every figure key is a project slug", () => {
    const projectSlugs = allProjectItems.map((i) => i.slug).filter((s): s is string => !!s);
    for (const slug of projectSlugs) {
      expect(FIGURES[slug], `missing figure for project slug "${slug}"`).toBeTruthy();
    }
    for (const key of Object.keys(FIGURES)) {
      expect(projectSlugs).toContain(key);
    }
  });
});

describe("punctuation rule", () => {
  it("no figure string contains an em dash, en dash, or semicolon", () => {
    for (const [slug, fig] of Object.entries(FIGURES)) {
      for (const s of allStrings(fig)) {
        expect(s, `"${slug}": "${s}"`).not.toMatch(/[—–;]/);
      }
    }
  });
});

describe("legibility cap, derived", () => {
  it("every node label's longest word is at most maxLabelWordChars()", () => {
    const cap = maxLabelWordChars();
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isFlow(fig)) continue;
      for (const row of fig.rows) {
        for (const node of row.nodes) {
          for (const word of node.label.split(/\s+/)) {
            expect(word.length, `"${slug}" label "${node.label}" word "${word}"`).toBeLessThanOrEqual(cap);
          }
        }
      }
    }
  });
});

describe("log line cap, derived", () => {
  it("every channel is at most 24 chars and every value at most maxLogValueChars(NARROWEST_CONTENT_PX)", () => {
    const cap = maxLogValueChars(NARROWEST_CONTENT_PX);
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isLog(fig)) continue;
      for (const line of fig.lines) {
        expect(line.channel.length, `"${slug}" channel "${line.channel}"`).toBeLessThanOrEqual(24);
        expect(line.value.length, `"${slug}" value "${line.value}"`).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe("tone discipline", () => {
  it("fault appears at most once per figure", () => {
    for (const [slug, fig] of Object.entries(FIGURES)) {
      const tones = isFlow(fig)
        ? fig.rows.flatMap((r) => r.nodes.map((n) => n.tone))
        : fig.lines.map((l) => l.tone);
      const faults = tones.filter((t) => t === "fault").length;
      expect(faults, `"${slug}" has ${faults} fault-toned entries`).toBeLessThanOrEqual(1);
    }
  });
});

describe("flow viewport sweep, in the container domain", () => {
  const flowFigures = Object.values(FIGURES).filter(isFlow);
  const threshold = uniformRowThresholdPx(flowFigures);

  it("is column at 320, 360, 390 and row at 768 and above", () => {
    for (const vw of VIEWPORTS) {
      const contentPx = contentWidthForViewport(vw);
      const orientation = orientationFor(threshold, contentPx);
      if (vw <= 390) expect(orientation, `vw=${vw}`).toBe("column");
      if (vw >= 768) expect(orientation, `vw=${vw}`).toBe("row");
    }
  });

  it("the registry-wide threshold dominates every individual figure's own requirement", () => {
    for (const figure of flowFigures) {
      expect(uniformRowThresholdPx([figure])).toBeLessThanOrEqual(threshold);
    }
  });

  it("never asks a figure to render a row in a space too small for it, at any width in the sweep", () => {
    for (const vw of VIEWPORTS) {
      const contentPx = contentWidthForViewport(vw);
      for (const figure of flowFigures) {
        if (orientationFor(threshold, contentPx) !== "row") continue;
        for (const row of figure.rows) {
          expect(rowFits(row.nodes.length, contentPx), `vw=${vw}`).toBe(true);
        }
      }
    }
  });
});

describe("log viewport sweep, in the container domain", () => {
  it("both log figures are stacked at a 320 viewport and inline at 1440 (a mode actually occurs at both ends)", () => {
    // Real content, not a shape assertion: if logModeFor always returned
    // "stacked" (or always "inline"), every `if (mode === "inline") ...`
    // check below would still pass vacuously. Pin both actual endpoints
    // instead. Verified against the registry's real strings: the widest
    // lines are 39 chars ("the-failure-that-left-no-logs", ~292px) and 40
    // chars ("notification-dispatch", ~300px) against a 226px text width at
    // 320 (both exceed it: stacked) and an 818px text width at 1440 (both
    // fit: inline).
    const contentAt320 = contentWidthForViewport(320);
    const contentAt1440 = contentWidthForViewport(1440);
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isLog(fig)) continue;
      expect(logModeFor(fig, contentAt320), `"${slug}" at 320`).toBe("stacked");
      expect(logModeFor(fig, contentAt1440), `"${slug}" at 1440`).toBe("inline");
    }
  });

  it("inline only when the widest line genuinely fits the text width, and every stacked value fits at 320", () => {
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isLog(fig)) continue;
      for (const vw of VIEWPORTS) {
        const contentPx = contentWidthForViewport(vw);
        const mode = logModeFor(fig, contentPx);
        const widest = fig.lines.reduce((m, l) => Math.max(m, logLineWidthPx(l)), 0);
        if (mode === "inline") {
          expect(widest, `"${slug}" vw=${vw}`).toBeLessThanOrEqual(logTextWidthPx(contentPx));
        }
      }
    }
    // Every stacked value fits the text width at the narrowest viewport (320).
    const contentAt320 = contentWidthForViewport(320);
    const capAt320 = maxLogValueChars(contentAt320);
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isLog(fig)) continue;
      for (const line of fig.lines) {
        expect(line.value.length, `"${slug}" value "${line.value}" at 320px`).toBeLessThanOrEqual(capAt320);
      }
    }
  });
});

describe("no prose in labels", () => {
  it("every node label is bare uppercase tokens with no article/conjunction (VOICE OR TEXT allowlisted)", () => {
    const banned = new Set(["A", "AN", "THE", "AND", "OR"]);
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isFlow(fig)) continue;
      for (const row of fig.rows) {
        for (const node of row.nodes) {
          expect(node.label, `"${slug}" label "${node.label}"`).toMatch(/^[A-Z0-9 ]+$/);
          if (CONJUNCTION_ALLOWLIST.includes(node.label)) continue;
          for (const word of node.label.split(/\s+/)) {
            expect(banned.has(word), `"${slug}" label "${node.label}" contains "${word}"`).toBe(false);
          }
        }
      }
    }
  });

  it("every log channel is lowercase dotted", () => {
    for (const [slug, fig] of Object.entries(FIGURES)) {
      if (!isLog(fig)) continue;
      for (const line of fig.lines) {
        expect(line.channel, `"${slug}" channel "${line.channel}"`).toMatch(/^[a-z0-9.]+$/);
      }
    }
  });
});

describe("figureFor", () => {
  it("returns null for an undefined or unknown slug", () => {
    expect(figureFor(undefined)).toBeNull();
    expect(figureFor("no-such-slug")).toBeNull();
  });

  it("returns the registered figure for a known slug", () => {
    expect(figureFor("curio")).toBe(FIGURES.curio);
  });
});
