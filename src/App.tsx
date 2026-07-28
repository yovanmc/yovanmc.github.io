import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CATS } from "./content";
import type { BattleAction, BattleState } from "./battle/engine";
import { parseActions, parseBoss, parseDefeatedBosses } from "./battle/bootParams";
import { Station } from "./components/Station";
import { Atmosphere } from "./components/Atmosphere";
import { CaseStudyPage, type PageRef } from "./components/CaseStudyPage";
import { DiveIntro, HeroIdle, type IntroTarget } from "./components/DiveIntro";
import { Gate } from "./components/Gate";
import { BrowseIndex } from "./components/BrowseIndex";
import { pathForPage, pageForPath } from "./router";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";
const MOBILE_BREAKPOINT = 760;

/**
 * Top-level phase machine (milestone 3, revised M3c): gate → play | browse,
 * with the intro INSIDE the play path (owner ruling 2026-07-28 superseding
 * M2's intro-every-visit: root entry lands on the gate; the Dive to the Heart
 * cinematic plays when "Enter the game" is chosen, first time per page load).
 * - gate: the fork and the site's entry. No hero until the dive brings him.
 * - intro: the cinematic; skip lands in play. Ends with the menu rising.
 * - play: the RPG command-menu experience (the old `booted` state).
 * - browse: the flat portfolio index; case-study pages open over it.
 * Path↔phase and per-phase input rules live in the M3 plan
 * (docs/superpowers/specs/2026-07-28-m3-split-plan.md, M3c addendum).
 */
type Phase = "intro" | "gate" | "play" | "browse" | "battle";

type Col = "root" | "sub";

/** The battle chunk stays out of the landing bundle (spec: battle code lazy-loaded). */
const BattleScene = lazy(() => import("./battle/BattleScene"));

interface BattleBoot {
  seed: number;
  attempt: number;
  actions?: BattleAction[];
  /** M6 capture keys — parsed/validated in src/battle/bootParams.ts so the
   * logic sits under the widened coverage gate and is unit-testable without
   * a DOM harness. Optional: only decideBoot's capture-key path populates
   * them; the FIGHT button and the dive handoff still pin Alert Storm
   * fresh (M5 invariant, unchanged). `defeatedBosses` seeds the App-level
   * `defeatedBosses` state at boot (see the `useState` initializer below);
   * `boss` is not consumed by rendering yet. */
  boss?: string;
  defeatedBosses?: string[];
}

interface BootState {
  phase: Phase;
  page: PageRef | null;
  freezeAt?: number;
  battle?: BattleBoot;
}

/** Initial-load decision — every arm of the plan's path table, computed synchronously. */
function decideBoot(): BootState {
  const loc = window.location;
  const dev = import.meta.env.DEV || loc.hostname === "localhost";
  let path = loc.pathname;

  // 404.html stashes unknown deep-link paths (path-preserving fallback); a
  // restored deep link bypasses the intro, same as a direct one.
  try {
    const stash = sessionStorage.getItem("dl");
    if (stash) {
      sessionStorage.removeItem("dl");
      const stashPath = stash.split("?")[0];
      if (pageForPath(stashPath) || stashPath === "/browse" || stashPath === "/browse/") {
        window.history.replaceState({ phase: "browse" }, "", stash);
        path = stashPath;
      }
    }
  } catch {
    /* sessionStorage unavailable — fall through to the normal table */
  }

  const initial = pageForPath(path);
  if (initial) return { phase: "browse", page: initial };
  if (path === "/browse" || path === "/browse/") return { phase: "browse", page: null };

  if (dev) {
    const params = new URLSearchParams(loc.search);
    const p = params.get("phase");
    if (p === "gate" || p === "play" || p === "browse") return { phase: p, page: null };
    if (p === "battle") {
      const defeated = parseDefeatedBosses(params.get("defeated"));
      if (defeated.rejected) {
        console.warn(
          "[dev] ?defeated= must be a rush-order prefix of alert-storm,cascade,silent-failure,imposter-syndrome — falling back to []",
        );
      }
      return {
        phase: "battle",
        page: null,
        battle: {
          seed: parseInt(params.get("seed") ?? "", 10) || 42,
          attempt: parseInt(params.get("attempt") ?? "", 10) || 1,
          actions: parseActions(params.get("actions")),
          boss: parseBoss(params.get("boss")),
          defeatedBosses: defeated.value,
        },
      };
    }
    const t = params.get("t");
    if (t !== null) return { phase: "intro", page: null, freezeAt: parseInt(t, 10) || 0 };
  }
  return { phase: "gate", page: null };
}

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
  const boot = useRef<BootState | null>(null);
  if (boot.current === null) boot.current = decideBoot();

  const [phase, setPhase] = useState<Phase>(boot.current.phase);
  const [introOn, setIntroOn] = useState(boot.current.phase === "intro");
  const [battleBoot, setBattleBoot] = useState<BattleBoot | null>(boot.current.battle ?? null);
  // per-page-load run progress (M4 owns persistence and the unlock UI).
  // Seeded from the boot's capture-key `defeated=` (if any) so a
  // `?phase=battle&defeated=alert-storm` boot reaches BattleScene with the
  // matching rider/kit instead of starting fresh — single source of truth,
  // this same state is what line ~519 passes to BattleScene and what the
  // FIGHT row label below reads.
  const [defeatedBosses, setDefeatedBosses] = useState<string[]>(boot.current.battle?.defeatedBosses ?? []);
  // the dive has run this page load — later play-entries skip straight to the
  // menu, and the hero stands at the station only once he has actually dived
  const [hasDived, setHasDived] = useState(false);
  const [col, setCol] = useState<Col>("root");
  const [rootIdx, setRootIdx] = useState(0);
  const [subIdx, setSubIdx] = useState(0);
  const [page, setPage] = useState<PageRef | null>(boot.current.page);
  const [toast, setToast] = useState("");
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [h, setH] = useState(typeof window !== "undefined" ? window.innerHeight : 800);

  const snd = useBlips();
  const toastTimer = useRef<number | undefined>(undefined);
  /** which surface opened the current page — decides where closing it lands */
  const pageOrigin = useRef<"play" | "browse">(boot.current.page ? "browse" : "play");

  const booted = phase === "play";

  // live mirror of state so the keydown listener always reads current values
  const stateRef = useRef({ phase, col, rootIdx, subIdx, page, hasDived });
  stateRef.current = { phase, col, rootIdx, subIdx, page, hasDived };

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

  // gate↔play↔browse transitions rewrite the current history entry (never push)
  // so the back button only ever walks pages — popstate to "/" can't replay the intro.
  // A battle phase records "play" in history: a dead fight must never resurrect
  // via Forward/bfcache (M5 plan path table).
  const goPhase = useCallback((p: Exclude<Phase, "intro">) => {
    setPhase(p);
    const stored = p === "battle" ? "play" : p;
    const path = p === "browse" ? "/browse" : "/";
    if (window.location.pathname !== path || (window.history.state?.phase ?? null) !== stored) {
      window.history.replaceState({ phase: stored }, "", path);
    }
  }, []);

  const enterPlay = useCallback(() => {
    snd.resume();
    setCol("root");
    setRootIdx(0);
    setSubIdx(0);
    if (!stateRef.current.hasDived) {
      // first play-entry this page load: the cinematic runs and lands in battle;
      // warm the lazy battle chunk now so touchdown never shows a loading flash
      void import("./battle/BattleScene");
      setPhase("intro");
      setIntroOn(true);
      snd.enter();
      return;
    }
    goPhase("play");
    snd.enter();
  }, [snd, goPhase]);

  const enterBrowse = useCallback(() => {
    snd.resume();
    goPhase("browse");
    snd.enter();
  }, [snd, goPhase]);

  const enter = useCallback(() => {
    snd.resume();
    setCol("sub");
    setSubIdx(0);
    snd.enter();
  }, [snd]);

  const openPage = useCallback(
    (ri: number, si: number) => {
      snd.resume();
      pageOrigin.current = stateRef.current.phase === "browse" ? "browse" : "play";
      setPage({ ri, si });
      const path = pathForPage({ ri, si });
      if (path !== "/" && window.location.pathname !== path)
        window.history.pushState({ page: true, phase: stateRef.current.phase }, "", path);
      snd.enter();
    },
    [snd],
  );

  const closePage = useCallback(() => {
    setPage(null);
    const home = pageOrigin.current === "browse" ? "/browse" : "/";
    if (window.location.pathname !== home)
      window.history.pushState({ phase: pageOrigin.current }, "", home);
    if (pageOrigin.current === "browse" && stateRef.current.phase !== "browse") setPhase("browse");
    snd.back();
  }, [snd]);

  const back = useCallback(() => {
    snd.resume();
    const s = stateRef.current;
    if (s.page) {
      closePage();
    } else if (s.phase === "browse") {
      goPhase("gate");
      snd.back();
    } else if (s.col === "sub") {
      setCol("root");
      snd.back();
    } else if (s.phase === "play") {
      goPhase("gate");
      snd.back();
    }
  }, [snd, closePage, goPhase]);

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
      if (s.phase !== "play") return; // background un-boot is a play-phase affordance only
      if (s.page) return; // CaseStudyPage handles its own background clicks
      if (!(e.target as HTMLElement).closest("[data-ui]")) {
        goPhase("gate");
        setCol("root");
        snd.back();
      }
    },
    [snd, goPhase],
  );

  // keyboard + resize — phase-gated per the M3 input table
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      // intro, gate, and battle own their inputs entirely (their own listeners);
      // without the battle arm, Enter here opens a case-study page over the fight
      if (s.phase === "intro" || s.phase === "battle" || (s.phase === "gate" && !s.page)) return;
      const k = e.key;
      const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Backspace", " "];
      if (handled.includes(k)) e.preventDefault();
      snd.resume();
      if (s.page) {
        if (k === "Escape" || k === "ArrowLeft" || k === "Backspace") back();
        return;
      }
      if (s.phase === "browse") {
        if (k === "Escape" || k === "Backspace") back();
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
    const onResize = () => {
      setW(window.innerWidth);
      setH(window.innerHeight);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [snd, back, enter, activate, setRoot, setSub]);

  // browser Back/Forward — the plan's popstate table; "/" NEVER resolves to intro here
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const path = window.location.pathname;
      const statePhase: Phase | undefined = e.state?.phase;
      const p = pageForPath(path);
      if (p) {
        setPage(p);
        setRootIdx(p.ri);
        setSubIdx(p.si);
        const ph = statePhase === "play" ? "play" : "browse";
        pageOrigin.current = ph;
        setPhase(ph);
      } else if (path === "/browse" || path === "/browse/") {
        setPage(null);
        setPhase("browse");
      } else {
        setPage(null);
        // battle/intro are never restorable phases — both map to safe ground
        setPhase(
          statePhase && statePhase !== "intro" && statePhase !== "battle" ? statePhase : "gate",
        );
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // M5 PR-C: the dive lands directly in battle — touchdown, the Alert Storm
  // descends, fight (owner ruling 2026-07-28). Victory lands in the menu world;
  // re-entries within the same page load (hasDived) go straight to the menu.
  const onIntroHandoff = useCallback(
    (_target: IntroTarget) => {
      setHasDived(true);
      setBattleBoot({ seed: (Math.random() * 2147483646) | 0 || 1, attempt: 1 });
      goPhase("battle");
    },
    [goPhase],
  );
  const onIntroDone = useCallback(() => setIntroOn(false), []);

  // ---- battle wiring (M5 PR-B: opt-in via FIGHT; the dive reroute is PR-C) ----
  const enterFight = useCallback(() => {
    snd.resume();
    setBattleBoot({ seed: (Math.random() * 2147483646) | 0 || 1, attempt: 1 });
    goPhase("battle");
    snd.enter();
  }, [snd, goPhase]);

  const onBattleVictory = useCallback(
    (final: BattleState) => {
      setDefeatedBosses(final.defeatedBosses);
      setBattleBoot(null);
      setCol("root");
      goPhase("play");
    },
    [goPhase],
  );

  const onBattleForfeit = useCallback(() => {
    setBattleBoot(null);
    goPhase("gate");
    snd.back();
  }, [goPhase, snd]);

  // ---- derived view values ----
  const isMobile = w < MOBILE_BREAKPOINT;
  const cat = CATS[rootIdx];
  const item = cat.items[subIdx] ?? cat.items[0];
  const ringOpacity = phase === "gate" || phase === "intro" ? 0.82 : 0.2;
  const glassScale = isMobile ? Math.max(0.44, Math.min(0.62, (w - 30) / 680)) : 1;
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

      {/* the battle stage owns the visual in battle phase (M5 plan §Station handoff) */}
      {phase !== "battle" && <Station scale={glassScale} opacity={ringOpacity} top={isMobile ? "31%" : "40%"} />}

      {/* the intro's end pose, alive in site space — at the gate, only once he has dived */}
      {phase !== "intro" && phase !== "battle" && hasDived && <HeroIdle vw={w} vh={h} visible={phase === "gate"} />}

      {phase === "battle" && battleBoot && (
        <Suspense
          fallback={
            <div style={{ position: "absolute", inset: 0, zIndex: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(6,4,12,.6)", fontFamily: MONO, fontSize: "12px", letterSpacing: ".3em", color: "#c9a4ff" }}>
              LOADING…
            </div>
          }
        >
          <BattleScene
            key={battleBoot.seed}
            seed={battleBoot.seed}
            attempt={battleBoot.attempt}
            replayActions={battleBoot.actions}
            defeatedBosses={defeatedBosses}
            onVictory={onBattleVictory}
            onForfeit={onBattleForfeit}
            vw={w}
            vh={h}
            isMobile={isMobile}
            playMove={snd.move}
            playEnter={snd.enter}
            playBack={snd.back}
          />
        </Suspense>
      )}

      {phase === "gate" && !page && (
        <Gate onPlay={enterPlay} onBrowse={enterBrowse} vw={w} vh={h} playMove={snd.move} playEnter={snd.enter} />
      )}

      {phase === "browse" && !page && (
        <BrowseIndex isMobile={isMobile} onItem={(ri, si) => activate(ri, si)} onEnterGame={() => goPhase("gate")} />
      )}

      {/* header — browsing wordmark (play phase only; browse carries its own) */}
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

      {/* keyboard hint (play phase) */}
      <div
        style={{
          position: "absolute",
          right: "30px",
          top: "30px",
          display: isMobile || !booted ? "none" : "flex",
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
            role="button"
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

      {/* command system (desktop, play phase) */}
      <div data-ui style={{ position: "absolute", left: "38px", bottom: "38px", zIndex: 7, display: isMobile || !booted ? "none" : "block" }}>
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
                  role="button"
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

        {/* FIGHT — play-phase-only row OUTSIDE the owner-locked CATS roster (M5 plan, G6) */}
        <div
          role="button"
          onClick={enterFight}
          style={{
            marginTop: "10px",
            width: "236px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            borderRadius: "13px",
            background: "linear-gradient(160deg, rgba(70,20,30,.78), rgba(30,8,18,.74))",
            border: "1px solid rgba(255,130,110,.36)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05), 0 12px 36px -14px rgba(0,0,0,.7), 0 0 26px rgba(255,70,50,.14)",
            fontFamily: "'Sora',sans-serif",
            fontSize: "14px",
            color: "#ffd9cf",
            letterSpacing: ".04em",
          }}
        >
          <span style={{ color: "#ff9d8a", textShadow: "0 0 8px #ff6a50" }}>⚔</span>
          <span style={{ flex: 1 }}>Fight</span>
          <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".18em", color: defeatedBosses.length ? "#e8c87a" : "#c98d80" }}>
            {defeatedBosses.length ? "REMATCH" : "ALERT STORM"}
          </span>
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
                    role="button"
                    style={rowStyle(active)}
                  >
                    <span style={cursorStyle(active)}>▸</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                  </div>
                );
              })}
              <div
                onClick={() => back()}
                role="button"
                aria-label="Back"
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

      {/* mobile category sheet (play phase) */}
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
            role="button"
            aria-label="Close"
            tabIndex={0}
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
              role="button"
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

      {/* mobile command bar (play phase only — never over the gate; M3 input table) */}
      <div
        data-ui
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 24,
          display: isMobile && booted && !page ? "flex" : "none",
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
              role="button"
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
                minWidth: 0,
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: active ? "#7fb0ff" : "#54627d", boxShadow: active ? "0 0 8px #7fb0ff" : "none" }} />
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: "15px",
                  color: "inherit",
                  maxWidth: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {c.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* mobile FIGHT chip — same play-phase-only rule as the command bar */}
      <div
        data-ui
        role="button"
        onClick={enterFight}
        style={{
          position: "absolute",
          right: "14px",
          bottom: "calc(96px + env(safe-area-inset-bottom, 0px))",
          zIndex: 24,
          display: isMobile && booted && !page ? "flex" : "none",
          alignItems: "center",
          gap: "8px",
          padding: "12px 18px",
          borderRadius: "999px",
          background: "linear-gradient(160deg, rgba(70,20,30,.86), rgba(30,8,18,.82))",
          border: "1px solid rgba(255,130,110,.4)",
          boxShadow: "0 10px 30px -10px rgba(0,0,0,.7), 0 0 22px rgba(255,70,50,.18)",
          fontFamily: "'Sora',sans-serif",
          fontSize: "14px",
          color: "#ffd9cf",
          cursor: "pointer",
        }}
      >
        <span style={{ color: "#ff9d8a" }}>⚔</span> Fight
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

      {introOn && <DiveIntro onHandoff={onIntroHandoff} onDone={onIntroDone} freezeAt={boot.current.freezeAt} />}
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
