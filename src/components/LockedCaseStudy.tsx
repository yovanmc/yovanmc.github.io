import type { Item } from "../content";
import { readAnyway, sealedLine } from "../landingCopy";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

export interface LockedCaseStudyProps {
  item: Item;
  catLabel: string;
  isMobile: boolean;
  boss: string | null;
  onReveal: () => void;
  onClose: () => void;
}

/** Sealed treatment for the CaseStudyPage render boundary. The authoritative
 * gate is the `pageLocked` computation in App.tsx.
 *
 * A standalone overlay rather than a CaseStudyPage prop, so that "what
 * renders when locked" stays visible at the mount site instead of hiding
 * behind a flag inside the real page. Takes an explicit props contract rather
 * than reaching into App's module-level constants. Shows the real
 * title, meta and stat, replacing only the body, naming the guarding boss,
 * plus a "read it anyway" control that lets a visitor past the seal for this
 * session (App owns the `revealed` Set; nothing here persists it).
 */
export function LockedCaseStudy({ item, catLabel, isMobile, boss, onReveal, onClose }: LockedCaseStudyProps) {
  return (
    <div
      data-scroll
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-page-content]")) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "radial-gradient(ellipse 110% 90% at 50% 0%, #16284a 0%, #0a1124 52%, #060a16 100%)",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
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
            role="button"
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
              fontFamily: MONO,
              fontSize: "12px",
              letterSpacing: ".12em",
            }}
          >
            <span style={{ color: "#7fb0ff" }}>◂</span> BACK{" "}
            <span style={{ color: "#5f7196", display: isMobile ? "none" : "inline" }}>ESC</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".4em", color: "#7fb0ff" }}>
            {catLabel.toUpperCase()}
          </div>
        </div>

        <div style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: ".32em", color: "#9fc0ec", marginBottom: "14px" }}>
          {item.meta}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            fontFamily: SERIF,
            fontSize: "clamp(38px,8vw,62px)",
            lineHeight: 1.04,
            color: "#f2f6fc",
            letterSpacing: ".01em",
            marginBottom: "22px",
          }}
        >
          {item.title}
          <span aria-label="Sealed" role="img" style={{ fontSize: "0.42em", color: "#9fb6d6" }}>
            🔒
          </span>
        </div>

        {!!item.stat && (
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
            <span style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: ".1em", color: "#cfe0ff" }}>{item.stat}</span>
          </div>
        )}

        <div style={{ color: "#c2cee2", fontSize: "17px", lineHeight: 1.78, maxWidth: "680px", marginBottom: "34px" }}>
          {sealedLine(boss)}
        </div>

        <div
          onClick={onReveal}
          role="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "13px 22px",
            borderRadius: "11px",
            cursor: "pointer",
            background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(160,175,200,.3)",
            color: "#cfd8ec",
            fontSize: "13.5px",
            letterSpacing: ".04em",
            fontFamily: "'Sora',sans-serif",
          }}
        >
          <span style={{ color: "#9aa8c4" }}>▸</span>
          {readAnyway}
        </div>
      </div>
    </div>
  );
}
