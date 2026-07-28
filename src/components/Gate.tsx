import { useEffect, useMemo, useRef, useState } from "react";
import { siteStationGeometry } from "./DiveIntro";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

/**
 * The fork — milestone 3's gate, attached at the intro's handoff. Two labeled
 * paths, keyboard-first (←/→/Enter), identity block sitting BELOW the disc
 * (the canon station's upper-center is occupied art; the old name-in-clear-sky
 * layout died with the old builder — plan v2, dissect F10).
 */

interface GateProps {
  onPlay: () => void;
  onBrowse: () => void;
  /** viewport width/height so placement tracks the station geometry */
  vw: number;
  vh: number;
  playMove: () => void;
  playEnter: () => void;
}

export function Gate({ onPlay, onBrowse, vw, vh, playMove, playEnter }: GateProps) {
  const [sel, setSel] = useState(0); // 0 = play, 1 = browse
  const selRef = useRef(sel);
  selRef.current = sel;

  const geom = useMemo(() => siteStationGeometry(vw, vh), [vw, vh]);
  const isMobile = vw < 760;
  const discBottom = geom.cy + geom.size / 2;
  // Identity + buttons live in the band below the disc; clamp so small
  // viewports compress the block instead of pushing it off-screen.
  const bandTop = Math.min(discBottom + (isMobile ? 18 : 26), vh - (isMobile ? 250 : 230));
  const nameSize = Math.max(40, Math.min(64, (vh - bandTop) * 0.28));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // legacy aliases (Right/Left/…) — old-Edge/IE naming, cheap to honor
      const k = e.key.replace(/^(Right|Left|Up|Down)$/, "Arrow$1").replace("Spacebar", " ");
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "ArrowUp" || k === "ArrowDown") {
        e.preventDefault();
        setSel((s) => 1 - s);
        playMove();
      } else if (k === "Enter" || k === " ") {
        e.preventDefault();
        playEnter();
        if (selRef.current === 0) onPlay();
        else onBrowse();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onPlay, onBrowse, playMove, playEnter]);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: isMobile ? "14px 22px" : "13px 26px",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "14.5px",
    letterSpacing: ".06em",
    fontFamily: "'Sora',sans-serif",
    color: active ? "#eef5ff" : "#b6c2da",
    background: active
      ? "linear-gradient(100deg, rgba(80,150,255,.3), rgba(80,150,255,.08))"
      : "linear-gradient(100deg, rgba(30,50,90,.4), rgba(20,32,60,.3))",
    border: active ? "1px solid rgba(150,190,255,.5)" : "1px solid rgba(130,180,255,.2)",
    boxShadow: active ? "0 0 28px rgba(70,140,255,.22)" : "none",
    transition: "background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease",
  });

  return (
    <div
      data-ui
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: bandTop + "px",
        zIndex: 8,
        textAlign: "center",
        padding: "0 18px",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: "11px",
          letterSpacing: ".5em",
          color: "#bcd6ff",
          paddingLeft: ".5em",
          marginBottom: "10px",
          textShadow: "0 1px 12px rgba(2,6,18,.9)",
        }}
      >
        PORTFOLIO
      </div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: nameSize + "px",
          lineHeight: 0.95,
          letterSpacing: ".08em",
          filter: "drop-shadow(0 0 28px rgba(90,150,255,.45))",
          background: "linear-gradient(100deg,#eaf2ff,#ffffff 30%,#86b4ff 55%,#ffffff 78%,#eaf2ff)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          animation: "shimmer 8s linear infinite",
        }}
      >
        Yovan
      </div>
      <div
        style={{
          marginTop: "8px",
          fontSize: "12px",
          letterSpacing: ".3em",
          color: "#d6e2f6",
          textTransform: "uppercase",
          textShadow: "0 1px 12px rgba(2,6,18,.9)",
        }}
      >
        Backend Software Engineer
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: isMobile ? "10px" : "16px",
          justifyContent: "center",
          alignItems: "center",
          marginTop: isMobile ? "18px" : "24px",
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={onPlay}
          onMouseEnter={() => {
            if (selRef.current !== 0) {
              setSel(0);
              playMove();
            }
          }}
          style={btnStyle(sel === 0)}
        >
          <span style={{ color: sel === 0 ? "#9fc4ff" : "transparent" }}>▸</span>
          Enter the game
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={onBrowse}
          onMouseEnter={() => {
            if (selRef.current !== 1) {
              setSel(1);
              playMove();
            }
          }}
          style={btnStyle(sel === 1)}
        >
          <span style={{ color: sel === 1 ? "#9fc4ff" : "transparent" }}>▸</span>
          View the work
        </div>
      </div>
      <div
        style={{
          marginTop: "14px",
          fontFamily: MONO,
          fontSize: "10.5px",
          letterSpacing: ".14em",
          color: "#5f7196",
        }}
      >
        <span style={{ color: "#9fc4ff" }}>←→</span> CHOOSE&nbsp;&nbsp;<span style={{ color: "#9fc4ff" }}>⏎</span> SELECT
      </div>
    </div>
  );
}
