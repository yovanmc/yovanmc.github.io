import { CATS } from "../content";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

/**
 * The browse path — milestone 3. One flat, scannable index over the dimmed
 * scene: every item visible under three section headers, no tabs, no second
 * navigation surface (plan v2, dissect F16). Rows delegate to App's existing
 * activate() semantics — projects/experience open their case-study pages,
 * contact rows copy/link. Recruiter-grade: everything reachable, ctrl-F-able.
 */

interface BrowseIndexProps {
  isMobile: boolean;
  /** Reuses App.activate(ri, si) verbatim — the single source of item semantics. */
  onItem: (ri: number, si: number) => void;
  onEnterGame: () => void;
}

export function BrowseIndex({ isMobile, onItem, onEnterGame }: BrowseIndexProps) {
  return (
    <div
      data-ui
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        display: "flex",
        justifyContent: "center",
        overflowY: "auto",
        padding: isMobile ? "0" : "48px 20px 40px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isMobile ? "none" : "720px",
          height: "max-content",
          minHeight: isMobile ? "100%" : "auto",
          background: "linear-gradient(165deg, rgba(14,28,56,.88), rgba(8,14,30,.9))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: isMobile ? "none" : "1px solid rgba(130,180,255,.26)",
          borderRadius: isMobile ? 0 : "18px",
          boxShadow: isMobile ? "none" : "inset 0 0 0 1px rgba(255,255,255,.04), 0 30px 80px -24px rgba(0,0,0,.8)",
          padding: isMobile ? "26px 18px 60px" : "34px 40px 40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: "30px", letterSpacing: ".04em", color: "#eaf1ff" }}>Yovan</div>
            <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".38em", color: "#7fb0ff", marginTop: "4px" }}>
              BACKEND SOFTWARE ENGINEER
            </div>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={onEnterGame}
            style={{
              fontFamily: MONO,
              fontSize: "11.5px",
              letterSpacing: ".1em",
              color: "#b9d2f8",
              padding: "9px 14px",
              borderRadius: "9px",
              cursor: "pointer",
              background: "rgba(80,150,255,.1)",
              border: "1px solid rgba(140,185,255,.3)",
            }}
          >
            <span style={{ color: "#9fc4ff" }}>▸</span> enter the game
          </div>
        </div>

        {CATS.map((cat, ri) => (
          <div key={cat.key} style={{ marginTop: "30px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".4em", color: "#7fb0ff" }}>
                {cat.label.toUpperCase()}
              </span>
              <span style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, rgba(140,185,255,.4), transparent)" }} />
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".14em", color: "#5f7196" }}>{cat.tag}</span>
            </div>
            <div style={{ marginTop: "12px" }}>
              {cat.items.map((it, si) => (
                <div
                  key={si}
                  role="button"
                  tabIndex={0}
                  onClick={() => onItem(ri, si)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onItem(ri, si);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "13px 14px",
                    marginBottom: "6px",
                    borderRadius: "11px",
                    cursor: "pointer",
                    background: "rgba(255,255,255,.02)",
                    border: "1px solid rgba(140,185,255,.14)",
                    transition: "background .15s ease, border-color .15s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(80,150,255,.1)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(150,190,255,.4)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,.02)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(140,185,255,.14)";
                  }}
                >
                  <span style={{ color: "#7fb0ff", fontSize: "13px" }}>▸</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: SERIF, fontSize: "18.5px", color: "#eaf1ff" }}>{it.title}</div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: "11px",
                        letterSpacing: ".05em",
                        color: "#9fb6d6",
                        marginTop: "3px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.meta}
                    </div>
                  </div>
                  {!!it.stat && (
                    <span
                      style={{
                        fontFamily: MONO,
                        fontSize: "10px",
                        letterSpacing: ".04em",
                        color: "#cfe0ff",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        background: "rgba(80,150,255,.12)",
                        border: "1px solid rgba(140,185,255,.24)",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {it.stat}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ marginTop: "26px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".12em", color: "#5f7196", textAlign: "center" }}>
          <span style={{ color: "#9fc4ff" }}>ESC</span> BACK TO ENTRY
        </div>
      </div>
    </div>
  );
}
