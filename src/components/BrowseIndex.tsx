import { CATS } from "../content";
import { rowHref } from "../router";
import { shouldRouteInApp } from "../site/linkClick";
import { nameLine } from "../landingCopy";
import { buildEntryTitle, buildEntryMeta } from "../buildCopy";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

/**
 * The browse path. One flat, scannable index over the dimmed
 * scene: every item visible under three section headers, no tabs, no second
 * navigation surface. Rows delegate to App's existing
 * activate() semantics, so projects and experience open their case-study
 * pages and contact rows copy or link. Everything is reachable and ctrl-F-able.
 */

interface BrowseIndexProps {
  isMobile: boolean;
  /** Reuses App.activate(ri, si), the single source of item semantics. */
  onItem: (ri: number, si: number) => void;
  /** Optional so every caller keeps compiling unchanged. When present, a
   * click routes in-app via goPhase("build"); when absent the anchor still
   * hard-navigates to /build/, so it never no-ops. */
  onBuild?: () => void;
}

export function BrowseIndex({ isMobile, onItem, onBuild }: BrowseIndexProps) {
  // The /build/ page's entry row, listed with the projects. Same row anatomy
  // as the category items.
  const buildRow = (
    <a
      href="/build/"
      onClick={(e) => {
        if (!shouldRouteInApp(e)) return;
        e.preventDefault();
        onBuild?.();
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(80,150,255,.1)";
        e.currentTarget.style.borderColor = "rgba(150,190,255,.4)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,.02)";
        e.currentTarget.style.borderColor = "rgba(140,185,255,.14)";
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
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <span style={{ color: "#7fb0ff", fontSize: "13px" }}>▸</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SERIF, fontSize: "18.5px", color: "#eaf1ff" }}>{buildEntryTitle}</div>
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
          {buildEntryMeta}
        </div>
      </div>
    </a>
  );

  return (
    <main
      id="main"
      tabIndex={-1}
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
      {/* Visually-hidden page heading: the visible
          "Yovan" wordmark above is a persistent site header repeated on every
          browse view, not a page-specific "All work" heading, so it stays as
          plain chrome and this h1 carries the one-per-surface a11y title
          instead. */}
      <h1 style={{ position: "absolute", left: "-9999px" }}>{nameLine}</h1>
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
              {cat.items.map((it, si) => {
                const href = rowHref(it, ri, si);
                const external = !it.slug && href !== null;
                const rowStyle: React.CSSProperties = {
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
                  ...(href ? { textDecoration: "none", color: "inherit" } : {}),
                };
                const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.background = "rgba(80,150,255,.1)";
                  e.currentTarget.style.borderColor = "rgba(150,190,255,.4)";
                };
                const onMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
                  e.currentTarget.style.background = "rgba(255,255,255,.02)";
                  e.currentTarget.style.borderColor = "rgba(140,185,255,.14)";
                };
                const rowBody = (
                  <>
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
                  </>
                );
                if (href) {
                  return (
                    <a
                      key={si}
                      href={href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      onClick={(e) => {
                        if (!shouldRouteInApp(e)) return;
                        e.preventDefault();
                        onItem(ri, si);
                      }}
                      style={rowStyle}
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                    >
                      {rowBody}
                    </a>
                  );
                }
                return (
                  <div
                    key={si}
                    role="button"
                    tabIndex={0}
                    onClick={() => onItem(ri, si)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onItem(ri, si);
                    }}
                    style={rowStyle}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                  >
                    {rowBody}
                  </div>
                );
              })}
              {cat.key === "projects" && buildRow}
            </div>
          </div>
        ))}

        <div style={{ marginTop: "10px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".12em", color: "#5f7196", textAlign: "center" }}>
          <span style={{ color: "#9fc4ff" }}>ESC</span> BACK TO ENTRY
        </div>
      </div>
    </main>
  );
}
