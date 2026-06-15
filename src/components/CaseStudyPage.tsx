import { useMemo, type CSSProperties, type ReactNode } from "react";
import { CATS, type Link } from "../content";
import { rng } from "../lib/rng";

export interface PageRef {
  ri: number;
  si: number;
}

interface CaseStudyPageProps {
  page: PageRef | null;
  isMobile: boolean;
  onClose: () => void;
}

function buildGlints(): ReactNode {
  const r = rng(131);
  const items: ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const op = 0.2 + r() * 0.4;
    const style: CSSProperties = {
      position: "absolute",
      left: r() * 100 + "%",
      top: r() * 100 + "%",
      width: 3 + r() * 4 + "px",
      height: 3 + r() * 4 + "px",
      background: `rgba(200,225,255,${op})`,
      boxShadow: `0 0 7px 1px rgba(185,218,255,${op})`,
      transform: "rotate(45deg)",
      animation: `twinkle ${(3 + r() * 3.5).toFixed(2)}s ease-in-out ${(-r() * 5).toFixed(2)}s infinite`,
    };
    items.push(<span key={"g" + i} style={style} />);
  }
  return items;
}

const mono = "'JetBrains Mono',monospace";

export function CaseStudyPage({ page, isMobile, onClose }: CaseStudyPageProps) {
  const glints = useMemo(() => buildGlints(), []);
  const open = !!page;
  const cat = page ? CATS[page.ri] : null;
  const item = page && cat ? cat.items[page.si] : null;
  const isProject = cat ? cat.key === "projects" : false;
  const showPeriod = !!(item && cat && cat.key !== "projects" && item.stat);
  const metrics = item?.metrics ?? [];
  const tags = item?.tags ?? [];
  const ext: Link | null = item?.repo
    ? { label: "VIEW REPOSITORY", url: item.repo }
    : item?.announcement ?? null;
  const sources = item?.sources ?? [];
  const idxLabel =
    page && cat
      ? String(page.si + 1).padStart(2, "0") + " / " + String(cat.items.length).padStart(2, "0")
      : "";

  const onBgClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("[data-page-content]")) onClose();
  };

  return (
    <div
      data-scroll
      onClick={onBgClick}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "radial-gradient(ellipse 110% 90% at 50% 0%, #16284a 0%, #0a1124 52%, #060a16 100%)",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
        transform: open ? "scale(1)" : "scale(1.025)",
        transition: "opacity .45s ease, transform .55s cubic-bezier(.16,1,.3,1)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {glints}
      </div>

      <div
        data-page-content
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "clamp(64px,9vw,84px) clamp(20px,5vw,44px) 120px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "42px" }}>
          <div
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "11px",
              padding: "11px 18px",
              borderRadius: "11px",
              cursor: "pointer",
              background: "rgba(80,150,255,.1)",
              border: "1px solid rgba(140,185,255,.3)",
              color: "#cfe0ff",
              fontFamily: mono,
              fontSize: "12px",
              letterSpacing: ".12em",
            }}
          >
            <span style={{ color: "#7fb0ff" }}>◂</span> BACK{" "}
            <span style={{ color: "#5f7196", display: isMobile ? "none" : "inline" }}>ESC</span>
          </div>
          <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: ".4em", color: "#7fb0ff" }}>
            {cat ? cat.label.toUpperCase() : ""} <span style={{ color: "#5f7196" }}>· {idxLabel}</span>
          </div>
        </div>

        {isProject && (
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "clamp(200px,46vw,340px)",
              borderRadius: "18px",
              overflow: "hidden",
              border: "1px solid rgba(140,185,255,.26)",
              background:
                "repeating-linear-gradient(45deg, rgba(120,170,255,.08) 0 12px, rgba(120,170,255,.02) 12px 24px), linear-gradient(160deg, rgba(20,40,78,.5), rgba(10,18,38,.5))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 0 80px rgba(60,120,220,.12)",
              marginBottom: "clamp(30px,6vw,46px)",
            }}
          >
            <span style={{ fontFamily: mono, fontSize: "12px", letterSpacing: ".24em", color: "#7f93b8" }}>
              PROJECT SHOT / DIAGRAM
            </span>
          </div>
        )}

        <div style={{ fontFamily: mono, fontSize: "12px", letterSpacing: ".32em", color: "#9fc0ec", marginBottom: "14px" }}>
          {item?.meta}
        </div>
        <div
          style={{
            fontFamily: "'Marcellus',serif",
            fontSize: "clamp(38px,8vw,62px)",
            lineHeight: 1.04,
            color: "#f2f6fc",
            letterSpacing: ".01em",
            filter: "drop-shadow(0 0 26px rgba(90,150,255,.3))",
            marginBottom: "22px",
          }}
        >
          {item?.title}
        </div>

        {showPeriod && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              marginBottom: "34px",
              padding: "9px 16px",
              borderRadius: "9px",
              background: "rgba(80,150,255,.1)",
              border: "1px solid rgba(140,185,255,.26)",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7fb0ff", boxShadow: "0 0 8px #7fb0ff" }} />
            <span style={{ fontFamily: mono, fontSize: "12px", letterSpacing: ".1em", color: "#cfe0ff" }}>{item?.stat}</span>
          </div>
        )}

        {metrics.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "44px" }}>
            {metrics.map((m, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "20px 22px",
                  borderRadius: "13px",
                  background: "linear-gradient(160deg, rgba(20,40,78,.5), rgba(10,18,38,.45))",
                  border: "1px solid rgba(140,185,255,.22)",
                }}
              >
                <div style={{ fontFamily: "'Marcellus',serif", fontSize: "30px", color: "#eaf2ff", letterSpacing: ".01em" }}>{m[0]}</div>
                <div style={{ fontFamily: mono, fontSize: "10.5px", letterSpacing: ".1em", color: "#8ea0bd", marginTop: "7px", textTransform: "uppercase" }}>
                  {m[1]}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: ".34em", color: "#7fb0ff", marginBottom: "14px" }}>OVERVIEW</div>
        <div style={{ color: "#c2cee2", fontSize: "17px", lineHeight: 1.78, maxWidth: "680px", marginBottom: "42px" }}>
          {item ? item.summary ?? item.body : ""}
        </div>

        <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: ".34em", color: "#7fb0ff", marginBottom: "14px" }}>STACK</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "9px", marginBottom: "46px" }}>
          {tags.map((t, i) => (
            <span
              key={i}
              style={{
                fontFamily: mono,
                fontSize: "12px",
                color: "#aec6ee",
                padding: "8px 15px",
                borderRadius: "20px",
                background: "rgba(80,150,255,.1)",
                border: "1px solid rgba(140,185,255,.24)",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {ext && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              window.open(ext.url, "_blank", "noopener");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "14px 24px",
              borderRadius: "11px",
              cursor: "pointer",
              background: "linear-gradient(100deg, rgba(80,150,255,.26), rgba(80,150,255,.06))",
              border: "1px solid rgba(140,185,255,.4)",
              color: "#eaf2ff",
              fontSize: "14px",
              letterSpacing: ".06em",
              boxShadow: "0 0 26px rgba(60,130,255,.14)",
            }}
          >
            <span style={{ color: "#9fc4ff" }}>▸</span> {ext.label}
          </div>
        )}

        {sources.length > 0 && (
          <>
            <div style={{ fontFamily: mono, fontSize: "11px", letterSpacing: ".34em", color: "#7fb0ff", margin: "46px 0 14px" }}>PRESS &amp; SOURCES</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {sources.map((s, i) => (
                <div
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(s.url, "_blank", "noopener");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "9px",
                    cursor: "pointer",
                    fontFamily: mono,
                    fontSize: "12.5px",
                    letterSpacing: ".02em",
                    color: "#9fc0ec",
                    maxWidth: "680px",
                  }}
                >
                  <span style={{ color: "#7fb0ff" }}>↗</span>
                  {s.label}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
