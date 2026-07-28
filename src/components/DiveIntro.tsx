import { useEffect, useMemo, useRef, useState } from "react";
import { buildStationCanon } from "../generated/stationCanon";
import {
  PAL,
  SPR_HERO,
  STAGE_W,
  STAGE_H,
  SCX,
  SCY,
  T_MENU,
  MENU_DUR,
  T_END,
  NB,
  birdParam,
  computeState,
  type DiveState,
} from "../generated/diveTimeline";

/**
 * Dive to the Heart — the play path's opening cinematic (M3c: it runs when
 * "Enter the game" is chosen, not at site entry), ported from the locked lab
 * (docs/battle-prototypes/dive-intro.html, spec 2026-07-28-dive-intro-design.md).
 * The pure timeline is the generated module (verbatim, verified by
 * npm run verify:canon); this component is the render layer: the lab's
 * applyState rewritten over React refs, plus the three integration concerns the
 * lab deferred — viewport framing, the settle beat that lands the station on the
 * site's hero geometry, and the handoff fade to the live scene.
 *
 * Framing: desktop = contain-fit both shots. Mobile = cover-fit for the fall
 * (shot 1), then width-fit-to-station from the hard cut on — the cut is the one
 * place a framing change is invisible.
 */

export type IntroTarget = "gate" | "browse";

interface DiveIntroProps {
  /** Start rendering the destination scene beneath the overlay (settle finished). */
  onHandoff: (target: IntroTarget) => void;
  /** Overlay fade complete — unmount me. */
  onDone: () => void;
  /** Freeze the timeline at this ms and hold (capture tool; skip stays live). */
  freezeAt?: number;
}

/** Site hero geometry — must match App.tsx's Station placement exactly. */
export function siteStationGeometry(vw: number, vh: number) {
  const isMobile = vw < 760;
  const glassScale = isMobile ? Math.max(0.44, Math.min(0.62, (vw - 30) / 680)) : 1;
  return {
    size: 680 * glassScale,
    cx: vw / 2,
    cy: (isMobile ? 0.31 : 0.4) * vh,
  };
}

/** Stage-wrapper transform (origin 0 0) for the running intro. */
function stageTransform(vw: number, vh: number, shot: 1 | 2) {
  const isMobile = vw < 760;
  let f: number;
  if (!isMobile) f = Math.min(vw / STAGE_W, vh / STAGE_H);
  else if (shot === 1) f = Math.max(vw / STAGE_W, vh / STAGE_H);
  else f = vw / 700;
  return { f, tx: (vw - STAGE_W * f) / 2, ty: (vh - STAGE_H * f) / 2 };
}

/** Stage-wrapper transform that lands the station exactly on the site geometry. */
function settledTransform(vw: number, vh: number) {
  const g = siteStationGeometry(vw, vh);
  const s = g.size / 640;
  // #stWrap is a 640 box at stage (256,36); its center sits at (576,356).
  return { f: s, tx: g.cx - s * 576, ty: g.cy - s * 356 };
}

function drawHero(cv: HTMLCanvasElement, fi: number) {
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, 48, 60);
  const g = SPR_HERO[fi];
  for (let r = 0; r < 60; r++)
    for (let c = 0; c < 48; c++) {
      const ch = g[r][c];
      if (ch !== ".") {
        ctx.fillStyle = PAL[ch];
        ctx.fillRect(c, r, 1, 1);
      }
    }
}

const WING = [
  "M-7,3 Q-3.5,-4 0,2 Q3.5,-4 7,3",
  "M-7,0 Q-3.5,-2.5 0,1 Q3.5,-2.5 7,0",
];

// Namespaced copies of the lab's stage-px ambience keyframes — the site's
// global floatUp/twinkle/auroraA/B are vh-based and MUST NOT be reused here
// (the locked design ports them 1:1 into stage pixels).
const DV_CSS = `
@keyframes dvFloatUp{0%{transform:translateY(0) scale(1);opacity:0}6%{opacity:0.85}94%{opacity:0.85}100%{transform:translateY(-700px) scale(0.45);opacity:0}}
@keyframes dvTwinkle{0%,100%{opacity:0.12;transform:rotate(45deg) scale(0.6)}50%{opacity:0.95;transform:rotate(45deg) scale(1.15)}}
@keyframes dvAuroraA{0%,100%{transform:translate(-6%,0) rotate(0deg);opacity:0.45}50%{transform:translate(8%,5%) rotate(9deg);opacity:0.8}}
@keyframes dvAuroraB{0%,100%{transform:translate(5%,3%) rotate(0deg);opacity:0.4}50%{transform:translate(-7%,-4%) rotate(-7deg);opacity:0.7}}
.dv-ray{position:absolute;top:-40px;height:740px;width:70px;background:#cabffc;transform:skewX(-14deg);opacity:0}
.dv-mote{position:absolute;width:4px;height:4px;border-radius:50%;background:#8a8078;opacity:0}
.dv-ripple{position:absolute;border:3px solid #f0ece0;border-radius:50%;opacity:0}
.dv-heroW{position:absolute;left:0;top:0;transform-origin:0 0}
.dv-heroW canvas{position:absolute;left:-24px;top:-30px;width:48px;height:60px;image-rendering:pixelated}
.dv-birdW{position:absolute;transform-origin:0 0}
.dv-birdW svg{position:absolute;left:-10px;top:-6px}
`;

/** Park–Miller PRNG — same sequence as src/lib/rng (seed 29), stage-local build. */
function dvRng(seed: number) {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}

function buildStageAtmo(host: HTMLDivElement) {
  const gA = document.createElement("div");
  gA.style.cssText =
    "position:absolute;left:6%;top:-22%;width:55%;height:90%;border-radius:50%;filter:blur(70px);background:radial-gradient(ellipse, rgba(70,150,255,.4), rgba(70,150,255,0) 70%);animation:dvAuroraA 18s ease-in-out infinite;";
  const gB = document.createElement("div");
  gB.style.cssText =
    "position:absolute;right:2%;top:-12%;width:50%;height:80%;border-radius:50%;filter:blur(74px);background:radial-gradient(ellipse, rgba(120,110,235,.34), rgba(120,110,235,0) 70%);animation:dvAuroraB 21s ease-in-out infinite;";
  host.appendChild(gA);
  host.appendChild(gB);
  const r = dvRng(29);
  for (let i = 0; i < 54; i++) {
    const isStar = r() > 0.76;
    const el = document.createElement("span");
    if (isStar) {
      const op = 0.3 + r() * 0.5;
      el.style.cssText =
        "position:absolute;left:" + r() * 100 + "%;top:" + r() * 88 + "%;width:" + (3 + r() * 4) + "px;height:" + (3 + r() * 4) + "px;" +
        "background:rgba(205,228,255," + op.toFixed(3) + ");box-shadow:0 0 7px 1px rgba(185,218,255," + op.toFixed(3) + ");" +
        "transform:rotate(45deg);animation:dvTwinkle " + (2.5 + r() * 3.5).toFixed(2) + "s ease-in-out " + (-r() * 5).toFixed(2) + "s infinite;";
    } else {
      const op = 0.25 + r() * 0.5;
      const size = 2 + r() * 5;
      el.style.cssText =
        "position:absolute;left:" + r() * 100 + "%;bottom:" + (-8 - r() * 14) + "%;width:" + size + "px;height:" + size + "px;border-radius:50%;" +
        "background:radial-gradient(circle, rgba(200,228,255," + op.toFixed(3) + ") 0%, rgba(140,190,255,0) 70%);" +
        "box-shadow:0 0 8px 2px rgba(120,170,255," + (op * 0.45).toFixed(2) + ");" +
        "animation:dvFloatUp " + (9 + r() * 11).toFixed(1) + "s linear " + (-r() * 18).toFixed(2) + "s infinite;";
    }
    host.appendChild(el);
  }
}

const MONO = "'JetBrains Mono',monospace";

/**
 * The hero standing at station center after the dive — the intro's end pose,
 * re-rendered in site space so the scene beneath the handoff fade is identical.
 * Position/scale derive from the settled stage mapping: canvas center at stage
 * (576, 288.4) → (cx, cy − 67.6·g), sprite scale 2.6·g where g = size/640.
 */
export function HeroIdle({ vw, vh, visible }: { vw: number; vh: number; visible: boolean }) {
  const c0 = useRef<HTMLCanvasElement>(null);
  const c1 = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    drawHero(c0.current!, 0);
    drawHero(c1.current!, 1);
    const iv = window.setInterval(() => setFrame((f) => 1 - f), 440);
    return () => window.clearInterval(iv);
  }, []);

  const g = siteStationGeometry(vw, vh);
  const s = g.size / 640;
  const cvs = (ref: React.RefObject<HTMLCanvasElement>, fi: number) => (
    <canvas
      ref={ref}
      width={48}
      height={60}
      style={{
        position: "absolute",
        left: "-24px",
        top: "-30px",
        width: "48px",
        height: "60px",
        imageRendering: "pixelated",
        display: frame === fi ? "block" : "none",
      }}
    />
  );
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: g.cx + "px",
        top: g.cy - 67.6 * s + "px",
        transform: `scale(${2.6 * s})`,
        transformOrigin: "0 0",
        zIndex: 4,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity .5s ease",
      }}
    >
      {cvs(c0, 0)}
      {cvs(c1, 1)}
    </div>
  );
}

export function DiveIntro({ onHandoff, onDone, freezeAt }: DiveIntroProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sh1Ref = useRef<HTMLDivElement>(null);
  const sh2Ref = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const stWrapRef = useRef<HTMLDivElement>(null);
  const stDimRef = useRef<HTMLDivElement>(null);
  const stLitRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const birdHostRef = useRef<HTMLDivElement>(null);
  const moteHostRef = useRef<HTMLDivElement>(null);
  const atmoRef = useRef<HTMLDivElement>(null);
  const heroFallRef = useRef<HTMLDivElement>(null);
  const heroLandRef = useRef<HTMLDivElement>(null);
  const hf = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const hl = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const rayRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const ripRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const skipRowRef = useRef<HTMLDivElement>(null);

  const cbRef = useRef({ onHandoff, onDone });
  cbRef.current = { onHandoff, onDone };
  const freezeRef = useRef(freezeAt);
  freezeRef.current = freezeAt;

  useEffect(() => {
    const overlay = overlayRef.current;
    const wrap = wrapRef.current;
    if (!overlay || !wrap) return;

    let disposed = false;
    let finished = false;
    let raf = 0;
    const timeouts: number[] = [];
    let start = performance.now();

    // Bird + mote element pools (lab-verbatim construction, namespaced classes).
    const birdEls: { w: HTMLDivElement; p0: SVGPathElement; p1: SVGPathElement }[] = [];
    const birdHost = birdHostRef.current!;
    for (let i = 0; i < NB; i++) {
      const b = birdParam(i);
      const w = document.createElement("div");
      w.className = "dv-birdW";
      const sz = 14 + b.big * 3;
      const col = b.pale ? "#f0ece0" : "#cabffc";
      w.innerHTML =
        '<svg width="' + (sz + 6) + '" height="14" viewBox="-8 -5 16 10">' +
        '<path class="w0" d="' + WING[0] + '" stroke="' + col + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>' +
        '<path class="w1" d="' + WING[1] + '" stroke="' + col + '" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';
      w.style.opacity = "0";
      birdHost.appendChild(w);
      birdEls.push({
        w,
        p0: w.querySelector(".w0") as SVGPathElement,
        p1: w.querySelector(".w1") as SVGPathElement,
      });
    }
    const moteEls: HTMLDivElement[] = [];
    const moteHost = moteHostRef.current!;
    for (let i = 0; i < 12; i++) {
      const d = document.createElement("div");
      d.className = "dv-mote";
      moteHost.appendChild(d);
      moteEls.push(d);
    }
    buildStageAtmo(atmoRef.current!);

    drawHero(hf[0].current!, 0);
    drawHero(hf[1].current!, 1);
    drawHero(hl[0].current!, 0);
    drawHero(hl[1].current!, 1);

    const applyState = (st: DiveState) => {
      sh1Ref.current!.style.opacity = st.shot === 1 ? "1" : "0";
      sh2Ref.current!.style.opacity = st.shot === 2 ? "1" : "0";
      rayRefs.forEach((r, i) => (r.current!.style.opacity = String(st.rays * (1 - 0.15 * i))));
      glowRef.current!.style.opacity = String(st.glow);
      st.motes.forEach((m, i) => {
        const e = moteEls[i];
        e.style.opacity = m.on ? "0.85" : "0";
        e.style.left = m.x + "px";
        e.style.top = m.y + "px";
      });
      const hfs = st.heroFall;
      heroFallRef.current!.style.transform =
        "translate(" + hfs.x + "px," + hfs.y + "px) scale(" + hfs.s + ") rotate(" + hfs.rot + "deg)";
      hf[0].current!.style.display = hfs.frame === 0 ? "block" : "none";
      hf[1].current!.style.display = hfs.frame === 1 ? "block" : "none";
      stWrapRef.current!.style.transform = "scale(" + st.station.s + ")";
      stLitRef.current!.style.clipPath = "circle(" + st.reveal.r + "px at 320px 320px)";
      const hls = st.heroLand;
      heroLandRef.current!.style.transform =
        "translate(" + hls.x + "px," + hls.y + "px) scale(" + hls.s + ") rotate(" + hls.rot + "deg)";
      hl[0].current!.style.display = hls.frame === 0 ? "block" : "none";
      hl[1].current!.style.display = hls.frame === 1 ? "block" : "none";
      const sh = shadowRef.current!;
      sh.style.opacity = st.shadow.on ? String(st.shadow.op) : "0";
      sh.style.left = SCX + "px";
      sh.style.top = SCY + "px";
      sh.style.transform = "scale(" + st.shadow.s + ")";
      st.ripples.forEach((rp, i) => {
        const e = ripRefs[i].current!;
        if (!rp.on) {
          e.style.opacity = "0";
          return;
        }
        e.style.opacity = String(rp.op);
        e.style.left = SCX - rp.r + "px";
        e.style.top = SCY - rp.r + "px";
        e.style.width = 2 * rp.r + "px";
        e.style.height = 2 * rp.r + "px";
      });
      st.birds.forEach((b, i) => {
        const e = birdEls[i];
        if (!b.on) {
          e.w.style.opacity = "0";
          return;
        }
        e.w.style.opacity = String(b.op);
        e.w.style.transform = "translate(" + b.x + "px," + b.y + "px) rotate(" + b.rot + "deg)";
        e.p0.style.display = b.flap === 0 ? "block" : "none";
        e.p1.style.display = b.flap === 1 ? "block" : "none";
      });
      atmoRef.current!.style.opacity = String(st.atmo);
      skipRowRef.current!.style.opacity = st.skipHint ? "1" : "0";
      skipRowRef.current!.style.pointerEvents = st.skipHint ? "auto" : "none";
    };

    const setStage = (shot: 1 | 2, settled: boolean, animate: boolean) => {
      const t = settled
        ? settledTransform(window.innerWidth, window.innerHeight)
        : stageTransform(window.innerWidth, window.innerHeight, shot);
      wrap.style.transition = animate ? "transform .6s cubic-bezier(.16,1,.3,1)" : "none";
      wrap.style.transform = "translate(" + t.tx + "px," + t.ty + "px) scale(" + t.f + ")";
    };

    // target rect assert hook: exposed for the interactive verification gate.
    (window as unknown as { __diveStationRect?: () => DOMRect }).__diveStationRect = () =>
      stWrapRef.current!.getBoundingClientRect();

    const finish = (target: IntroTarget, instant: boolean) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      applyState(computeState(T_END));
      setStage(2, true, !instant);
      const settleMs = instant ? 0 : 620;
      timeouts.push(
        window.setTimeout(() => {
          if (disposed) return;
          cbRef.current.onHandoff(target);
          overlay.style.transition = "opacity .35s ease";
          overlay.style.opacity = "0";
          timeouts.push(
            window.setTimeout(() => {
              if (!disposed) cbRef.current.onDone();
            }, 380),
          );
        }, settleMs),
      );
    };

    const skip = (target: IntroTarget = "gate") => finish(target, true);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab" || e.altKey || e.ctrlKey || e.metaKey) return; // never hijack focus/shortcuts
      skip("gate");
    };
    // native listener — fires before React's synthetic handlers, so it must
    // ignore clicks born inside the control row (their own handlers pick the target)
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("[data-dive-controls]")) return;
      skip("gate");
    };
    window.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onClick);

    const onResize = () => {
      if (finished) return;
      const t = freezeRef.current !== undefined ? freezeRef.current : performance.now() - start;
      setStage(computeState(Math.min(t, T_END)).shot, false, false);
    };
    window.addEventListener("resize", onResize);

    // prefers-reduced-motion does NOT suppress this cinematic (owner ruling
    // 2026-07-28, M3c: the dive is solicited — it runs only on an explicit
    // "Enter the game" click, with skip one keypress away). The reduce flag
    // still governs unsolicited/ambient site motion. Notably, Windows with
    // "Animation effects" off reports reduce browser-wide, which silently
    // hid the cinematic from a large technical audience.
    if (freezeRef.current !== undefined) {
      const ft = freezeRef.current;
      applyState(computeState(ft));
      setStage(computeState(ft).shot, false, false);
    } else {
      let lastShot: 1 | 2 = 1;
      setStage(1, false, false);
      const loop = (now: number) => {
        if (finished || disposed) return;
        const t = now - start;
        if (t >= T_MENU + MENU_DUR) {
          // menu-rise beat = the gate's attach point; settle instead of the lab's placeholder
          finish("gate", false);
          return;
        }
        const st = computeState(Math.min(t, T_END));
        if (st.shot !== lastShot) {
          lastShot = st.shot;
          setStage(st.shot, false, false); // reframe exactly at the hard cut
        }
        applyState(st);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    // "portfolio only" is wired via the row's own click handlers below, through
    // this ref so the closure state (finish) is reachable.
    (overlay as unknown as { __diveSkipTo?: (t: IntroTarget) => void }).__diveSkipTo = skip;

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      timeouts.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      overlay.removeEventListener("click", onClick);
      birdHost.innerHTML = "";
      moteHost.innerHTML = "";
      if (atmoRef.current) atmoRef.current.innerHTML = "";
      delete (window as unknown as { __diveStationRect?: unknown }).__diveStationRect;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipTo = (target: IntroTarget) => {
    const overlay = overlayRef.current as unknown as { __diveSkipTo?: (t: IntroTarget) => void } | null;
    overlay?.__diveSkipTo?.(target);
  };

  // Two station copies sharing one document — id-suffixed defs (the lab's
  // dim/lit pattern); the lit copy is clipped by the reveal circle.
  const stationDim = useMemo(() => buildStationCanon("D"), []);
  const stationLit = useMemo(() => buildStationCanon("B"), []);

  return (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#07040f",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <style>{DV_CSS}</style>
      <div
        ref={wrapRef}
        style={{ position: "absolute", left: 0, top: 0, width: STAGE_W + "px", height: STAGE_H + "px", transformOrigin: "0 0" }}
      >
        <div ref={sh2Ref} style={{ position: "absolute", inset: 0 }}>
          <div ref={stWrapRef} style={{ position: "absolute", left: "256px", top: "36px", width: "640px", height: "640px", transformOrigin: "50% 50%" }}>
            <div
              ref={stDimRef}
              style={{ position: "absolute", inset: 0, opacity: 0.14 }}
              dangerouslySetInnerHTML={{ __html: stationDim }}
            />
            <div
              ref={stLitRef}
              style={{ position: "absolute", inset: 0 }}
              dangerouslySetInnerHTML={{ __html: stationLit }}
            />
          </div>
          <div ref={shadowRef} style={{ position: "absolute", width: "120px", height: "34px", margin: "-17px 0 0 -60px", background: "#03020a", borderRadius: "50%", opacity: 0 }} />
          <div ref={ripRefs[0]} className="dv-ripple" />
          <div ref={ripRefs[1]} className="dv-ripple" style={{ borderColor: "#cabffc" }} />
          <div ref={ripRefs[2]} className="dv-ripple" style={{ borderColor: "#cabffc", borderWidth: "2px" }} />
          <div ref={birdHostRef} />
          <div ref={heroLandRef} className="dv-heroW">
            <canvas ref={hl[0]} width={48} height={60} />
            <canvas ref={hl[1]} width={48} height={60} />
          </div>
          <div ref={atmoRef} style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none", overflow: "hidden" }} />
        </div>
        <div ref={sh1Ref} style={{ position: "absolute", inset: 0 }}>
          <div ref={rayRefs[0]} className="dv-ray" style={{ left: "16%" }} />
          <div ref={rayRefs[1]} className="dv-ray" style={{ left: "44%" }} />
          <div ref={rayRefs[2]} className="dv-ray" style={{ left: "71%" }} />
          <div ref={moteHostRef} />
          <div ref={glowRef} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "130px", background: "#fff3a0", opacity: 0 }} />
          <div ref={heroFallRef} className="dv-heroW">
            <canvas ref={hf[0]} width={48} height={60} />
            <canvas ref={hf[1]} width={48} height={60} />
          </div>
        </div>
      </div>
      {/* skip + portfolio-only — site space, never scaled with the stage */}
      <div
        ref={skipRowRef}
        data-dive-controls
        style={{
          position: "absolute",
          right: "18px",
          bottom: "14px",
          display: "flex",
          gap: "18px",
          fontFamily: MONO,
          fontSize: "12px",
          letterSpacing: ".08em",
          color: "#8a84a8",
          zIndex: 2,
          transition: "opacity .4s ease",
        }}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            skipTo("gate");
          }}
          style={{ cursor: "pointer" }}
        >
          skip ▸
        </span>
      </div>
    </div>
  );
}
