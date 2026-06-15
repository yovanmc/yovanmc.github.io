import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CATS } from "./content";
import { Station } from "./components/Station";
import { Atmosphere } from "./components/Atmosphere";
import { CaseStudyPage, type PageRef } from "./components/CaseStudyPage";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";
const MOBILE_BREAKPOINT = 760;

// The KH stained-glass Station hero is temporarily hidden while the design is
// reworked. The component (and its scrim) stay intact — flip this to true to
// bring it back.
const SHOW_STATION = false;

type Col = "root" | "sub";

/** tiny WebAudio blip synth (lazily created, respects autoplay policy) */
function useBlips() {
  const ctxRef = useRef<AudioContext | null>(null);
  const resume = useCallback(() => {
    try {
      if (!ctxRef.current) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) ctxRef.current = new AC();
      }
      if (ctxRef.current && ctxRef.current.state === "suspended") void ctxRef.current.resume();
    } catch {
      /* ignore */
    }
  }, []);
  const blip = useCallback((freq: number, dur: number, type: OscillatorType, gain: number) => {
    try {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      /* ignore */
    }
  }, []);
  const move = useCallback(() => blip(620, 0.06, "square", 0.025), [blip]);
  const enter = useCallback(() => {
    blip(880, 0.07, "triangle", 0.035);
    window.setTimeout(() => blip(1320, 0.1, "triangle", 0.03), 55);
  }, [blip]);
  const back = useCallback(() => blip(300, 0.1, "square", 0.03), [blip]);
  return { resume, move, enter, back };
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [col, setCol] = useState<Col>("root");
  const [rootIdx, setRootIdx] = useState(0);
  const [subIdx, setSubIdx] = useState(0);
  const [page, setPage] = useState<PageRef | null>(null);
  const [toast, setToast] = useState("");
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);

  const snd = useBlips();
  const toastTimer = useRef<number | undefined>(undefined);

  // live mirror of state so the keydown listener always reads current values
  const stateRef = useRef({ booted, col, rootIdx, subIdx, page });
  stateRef.current = { booted, col, rootIdx, subIdx, page };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1900);
  }, []);

  const setRoot = useCallback(
    (i: number) => {
      snd.resume();
      if (i !== stateRef.current.rootIdx || stateRef.current.col !== "root") snd.move();
      setRootIdx(i);
      setSubIdx(0);
      setCol("root");
    },
    [snd],
  );

  const setSub = useCallback(
    (j: number) => {
      snd.resume();
      if (j !== stateRef.current.subIdx || stateRef.current.col !== "sub") snd.move();
      setSubIdx(j);
      setCol("sub");
    },
    [snd],
  );

  const enter = useCallback(() => {
    snd.resume();
    setBooted(true);
    setCol("sub");
    setSubIdx(0);
    snd.enter();
  }, [snd]);

  const openPage = useCallback(
    (ri: number, si: number) => {
      snd.resume();
      setPage({ ri, si });
      snd.enter();
    },
    [snd],
  );

  const closePage = useCallback(() => {
    setPage(null);
    snd.back();
  }, [snd]);

  const back = useCallback(() => {
    snd.resume();
    const s = stateRef.current;
    if (s.page) {
      setPage(null);
      snd.back();
    } else if (s.col === "sub") {
      setCol("root");
      snd.back();
    } else if (s.booted) {
      setBooted(false);
      snd.back();
    }
  }, [snd]);

  const activate = useCallback(
    (ri?: number, si?: number) => {
      snd.resume();
      const s = stateRef.current;
      const r = ri ?? s.rootIdx;
      const j = si ?? s.subIdx;
      const c = CATS[r];
      const it = c.items[j];
      if (c.key === "projects" || c.key === "experience") {
        openPage(r, j);
        return;
      }
      snd.enter();
      if (it.copy && navigator.clipboard) {
        navigator.clipboard.writeText(it.copy).catch(() => {});
        showToast("Copied " + it.copy);
      } else if (it.link && it.link !== "#" && it.link !== "") {
        window.open(it.link, "_blank", "noopener");
      }
    },
    [snd, openPage, showToast],
  );

  const bgClick = useCallback(
    (e: React.MouseEvent) => {
      snd.resume();
      const s = stateRef.current;
      if (s.page) return; // CaseStudyPage handles its own background clicks
      if (s.booted && !(e.target as HTMLElement).closest("[data-ui]")) {
        setBooted(false);
        setCol("root");
        snd.back();
      }
    },
    [snd],
  );

  // keyboard + resize
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Backspace", " "];
      if (handled.includes(k)) e.preventDefault();
      snd.resume();
      const s = stateRef.current;
      if (s.page) {
        if (k === "Escape" || k === "ArrowLeft" || k === "Backspace") back();
        return;
      }
      const c = CATS[s.rootIdx];
      if (k === "ArrowUp" || k === "ArrowDown") {
        const dir = k === "ArrowUp" ? -1 : 1;
        if (s.col === "root") {
          const n = CATS.length;
          setRoot((s.rootIdx + dir + n) % n);
        } else {
          const n = c.items.length;
          setSub((s.subIdx + dir + n) % n);
        }
      } else if (k === "ArrowRight" || k === "Enter" || k === " ") {
        if (s.col === "root") enter();
        else activate();
      } else if (k === "ArrowLeft" || k === "Escape" || k === "Backspace") {
        back();
      }
    };
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [snd, back, enter, activate, setRoot, setSub]);

  // ---- derived view values ----
  const isMobile = w < MOBILE_BREAKPOINT;
  const cat = CATS[rootIdx];
  const item = cat.items[subIdx] ?? cat.items[0];
  const ringOpacity = booted ? 0.2 : 0.82;
  const glassScale = isMobile ? Math.max(0.44, Math.min(0.62, (w - 30) / 680)) : 1;
  const heroScale = isMobile ? 0.56 : booted ? 0.9 : 1;
  const detailW = Math.max(330, Math.min(540, w - 612));
  const sheetOpen = isMobile && booted && !page;

  const rowStyle = (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 12px",
    borderRadius: "9px",
    marginBottom: "2px",
    cursor: "pointer",
    fontSize: "14.5px",
    letterSpacing: ".03em",
    transition: "background .18s ease, color .18s ease, border-color .18s ease",
    color: active ? "#eef5ff" : "#b6c2da",
    background: active ? "linear-gradient(90deg, rgba(90,160,255,.3), rgba(90,160,255,.05))" : "transparent",
    border: active ? "1px solid rgba(150,190,255,.4)" : "1px solid transparent",
    boxShadow: active ? "0 0 22px rgba(70,140,255,.18)" : "none",
    fontFamily: "'Sora',sans-serif",
  });
  const cursorStyle = (active: boolean, color = "#7fb0ff"): CSSProperties => ({
    width: "12px",
    color: active ? color : "transparent",
    textShadow: active ? "0 0 8px " + color : "none",
    animation: active ? "cursorBlink 1.1s ease-in-out infinite" : "none",
  });

  const catLabelUpper = cat.label.toUpperCase();
  const idxLabel = String(subIdx + 1).padStart(2, "0") + " / " + String(cat.items.length).padStart(2, "0");

  return (
    <div
      onClick={bgClick}
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        fontFamily: "'Sora',sans-serif",
        background: "radial-gradient(ellipse 110% 90% at 50% 16%, #15294d 0%, #0b1226 48%, #070b18 100%)",
        userSelect: "none",
      }}
    >
      <Atmosphere />

      {SHOW_STATION && <Station scale={glassScale} opacity={ringOpacity} top={isMobile ? "31%" : "40%"} />}

      {/* hero — idle */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: isMobile ? "31%" : "40%",
          transform: `translate(-50%,-50%) scale(${heroScale})`,
          textAlign: "center",
          width: "100%",
          zIndex: 3,
          pointerEvents: "none",
          opacity: booted ? 0 : 1,
          transition: "opacity .55s ease, transform .65s cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* focus scrim — only needed behind the luminous Station medallion to keep
            the eyebrow/name/subline legible; hidden when the Station is hidden */}
        {SHOW_STATION && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              width: "720px",
              height: "420px",
              background:
                "radial-gradient(ellipse 48% 60% at 50% 50%, rgba(4,8,20,.88) 0%, rgba(4,8,20,.6) 40%, rgba(4,8,20,0) 76%)",
              filter: "blur(9px)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontFamily: MONO,
              fontSize: "12px",
              letterSpacing: ".55em",
              color: "#bcd6ff",
              marginBottom: "20px",
              paddingLeft: ".55em",
              textShadow: "0 1px 14px rgba(2,6,18,.95), 0 0 6px rgba(2,6,18,.9)",
            }}
          >
            PORTFOLIO
          </div>
          <div
            style={{
              fontFamily: SERIF,
              fontSize: "120px",
              lineHeight: 0.92,
              letterSpacing: ".08em",
              filter: "drop-shadow(0 0 38px rgba(90,150,255,.5))",
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
              marginTop: "20px",
              fontSize: "14px",
              letterSpacing: ".34em",
              color: "#d6e2f6",
              textTransform: "uppercase",
              textShadow: "0 1px 14px rgba(2,6,18,.95), 0 0 6px rgba(2,6,18,.9)",
            }}
          >
            Backend Software Engineer
          </div>
        </div>
      </div>

      {/* header — browsing wordmark */}
      <div
        style={{
          position: "absolute",
          left: "40px",
          top: "34px",
          zIndex: 6,
          pointerEvents: "none",
          display: isMobile ? "none" : "block",
          opacity: booted ? 1 : 0,
          transform: `translateY(${booted ? "0" : "-10px"})`,
          transition: "opacity .55s ease .1s, transform .6s cubic-bezier(.16,1,.3,1) .1s",
        }}
      >
        <div style={{ fontFamily: SERIF, fontSize: "30px", letterSpacing: ".05em", color: "#eaf1ff", filter: "drop-shadow(0 0 16px rgba(90,150,255,.4))" }}>
          Yovan
        </div>
        <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".4em", color: "#7fb0ff", marginTop: "3px" }}>BACKEND SOFTWARE ENGINEER</div>
      </div>

      {/* keyboard hint */}
      <div
        style={{
          position: "absolute",
          right: "30px",
          top: "30px",
          display: isMobile ? "none" : "flex",
          gap: "18px",
          alignItems: "center",
          fontFamily: MONO,
          fontSize: "11px",
          letterSpacing: ".12em",
          color: "#6f82a6",
          zIndex: 6,
        }}
      >
        <span>
          <span style={{ color: "#9fc4ff" }}>↑↓</span> NAVIGATE
        </span>
        <span>
          <span style={{ color: "#9fc4ff" }}>⏎</span> SELECT
        </span>
        <span>
          <span style={{ color: "#9fc4ff" }}>ESC</span> BACK
        </span>
      </div>

      {/* detail panel */}
      <div
        data-ui
        style={{
          position: "absolute",
          right: "40px",
          top: "116px",
          width: detailW + "px",
          zIndex: 5,
          display: isMobile ? "none" : "block",
          padding: "34px 38px",
          background: "linear-gradient(165deg, rgba(16,32,64,.62), rgba(9,16,34,.58))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(130,180,255,.26)",
          borderRadius: "16px",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04), 0 26px 64px -20px rgba(0,0,0,.7), 0 0 44px rgba(60,130,255,.12)",
          opacity: booted ? 1 : 0,
          transform: `translateY(${booted ? "0" : "14px"}) scale(${booted ? 1 : 0.98})`,
          pointerEvents: booted ? "auto" : "none",
          transition: "opacity .5s ease, transform .55s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".4em", color: "#7fb0ff" }}>{catLabelUpper}</div>
          <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".2em", color: "#5f7196" }}>{idxLabel}</div>
        </div>
        <div style={{ marginTop: "8px", color: "#8ea0bd", fontSize: "13px", letterSpacing: ".02em" }}>{cat.blurb}</div>
        <div style={{ height: "1px", margin: "22px 0", background: "linear-gradient(90deg, rgba(140,185,255,.5), transparent)" }} />

        <div style={{ fontFamily: SERIF, fontSize: "42px", lineHeight: 1.05, color: "#f1f5fc", letterSpacing: ".01em", filter: "drop-shadow(0 0 22px rgba(90,150,255,.3))" }}>
          {item.title}
        </div>
        <div style={{ marginTop: "10px", fontFamily: MONO, fontSize: "12px", letterSpacing: ".14em", color: "#9fc0ec" }}>{item.meta}</div>

        {!!item.stat && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "9px",
              marginTop: "18px",
              padding: "8px 14px",
              borderRadius: "9px",
              background: "rgba(80,150,255,.1)",
              border: "1px solid rgba(140,185,255,.26)",
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7fb0ff", boxShadow: "0 0 8px #7fb0ff" }} />
            <span style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: ".08em", color: "#cfe0ff" }}>{item.stat}</span>
          </div>
        )}

        <div style={{ marginTop: "22px", color: "#b6c2d8", fontSize: "15.5px", lineHeight: 1.65, maxWidth: "430px" }}>{item.body}</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "24px" }}>
          {item.tags.map((t, i) => (
            <span
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: "11.5px",
                color: "#aec6ee",
                padding: "7px 13px",
                borderRadius: "20px",
                background: "rgba(80,150,255,.1)",
                border: "1px solid rgba(140,185,255,.24)",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {!!item.linkLabel && (
          <div
            onClick={() => activate()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "30px",
              padding: "13px 22px",
              borderRadius: "11px",
              cursor: "pointer",
              background: "linear-gradient(100deg, rgba(80,150,255,.28), rgba(80,150,255,.08))",
              border: "1px solid rgba(140,185,255,.4)",
              color: "#eaf2ff",
              fontSize: "14px",
              letterSpacing: ".06em",
              boxShadow: "0 0 26px rgba(60,130,255,.16)",
            }}
          >
            <span style={{ color: "#9fc4ff" }}>▸</span>
            {item.linkLabel}
          </div>
        )}
      </div>

      {/* command system (desktop) */}
      <div data-ui style={{ position: "absolute", left: "38px", bottom: "38px", zIndex: 7, display: isMobile ? "none" : "block" }}>
        {/* root menu */}
        <div
          style={{
            width: "236px",
            background: "linear-gradient(160deg, rgba(20,42,82,.78), rgba(10,18,40,.74))",
            backdropFilter: "blur(11px)",
            WebkitBackdropFilter: "blur(11px)",
            border: "1px solid rgba(130,180,255,.36)",
            borderRadius: "13px",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05), 0 18px 48px -14px rgba(0,0,0,.7), 0 0 36px rgba(60,130,255,.16)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "13px 16px",
              borderBottom: "1px solid rgba(130,180,255,.2)",
              background: "linear-gradient(90deg, rgba(80,150,255,.14), transparent)",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".32em", color: "#9fc4ff" }}>COMMAND</span>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7fb0ff", boxShadow: "0 0 8px #7fb0ff", animation: "glowPulse 3s ease-in-out infinite" }} />
          </div>
          <div style={{ padding: "8px" }}>
            {CATS.map((c, i) => {
              const active = i === rootIdx;
              return (
                <div
                  key={c.key}
                  onClick={() => {
                    setRoot(i);
                    enter();
                  }}
                  onMouseEnter={() => setRoot(i)}
                  style={rowStyle(active)}
                >
                  <span style={cursorStyle(active, c.key === "contact" ? "#e8c87a" : "#7fb0ff")}>▸</span>
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".1em", color: active ? "#9fc4ff" : "#5f7196" }}>{c.tag}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* submenu */}
        <div
          style={{
            position: "absolute",
            left: "248px",
            bottom: "0",
            zIndex: 7,
            opacity: booted ? 1 : 0,
            transform: `translateX(${booted ? "0" : "-14px"})`,
            pointerEvents: booted ? "auto" : "none",
            transition: "opacity .4s ease, transform .45s cubic-bezier(.16,1,.3,1)",
          }}
        >
          <div
            style={{
              width: "246px",
              background: "linear-gradient(160deg, rgba(18,38,76,.82), rgba(9,17,38,.8))",
              backdropFilter: "blur(11px)",
              WebkitBackdropFilter: "blur(11px)",
              border: "1px solid rgba(130,180,255,.34)",
              borderRadius: "13px",
              overflow: "hidden",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05), 0 18px 48px -14px rgba(0,0,0,.7), 0 0 36px rgba(60,130,255,.16)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 16px",
                borderBottom: "1px solid rgba(130,180,255,.2)",
                background: "linear-gradient(90deg, rgba(80,150,255,.14), transparent)",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".3em", color: "#9fc4ff" }}>{catLabelUpper}</span>
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".14em", color: "#5f7196" }}>{cat.tag}</span>
            </div>
            <div data-scroll style={{ padding: "8px", maxHeight: "46vh", overflowY: "auto", overflowX: "hidden" }}>
              {cat.items.map((it, j) => {
                const active = col === "sub" && j === subIdx;
                return (
                  <div
                    key={j}
                    onClick={() => {
                      setSub(j);
                      activate(rootIdx, j);
                    }}
                    onMouseEnter={() => setSub(j)}
                    style={rowStyle(active)}
                  >
                    <span style={cursorStyle(active)}>▸</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                  </div>
                );
              })}
              <div
                onClick={() => back()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 12px",
                  marginTop: "4px",
                  borderTop: "1px solid rgba(130,180,255,.14)",
                  color: "#6f82a6",
                  fontSize: "13px",
                  cursor: "pointer",
                  letterSpacing: ".04em",
                }}
              >
                <span style={{ color: "#7fb0ff" }}>◂</span>Back
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* mobile category sheet */}
      <div
        data-ui
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "26%",
          bottom: 0,
          zIndex: 22,
          display: isMobile ? "flex" : "none",
          flexDirection: "column",
          background: "linear-gradient(180deg, rgba(14,24,48,.97), rgba(8,13,28,.99))",
          borderTop: "1px solid rgba(140,185,255,.26)",
          borderRadius: "22px 22px 0 0",
          boxShadow: "0 -20px 60px -20px rgba(0,0,0,.7), 0 0 50px rgba(60,130,255,.1)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          overflow: "hidden",
          opacity: sheetOpen ? 1 : 0,
          pointerEvents: sheetOpen ? "auto" : "none",
          transform: `translateY(${sheetOpen ? "0" : "18px"})`,
          transition: "opacity .35s ease, transform .42s cubic-bezier(.16,1,.3,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "24px 22px 14px" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".34em", color: "#7fb0ff" }}>{catLabelUpper}</div>
            <div style={{ color: "#8ea0bd", fontSize: "13px", lineHeight: 1.5, marginTop: "6px", maxWidth: "74vw" }}>{cat.blurb}</div>
          </div>
          <div
            onClick={() => back()}
            style={{
              flexShrink: 0,
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(80,150,255,.12)",
              border: "1px solid rgba(140,185,255,.3)",
              color: "#cfe0ff",
              fontSize: "16px",
            }}
          >
            ✕
          </div>
        </div>
        <div data-scroll style={{ flex: 1, overflowY: "auto", padding: "6px 16px 120px" }}>
          {cat.items.map((it, j) => (
            <div
              key={j}
              onClick={() => {
                setSub(j);
                activate(rootIdx, j);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "18px",
                marginBottom: "11px",
                borderRadius: "15px",
                background: "linear-gradient(160deg, rgba(22,44,86,.62), rgba(12,22,46,.54))",
                border: "1px solid rgba(140,185,255,.26)",
                boxShadow: "0 10px 30px -12px rgba(0,0,0,.5)",
              }}
            >
              <span style={{ color: "#7fb0ff", fontSize: "15px" }}>▸</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SERIF, fontSize: "21px", color: "#eaf1ff", marginBottom: "4px" }}>{it.title}</div>
                <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".06em", color: "#9fb6d6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                    padding: "6px 10px",
                    borderRadius: "8px",
                    background: "rgba(80,150,255,.14)",
                    border: "1px solid rgba(140,185,255,.26)",
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

      {/* mobile command bar */}
      <div
        data-ui
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 24,
          display: isMobile && !page ? "flex" : "none",
          gap: "9px",
          padding: "12px 14px calc(14px + env(safe-area-inset-bottom, 0px))",
          background: "linear-gradient(180deg, rgba(8,13,28,0), rgba(8,13,28,.92) 46%)",
        }}
      >
        {CATS.map((c, i) => {
          const active = booted && i === rootIdx;
          return (
            <div
              key={c.key}
              onClick={() => {
                setRoot(i);
                enter();
              }}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "5px",
                padding: "12px 6px",
                borderRadius: "13px",
                cursor: "pointer",
                textAlign: "center",
                transition: "background .2s, color .2s, border-color .2s",
                color: active ? "#eef5ff" : "#9fb0cc",
                background: active ? "linear-gradient(180deg, rgba(90,160,255,.3), rgba(90,160,255,.06))" : "rgba(255,255,255,.025)",
                border: active ? "1px solid rgba(150,190,255,.42)" : "1px solid rgba(140,185,255,.12)",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: active ? "#7fb0ff" : "#54627d", boxShadow: active ? "0 0 8px #7fb0ff" : "none" }} />
              <span style={{ fontFamily: SERIF, fontSize: "16px", color: "inherit" }}>{c.label}</span>
            </div>
          );
        })}
      </div>

      {/* toast */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "46px",
          transform: `translateX(-50%) translateY(${toast ? "0" : "12px"})`,
          zIndex: 9,
          padding: "12px 22px",
          borderRadius: "11px",
          background: "linear-gradient(100deg, rgba(80,150,255,.3), rgba(40,90,180,.3))",
          border: "1px solid rgba(150,190,255,.45)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "#eaf2ff",
          fontFamily: MONO,
          fontSize: "12.5px",
          letterSpacing: ".06em",
          boxShadow: "0 0 30px rgba(70,140,255,.25)",
          opacity: toast ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity .3s ease, transform .3s ease",
        }}
      >
        {toast}
      </div>

      <CaseStudyPage page={page} isMobile={isMobile} onClose={closePage} />
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base: CSSProperties = { position: "absolute", width: "20px", height: "20px" };
  const map: Record<typeof pos, CSSProperties> = {
    tl: { left: 0, top: 0, borderTop: "1px solid rgba(140,185,255,.5)", borderLeft: "1px solid rgba(140,185,255,.5)" },
    tr: { right: 0, top: 0, borderTop: "1px solid rgba(140,185,255,.5)", borderRight: "1px solid rgba(140,185,255,.5)" },
    bl: { left: 0, bottom: 0, borderBottom: "1px solid rgba(140,185,255,.5)", borderLeft: "1px solid rgba(140,185,255,.5)" },
    br: { right: 0, bottom: 0, borderBottom: "1px solid rgba(140,185,255,.5)", borderRight: "1px solid rgba(140,185,255,.5)" },
  };
  return <div style={{ ...base, ...map[pos] }} />;
}
