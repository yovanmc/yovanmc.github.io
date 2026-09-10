import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Figure as FigureData, Tone } from "../figures/types";
import { FIGURES } from "../figures/registry";
import { orientationFor, logModeFor, uniformLogThresholdPx, uniformRowThresholdPx } from "../figures/layout";
import { accessibleNameFor } from "../figures/accessibleName";

const mono = "'JetBrains Mono',monospace";

const TONE_STYLES: Record<Tone, { fill: string; border: string; text: string }> = {
  default: { fill: "rgba(80,150,255,.1)", border: "rgba(140,185,255,.24)", text: "#aec6ee" },
  fix: {
    fill: "linear-gradient(100deg, rgba(80,150,255,.26), rgba(80,150,255,.06))",
    border: "rgba(140,185,255,.4)",
    text: "#eaf2ff",
  },
  fault: { fill: "rgba(255,110,80,.12)", border: "rgba(255,139,107,.5)", text: "#ffb9a3" },
  muted: { fill: "rgba(80,150,255,.04)", border: "rgba(140,185,255,.12)", text: "#5f7196" },
};

const FLOW_FIGURES = Object.values(FIGURES).filter((f) => f.kind === "flow");
const ROW_THRESHOLD_PX = uniformRowThresholdPx(FLOW_FIGURES);
const LOG_FIGURES = Object.values(FIGURES).filter((f) => f.kind === "log");
const LOG_THRESHOLD_PX = uniformLogThresholdPx(LOG_FIGURES);

interface FigureProps {
  figure: FigureData;
  /** the owning project's title (Item.title); the figure has no title of its own */
  projectTitle: string;
}

export function Figure({ figure, projectTitle }: FigureProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contentWidthPx, setContentWidthPx] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContentWidthPx(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const orientation = orientationFor(ROW_THRESHOLD_PX, contentWidthPx);
  const logMode = figure.kind === "log" ? logModeFor(LOG_THRESHOLD_PX, contentWidthPx) : null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={accessibleNameFor(projectTitle)}
      style={{
        border: "1px solid rgba(140,185,255,.22)",
        borderRadius: "13px",
        padding: "18px 20px",
        background: "linear-gradient(160deg, rgba(20,40,78,.5), rgba(10,18,38,.45))",
      }}
    >
      {figure.kind === "flow" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {figure.rows.map((row, ri) => (
            <div
              key={ri}
              style={{
                display: "flex",
                flexDirection: orientation === "row" ? "row" : "column",
                alignItems: orientation === "row" ? "stretch" : "flex-start",
                gap: "0px",
              }}
            >
              {orientation === "row"
                ? row.nodes.flatMap((node, ni) => {
                    const tone = TONE_STYLES[node.tone];
                    const nodeStyle: CSSProperties = {
                      borderRadius: "11px",
                      fontFamily: mono,
                      fontSize: "11px",
                      letterSpacing: ".08em",
                      padding: "9px 10px",
                      textAlign: "center",
                      background: tone.fill,
                      border: `1px solid ${tone.border}`,
                      color: tone.text,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: 1,
                    };
                    const elements = [
                      <div key={`node-${ni}`} style={nodeStyle}>
                        {node.label}
                      </div>,
                    ];
                    if (ni < row.nodes.length - 1) {
                      elements.push(
                        <span
                          key={`conn-${ni}`}
                          style={{
                            color: "#7fb0ff",
                            fontFamily: mono,
                            fontSize: "12px",
                            padding: "0 11px",
                            flex: "0 0 auto",
                            alignSelf: "center",
                          }}
                        >
                          ▸
                        </span>,
                      );
                    }
                    return elements;
                  })
                : row.nodes.map((node, ni) => {
                    const tone = TONE_STYLES[node.tone];
                    const nodeStyle: CSSProperties = {
                      borderRadius: "11px",
                      fontFamily: mono,
                      fontSize: "11px",
                      letterSpacing: ".08em",
                      padding: "9px 10px",
                      textAlign: "center",
                      background: tone.fill,
                      border: `1px solid ${tone.border}`,
                      color: tone.text,
                    };
                    return (
                      <div key={ni} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={nodeStyle}>{node.label}</div>
                        {ni < row.nodes.length - 1 && (
                          <span
                            style={{
                              color: "#7fb0ff",
                              fontFamily: mono,
                              fontSize: "12px",
                              padding: "5px 0",
                            }}
                          >
                            ▾
                          </span>
                        )}
                      </div>
                    );
                  })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontFamily: mono, fontSize: "11px", lineHeight: 2 }}>
          {figure.lines.map((line, i) => {
            const tone = TONE_STYLES[line.tone];
            const ruled = line.tone !== "muted";
            return (
              <div
                key={i}
                style={{
                  borderLeft: ruled ? `2px solid ${tone.border}` : "2px solid transparent",
                  borderRadius: 0,
                  paddingLeft: "10px",
                  color: tone.text,
                }}
              >
                {logMode === "inline" ? (
                  <span>
                    {line.channel} <span style={{ color: "#7f93b8" }}>{line.value}</span>
                  </span>
                ) : (
                  <>
                    <div>{line.channel}</div>
                    <div style={{ paddingLeft: "12px", color: "#7f93b8" }}>{line.value}</div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
