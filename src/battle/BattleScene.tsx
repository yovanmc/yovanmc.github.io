import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  battleReduce,
  initBattle,
  isScreamTurn,
  type AbilityId,
  type BattleAction,
  type BattleState,
  type Bat,
} from "./engine";
import { PAL } from "../generated/diveTimeline";
import {
  IDLE, ATK, ATK_MS, BUFF, BUFF_MS, CAST, CAST_MS, PWR, PWR_MS,
  HIT, HIT_MS, KO, KO_MS,
} from "../generated/heroBattle";
import type { Grid } from "../generated/heroBattle";
import {
  SWARM, JIT, batFinal, batFinalPost, eOutline, eDitherAll, eOverlay,
  newG, screamRipple, EROWS, ECOLS,
} from "../generated/bossAlertStorm";
import { varAS, SR, SC, BOSS_AT, HERO_AT } from "../generated/battlefieldScene";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

/**
 * M5 battle renderer (plan 2026-07-28-be1-battle-engine-plan.md §Architecture 3).
 * The engine is the only rules authority; this component composes the scene
 * from extracted lab primitives against engine state and sequences the reels.
 * Composition contract (verified against the lab's own compose()): actor grids
 * stamp TOP-LEFT-anchored, 1:1 cells, swarm at BOSS_AT, hero at HERO_AT.
 */

interface FloatNum {
  id: number;
  text: string;
  color: string;
  /** arena cell coords */
  r: number;
  c: number;
  born: number;
}

type UiMode = "menu" | "target" | "anim" | "pause" | "victory" | "defeat";

interface Props {
  seed: number;
  attempt?: number;
  /** dev capture key: actions replayed through the engine before first render */
  replayActions?: BattleAction[];
  defeatedBosses: string[];
  onVictory: (s: BattleState) => void;
  onForfeit: () => void;
  vw: number;
  vh: number;
  isMobile: boolean;
  playMove: () => void;
  playEnter: () => void;
  playBack: () => void;
}

const COMMANDS: { id: AbilityId; label: string; mp: number; needsTarget: boolean; desc: string }[] = [
  { id: "attack", label: "Attack", mp: 0, needsTarget: true, desc: "12 dmg · +1 MP on hit" },
  { id: "ct", label: "Critical Thinking", mp: 2, needsTarget: false, desc: "3 turns · +50% dealt · −25% taken · screams linger" },
  { id: "pt", label: "Power Through", mp: 3, needsTarget: true, desc: "28 dmg" },
  { id: "debug", label: "Debug", mp: 2, needsTarget: true, desc: "6 dmg · 4×3 DoT · marks the target" },
];

/** Stamp a (string|null)[][] grid onto the scene, skipping nulls (lab stamp() is for packed strings). */
function stampGrid(g: Grid, art: Grid, r0: number, c0: number): void {
  for (let r = 0; r < art.length; r++) {
    const row = art[r];
    for (let c = 0; c < row.length; c++) {
      const k = row[c];
      if (k === null || k === undefined) continue;
      const rr = r0 + r;
      const cc = c0 + c;
      if (rr >= 0 && rr < SR && cc >= 0 && cc < SC) g[rr][cc] = k;
    }
  }
}

/**
 * Compose the swarm grid from per-bat primitives against engine state
 * (the lab's monolithic reels cannot express per-bat death/marks — plan F7).
 */
function composeSwarm(
  bats: Bat[],
  screaming: boolean,
  f: number,
  jitter: boolean,
  fallDr: number,
  ditherMod: number,
): Grid {
  const g = newG();
  const living = bats.filter((b) => b.alive);
  const mouthOf = (b: Bat) => (screaming ? (b.real ? "red" : "hollow") : "stitched");
  for (const b of living) {
    const [r, c, ph] = SWARM[b.pos];
    const jr = jitter ? JIT[b.pos][0] : 0;
    const jc = jitter ? JIT[b.pos][1] : 0;
    const dr = fallDr > 0 ? fallDr + (b.pos % 3) * 2 : 0;
    batFinal(g, r + jr + dr, c + jc, (f + ph) % 2, mouthOf(b));
  }
  let out = eOutline(g);
  for (const b of living) {
    const [r, c, ph] = SWARM[b.pos];
    const jr = jitter ? JIT[b.pos][0] : 0;
    const jc = jitter ? JIT[b.pos][1] : 0;
    const dr = fallDr > 0 ? fallDr + (b.pos % 3) * 2 : 0;
    batFinalPost(out, r + jr + dr, c + jc, (f + ph) % 2, mouthOf(b));
    if (b.marked) {
      // purple mark chevron above the bat — the memory tool made visible
      const mr = r + jr + dr - 2;
      const mc = c + jc + 6;
      for (const [pr, pc] of [[0, 0], [1, 1], [0, 2]] as const) {
        const rr = mr + pr;
        const cc = mc + pc;
        if (rr >= 0 && rr < EROWS && cc >= 0 && cc < ECOLS) out[rr][cc] = "k";
      }
    }
  }
  if (ditherMod > 0) out = eDitherAll(out, ditherMod);
  return out;
}

/** Timeline step: at +ms from action start, do fn. */
interface Step {
  at: number;
  fn: () => void;
}

let floatSeq = 1;

export default function BattleScene(props: Props) {
  const { seed, attempt = 1, replayActions, defeatedBosses, onVictory, onForfeit, vw, vh, isMobile } = props;

  const [state, setState] = useState<BattleState>(() => {
    let s = initBattle({ seed, attempt, defeatedBosses });
    for (const a of replayActions ?? []) s = battleReduce(s, a);
    return s;
  });
  /** what the canvas shows — lags `state` during action animation */
  const [shown, setShown] = useState<BattleState>(state);
  const [mode, setMode] = useState<UiMode>(() =>
    state.status === "victory" ? "victory" : state.status === "defeat" ? "defeat" : "menu",
  );
  const [cmdIdx, setCmdIdx] = useState(0);
  const [cursorBat, setCursorBat] = useState<number | null>(null);
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [flutter, setFlutter] = useState(0);
  const [swarmFx, setSwarmFx] = useState<{ jitter?: boolean; ripple?: number; fall?: number; dither?: number }>({});
  const [heroReel, setHeroReel] = useState<{ frames: Grid[]; ms: number[] } | null>(null);
  const [heroFrame, setHeroFrame] = useState(0);
  const [banner, setBanner] = useState("");
  const [descend, setDescend] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const timers = useRef<number[]>([]);
  const stateRef = useRef({ mode, cmdIdx, cursorBat, state, shown });
  stateRef.current = { mode, cmdIdx, cursorBat, state, shown };

  // ---- geometry: contain-fit desktop, width-fit mobile (plan §Architecture 3) ----
  const scale = useMemo(() => {
    const fit = Math.min(vw / SC, (vh * 0.72) / SR);
    return isMobile ? vw / SC : Math.max(2, Math.floor(fit * 2) / 2);
  }, [vw, vh, isMobile]);
  const stageW = SC * scale;
  const stageH = SR * scale;
  const stageLeft = (vw - stageW) / 2;
  const stageTop = isMobile ? Math.max(12, (vh - stageH) * 0.32) : Math.max(8, (vh * 0.86 - stageH) / 2);

  // arena backgrounds, both flutter phases, built once
  const arena = useMemo(() => [varAS(0), varAS(1)], []);

  // ---- descend beat: swarm fades in, inputs unlock after ----
  const descendRef = useRef(true);
  useEffect(() => {
    const t = window.setTimeout(() => {
      descendRef.current = false;
      setDescend(false);
    }, 900);
    return () => window.clearTimeout(t);
  }, []);

  // ---- flutter clock ----
  useEffect(() => {
    const t = window.setInterval(() => setFlutter((f) => 1 - f), 440);
    return () => window.clearInterval(t);
  }, []);

  // ---- hero reel clock ----
  useEffect(() => {
    if (!heroReel) return;
    if (heroFrame >= heroReel.frames.length - 1) return;
    const t = window.setTimeout(
      () => setHeroFrame((f) => f + 1),
      heroReel.ms[heroFrame] ?? 140,
    );
    return () => window.clearTimeout(t);
  }, [heroReel, heroFrame]);

  // ---- float cleanup ----
  useEffect(() => {
    if (!floats.length) return;
    const t = window.setTimeout(() => {
      const now = performance.now();
      setFloats((fs) => fs.filter((f) => now - f.born < 950));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [floats]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // ---- canvas composition + draw ----
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    if (!offRef.current) {
      offRef.current = document.createElement("canvas");
      offRef.current.width = SC;
      offRef.current.height = SR;
    }
    const off = offRef.current;
    const octx = off.getContext("2d")!;

    const g = arena[flutter].map((row) => row.slice());
    const screaming = isScreamTurn(shown) && shown.status === "active";
    if (!descend && shown.status !== "victory") {
      let swarm = composeSwarm(
        shown.bats, screaming, flutter,
        !!swarmFx.jitter, swarmFx.fall ?? 0, swarmFx.dither ?? 0,
      );
      if (swarmFx.ripple) swarm = eOverlay(swarm, screamRipple(swarmFx.ripple));
      stampGrid(g, swarm, BOSS_AT[0], BOSS_AT[1]);
    }
    const heroGrid =
      heroReel ? heroReel.frames[Math.min(heroFrame, heroReel.frames.length - 1)] : IDLE[flutter];
    stampGrid(g, heroGrid, HERO_AT[0], HERO_AT[1]);

    octx.clearRect(0, 0, SC, SR);
    for (let r = 0; r < SR; r++) {
      for (let c = 0; c < SC; c++) {
        const k = g[r][c];
        if (k === null || k === undefined) continue;
        octx.fillStyle = PAL[k] ?? "#f0f";
        octx.fillRect(c, r, 1, 1);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(off, 0, 0, cv.width, cv.height);
  }, [shown, flutter, swarmFx, heroReel, heroFrame, arena, descend, scale]);

  // ---- action sequencing ----
  const schedule = useCallback((steps: Step[]) => {
    for (const s of steps) timers.current.push(window.setTimeout(s.fn, s.at));
  }, []);

  const pushFloat = useCallback((text: string, color: string, r: number, c: number) => {
    setFloats((fs) => [...fs, { id: floatSeq++, text, color, r, c, born: performance.now() }]);
  }, []);

  const batCell = useCallback((s: BattleState, batId: number): [number, number] => {
    const bat = s.bats.find((b) => b.id === batId)!;
    const [r, c] = SWARM[bat.pos];
    return [BOSS_AT[0] + r, BOSS_AT[1] + c + 7];
  }, []);

  const commit = useCallback(
    (action: BattleAction) => {
      const before = stateRef.current.state;
      const next = battleReduce(before, action);
      if (next.events.some((e) => e.type === "invalid")) {
        props.playBack();
        return;
      }
      setState(next);
      setMode("anim");
      setCursorBat(null);
      props.playEnter();

      const reel: Record<AbilityId, { frames: Grid[]; ms: number[] }> = {
        attack: { frames: ATK, ms: ATK_MS },
        ct: { frames: BUFF, ms: BUFF_MS },
        pt: { frames: PWR, ms: PWR_MS },
        debug: { frames: CAST, ms: CAST_MS },
      };
      setHeroFrame(0);
      setHeroReel(reel[action.type]);

      const events = next.events;
      const steps: Step[] = [];
      const impactAt = 520;
      let t = impactAt;

      steps.push({
        at: t,
        fn: () => {
          // damage / marks / deaths land — the canvas flips to the post-action world
          setShown(next);
          for (const e of events) {
            if (e.type === "damage" || e.type === "dot") {
              const [r, c] = batCell(next, e.batId);
              pushFloat(String(e.amount), e.type === "dot" ? "#c9a4ff" : "#ffe9a8", r, c);
            }
            if (e.type === "mark") {
              const [r, c] = batCell(next, e.batId);
              pushFloat("MARKED", "#c9a4ff", r - 4, c);
            }
          }
        },
      });
      if (events.some((e) => e.type === "reshuffle")) {
        steps.push({ at: t + 60, fn: () => setSwarmFx((fx) => ({ ...fx, jitter: true })) });
        steps.push({ at: t + 320, fn: () => setSwarmFx((fx) => ({ ...fx, jitter: false })) });
        t += 340;
      }

      if (next.status === "victory") {
        steps.push({ at: t + 200, fn: () => setSwarmFx({ ripple: 1 }) });
        steps.push({ at: t + 420, fn: () => setSwarmFx({ ripple: 3 }) });
        steps.push({ at: t + 620, fn: () => setSwarmFx({ fall: 4, dither: 2 }) });
        steps.push({ at: t + 900, fn: () => setSwarmFx({ fall: 10, dither: 3 }) });
        steps.push({
          at: t + 1250,
          fn: () => {
            setSwarmFx({});
            setHeroReel(null);
            setMode("victory");
          },
        });
        schedule(steps);
        return;
      }

      // boss volley (only when the battle continues)
      const volley = events.find((e) => e.type === "heroDamage");
      if (volley) {
        steps.push({ at: t + 300, fn: () => setSwarmFx({ ripple: 1 }) });
        steps.push({ at: t + 440, fn: () => setSwarmFx({ ripple: 2 }) });
        steps.push({
          at: t + 580,
          fn: () => {
            setSwarmFx({ ripple: 3 });
            setHeroFrame(0);
            setHeroReel({ frames: HIT, ms: HIT_MS });
            pushFloat(String((volley as { amount: number }).amount), "#ff9d8a", HERO_AT[0] - 4, HERO_AT[1] + 24);
          },
        });
        steps.push({ at: t + 760, fn: () => setSwarmFx({}) });
        t += 900;
      }

      if (next.status === "defeat") {
        steps.push({ at: t + 100, fn: () => { setHeroFrame(0); setHeroReel({ frames: KO, ms: KO_MS }); } });
        steps.push({ at: t + 1100, fn: () => setMode("defeat") });
        schedule(steps);
        return;
      }

      steps.push({
        at: t + 260,
        fn: () => {
          setHeroReel(null);
          setSwarmFx({});
          setMode("menu");
        },
      });
      schedule(steps);
    },
    [batCell, props, pushFloat, schedule],
  );

  const livingByColumn = useCallback((s: BattleState) => {
    return s.bats
      .filter((b) => b.alive)
      .sort((a, b) => SWARM[a.pos][1] - SWARM[b.pos][1]);
  }, []);

  const startTarget = useCallback(() => {
    const living = livingByColumn(stateRef.current.state);
    setCursorBat(living[0]?.id ?? null);
    setMode("target");
    props.playEnter();
  }, [livingByColumn, props]);

  const cycleTarget = useCallback(
    (dir: number) => {
      const living = livingByColumn(stateRef.current.state);
      if (!living.length) return;
      const cur = stateRef.current.cursorBat;
      const i = Math.max(0, living.findIndex((b) => b.id === cur));
      const nextBat = living[(i + dir + living.length) % living.length];
      setCursorBat(nextBat.id);
      props.playMove();
    },
    [livingByColumn, props],
  );

  const retry = useCallback(() => {
    const nextAttempt = stateRef.current.state.attempt + 1;
    let s = initBattle({ seed, attempt: nextAttempt, defeatedBosses });
    setState(s);
    setShown(s);
    setFloats([]);
    setSwarmFx({});
    setHeroReel(null);
    setBanner("");
    setMode("menu");
    setCmdIdx(0);
    props.playEnter();
  }, [seed, defeatedBosses, props]);

  // ---- scream banner ----
  useEffect(() => {
    if (shown.status !== "active" || descend) {
      setBanner("");
      return;
    }
    setBanner(isScreamTurn(shown) ? "THE SWARM SCREAMS · ONE VOICE RUNS RED" : "");
  }, [shown, descend]);

  // ---- input (BattleScene owns keys while mounted; App early-returns on battle) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.key === "Tab") return;
      if (descendRef.current) return; // inputs unlock after the descend beat
      const k = e.key.replace(/^(Right|Left|Up|Down)$/, "Arrow$1").replace("Spacebar", " ");
      const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Backspace", " "];
      if (handled.includes(k)) e.preventDefault();
      const m = stateRef.current.mode;

      if (m === "menu") {
        if (k === "ArrowUp" || k === "ArrowDown") {
          const dir = k === "ArrowUp" ? -1 : 1;
          setCmdIdx((i) => (i + dir + COMMANDS.length) % COMMANDS.length);
          props.playMove();
        } else if (k === "Enter" || k === " " || k === "ArrowRight") {
          const cmd = COMMANDS[stateRef.current.cmdIdx];
          if (stateRef.current.state.hero.mp < cmd.mp) {
            props.playBack();
            return;
          }
          if (cmd.needsTarget) startTarget();
          else commit({ type: "ct" });
        } else if (k === "Escape" || k === "Backspace") {
          setMode("pause");
          props.playBack();
        }
      } else if (m === "target") {
        if (k === "ArrowLeft" || k === "ArrowUp") cycleTarget(-1);
        else if (k === "ArrowRight" || k === "ArrowDown") cycleTarget(1);
        else if (k === "Enter" || k === " ") {
          const cmd = COMMANDS[stateRef.current.cmdIdx];
          const target = stateRef.current.cursorBat;
          if (target !== null)
            commit({ type: cmd.id, target } as BattleAction);
        } else if (k === "Escape" || k === "Backspace") {
          setCursorBat(null);
          setMode("menu");
          props.playBack();
        }
      } else if (m === "pause") {
        if (k === "Escape" || k === "Backspace") {
          setMode("menu");
          props.playBack();
        } else if (k === "Enter") {
          setMode("menu");
          props.playEnter();
        }
      } else if (m === "victory") {
        if (k === "Enter" || k === " " || k === "Escape") onVictory(stateRef.current.state);
      } else if (m === "defeat") {
        if (k === "Enter" || k === " ") retry();
        else if (k === "Escape" || k === "Backspace") onForfeit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, cycleTarget, onForfeit, onVictory, props, retry, startTarget]);

  // ---- derived UI values ----
  const real = state.bats.find((b) => b.real)!;
  const revealBoss = real.marked || !real.alive;
  const livingCount = state.bats.filter((b) => b.alive).length;
  const cursor = cursorBat !== null ? state.bats.find((b) => b.id === cursorBat) : null;
  const cursorRead = cursor
    ? cursor.marked || !cursor.alive
      ? `${cursor.hp}/${cursor.maxHp}`
      : "??/??"
    : "";
  const cellPx = (r: number, c: number) => ({
    left: stageLeft + c * scale,
    top: stageTop + r * scale,
  });

  const panel: React.CSSProperties = {
    background: "linear-gradient(160deg, rgba(30,20,44,.86), rgba(14,10,26,.85))",
    border: "1px solid rgba(190,140,255,.34)",
    borderRadius: "13px",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05), 0 18px 48px -14px rgba(0,0,0,.75), 0 0 36px rgba(150,60,255,.14)",
    backdropFilter: "blur(11px)",
    WebkitBackdropFilter: "blur(11px)",
  };

  const bar = (val: number, max: number, color: string, w: number) => (
    <div style={{ width: w, height: 8, borderRadius: 4, background: "rgba(255,255,255,.12)", overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.max(0, (val / max) * 100)}%`,
          height: "100%",
          background: color,
          transition: "width .4s ease",
        }}
      />
    </div>
  );

  return (
    <div data-battle style={{ position: "absolute", inset: 0, zIndex: 8, overflow: "hidden" }}>
      {/* red-tinged backdrop over the site background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 110% 90% at 50% 20%, rgba(70,10,16,.55) 0%, rgba(10,6,16,.9) 70%)",
          animation: descend ? "battleIn .9s ease both" : undefined,
        }}
      />

      {/* stage */}
      <canvas
        ref={canvasRef}
        width={Math.round(stageW)}
        height={Math.round(stageH)}
        style={{
          position: "absolute",
          left: stageLeft,
          top: stageTop,
          width: stageW,
          height: stageH,
          imageRendering: "pixelated",
        }}
      />

      {/* damage floats */}
      {floats.map((f) => {
        const p = cellPx(f.r, f.c);
        return (
          <div
            key={f.id}
            style={{
              position: "absolute",
              left: p.left,
              top: p.top,
              fontFamily: MONO,
              fontSize: f.text.length > 3 ? "12px" : "17px",
              fontWeight: 700,
              color: f.color,
              textShadow: "0 0 8px rgba(0,0,0,.9), 0 0 14px " + f.color,
              animation: "battleFloat .95s ease-out both",
              pointerEvents: "none",
              zIndex: 12,
            }}
          >
            {f.text}
          </div>
        );
      })}

      {/* target cursor */}
      {mode === "target" && cursor && (
        <div
          style={{
            position: "absolute",
            ...cellPx(BOSS_AT[0] + SWARM[cursor.pos][0] - 5, BOSS_AT[1] + SWARM[cursor.pos][1] + 5),
            zIndex: 12,
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "#ffd97a", fontSize: isMobile ? "22px" : "18px", textShadow: "0 0 10px #ffd97a", animation: "cursorBlink 0.9s ease-in-out infinite" }}>▾</div>
          <div style={{ fontFamily: MONO, fontSize: "11px", color: "#ffe9b0", textShadow: "0 0 6px #000", marginTop: 2 }}>{cursorRead}</div>
        </div>
      )}

      {/* scream banner */}
      {banner && mode !== "victory" && mode !== "defeat" && (
        <div
          style={{
            position: "absolute",
            top: Math.max(10, stageTop - 6),
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: "12px",
            letterSpacing: ".3em",
            color: "#ff8d7a",
            textShadow: "0 0 12px rgba(255,60,40,.8)",
            animation: "glowPulse 1.6s ease-in-out infinite",
            zIndex: 11,
          }}
        >
          {banner}
        </div>
      )}

      {/* boss plate */}
      <div style={{ ...panel, position: "absolute", right: isMobile ? 10 : 30, top: isMobile ? 10 : 26, padding: "10px 14px", zIndex: 11 }}>
        <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".28em", color: "#ff9d8a" }}>ALERT STORM</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          {revealBoss ? (
            bar(real.hp, real.maxHp, "linear-gradient(90deg,#e04838,#bd2421)", isMobile ? 110 : 150)
          ) : (
            <div style={{ fontFamily: MONO, fontSize: "12px", color: "#c9a4ff", letterSpacing: ".2em" }}>?? · DEBUG THE SCREAMER</div>
          )}
        </div>
        <div style={{ fontFamily: MONO, fontSize: "10px", color: "#b9a8d8", marginTop: 5, letterSpacing: ".12em" }}>
          {livingCount}/10 SIGNALS
        </div>
      </div>

      {/* hero plate */}
      <div style={{ ...panel, position: "absolute", right: isMobile ? 10 : 30, bottom: isMobile ? 84 : 30, padding: "10px 14px", zIndex: 11 }}>
        <div style={{ fontFamily: SERIF, fontSize: "15px", color: "#eaf1ff", letterSpacing: ".04em" }}>Yovan</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: "10px", color: "#8fd6a8", width: 20 }}>HP</span>
          {bar(state.hero.hp, state.hero.maxHp, "linear-gradient(90deg,#7fe0a0,#3fae6a)", isMobile ? 110 : 150)}
          <span style={{ fontFamily: MONO, fontSize: "11px", color: "#cfe9d8" }}>{state.hero.hp}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: "10px", color: "#9fc4ff", width: 20 }}>MP</span>
          {bar(state.hero.mp, state.hero.maxMp, "linear-gradient(90deg,#7fb0ff,#4a6ae0)", isMobile ? 110 : 150)}
          <span style={{ fontFamily: MONO, fontSize: "11px", color: "#cfe0ff" }}>{state.hero.mp}</span>
        </div>
      </div>

      {/* command menu */}
      {(mode === "menu" || mode === "target") && (
        <div style={{ ...panel, position: "absolute", left: isMobile ? 10 : 38, bottom: isMobile ? 10 : 38, width: isMobile ? "auto" : 262, right: isMobile ? 10 : "auto", zIndex: 11, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid rgba(190,140,255,.2)", background: "linear-gradient(90deg, rgba(150,80,255,.14), transparent)" }}>
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".3em", color: "#c9a4ff" }}>
              {mode === "target" ? "TARGET" : "COMMAND"}
            </span>
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".14em", color: "#8a7ba8" }}>TURN {state.turn}</span>
          </div>
          <div style={{ padding: "8px" }}>
            {mode === "target" ? (
              <div style={{ padding: "8px 10px", fontFamily: MONO, fontSize: "12px", color: "#d8ccf0", lineHeight: 1.6 }}>
                {isMobile ? "Tap the swarm to cycle · " : "←→ cycle · "}⏎ confirm · ESC back
              </div>
            ) : (
              COMMANDS.map((c, i) => {
                const active = i === cmdIdx;
                const afford = state.hero.mp >= c.mp;
                return (
                  <div
                    key={c.id}
                    role="button"
                    onClick={() => {
                      if (mode !== "menu" || descend) return;
                      setCmdIdx(i);
                      if (!afford) {
                        props.playBack();
                        return;
                      }
                      if (c.needsTarget) startTarget();
                      else commit({ type: "ct" });
                    }}
                    onMouseEnter={() => setCmdIdx(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 9,
                      cursor: afford ? "pointer" : "default",
                      color: !afford ? "#5f5576" : active ? "#f2ecff" : "#c2b4de",
                      background: active ? "linear-gradient(90deg, rgba(160,90,255,.3), rgba(160,90,255,.05))" : "transparent",
                      border: active ? "1px solid rgba(200,150,255,.4)" : "1px solid transparent",
                      fontSize: "14px",
                      fontFamily: "'Sora',sans-serif",
                    }}
                  >
                    <span style={{ width: 12, color: active ? "#c9a4ff" : "transparent" }}>▸</span>
                    <span style={{ flex: 1 }}>{c.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: afford ? "#9f8fd0" : "#5f5576" }}>
                      {c.mp > 0 ? c.mp + " MP" : "FREE"}
                    </span>
                  </div>
                );
              })
            )}
            {mode === "menu" && (
              <div style={{ padding: "7px 12px 3px", fontFamily: MONO, fontSize: "10px", color: "#8a7ba8", letterSpacing: ".08em", borderTop: "1px solid rgba(190,140,255,.14)", marginTop: 4 }}>
                {COMMANDS[cmdIdx].desc}
              </div>
            )}
          </div>
        </div>
      )}

      {/* tap-to-cycle: the whole stage cycles targets on coarse pointers */}
      {mode === "target" && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            cycleTarget(1);
          }}
          style={{ position: "absolute", left: stageLeft, top: stageTop, width: stageW, height: stageH * 0.62, zIndex: 10, cursor: "pointer" }}
        />
      )}
      {mode === "target" && (
        <div
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            const cmd = COMMANDS[stateRef.current.cmdIdx];
            const target = stateRef.current.cursorBat;
            if (target !== null) commit({ type: cmd.id, target } as BattleAction);
          }}
          style={{
            ...panel,
            position: "absolute",
            right: isMobile ? 10 : 38,
            bottom: isMobile ? 10 : 96,
            padding: "12px 22px",
            zIndex: 12,
            cursor: "pointer",
            fontFamily: MONO,
            fontSize: "13px",
            letterSpacing: ".2em",
            color: "#ffe9b0",
          }}
        >
          CONFIRM ⏎
        </div>
      )}

      {/* pause overlay */}
      {mode === "pause" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 14, background: "rgba(6,4,12,.72)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...panel, padding: "26px 34px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".3em", color: "#c9a4ff", marginBottom: 16 }}>PAUSED</div>
            <div role="button" onClick={() => { setMode("menu"); props.playEnter(); }} style={{ cursor: "pointer", padding: "10px 18px", color: "#f2ecff", fontFamily: "'Sora',sans-serif", fontSize: "15px" }}>
              Resume <span style={{ fontFamily: MONO, fontSize: "10px", color: "#8a7ba8" }}>⏎ / ESC</span>
            </div>
            <div role="button" onClick={onForfeit} style={{ cursor: "pointer", padding: "10px 18px", color: "#b9a8d8", fontFamily: "'Sora',sans-serif", fontSize: "14px" }}>
              Forfeit · back to the gate
            </div>
          </div>
        </div>
      )}

      {/* victory overlay */}
      {mode === "victory" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 14, background: "radial-gradient(ellipse at 50% 40%, rgba(30,20,10,.5), rgba(6,4,12,.88))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...panel, border: "1px solid rgba(255,215,120,.45)", boxShadow: "0 0 60px rgba(255,190,80,.2), inset 0 0 0 1px rgba(255,255,255,.06)", padding: "30px 40px", textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".34em", color: "#ffd97a" }}>SIGNAL FOUND</div>
            <div style={{ fontFamily: SERIF, fontSize: "26px", color: "#fdf6e3", margin: "12px 0 4px" }}>The Alert Storm breaks</div>
            {state.events.some((e) => e.type === "forge") || state.defeatedBosses.includes("alert-storm") ? (
              <div style={{ fontFamily: MONO, fontSize: "12px", color: "#ffe9b0", letterSpacing: ".12em", marginTop: 10, lineHeight: 2 }}>
                {state.events.some((e) => e.type === "forge") ? (
                  <>
                    ⚔ FAN OUT · FORGED
                    <br />
                    +10 MAX HP · +2 MAX MP
                    <br />
                  </>
                ) : (
                  <>A VICTORY LAP · THE STORM REMEMBERS<br /></>
                )}
              </div>
            ) : null}
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "13px", color: "#b9a8d8", marginTop: 14 }}>
              Three more wait in the dark. More coming.
            </div>
            <div role="button" onClick={() => onVictory(stateRef.current.state)} style={{ cursor: "pointer", marginTop: 18, padding: "10px 18px", color: "#f2ecff", fontFamily: MONO, fontSize: "12px", letterSpacing: ".22em" }}>
              CONTINUE ⏎
            </div>
          </div>
        </div>
      )}

      {/* defeat overlay */}
      {mode === "defeat" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 14, background: "rgba(6,4,12,.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...panel, padding: "28px 38px", textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".3em", color: "#ff9d8a" }}>DROWNED OUT</div>
            <div style={{ fontFamily: SERIF, fontSize: "22px", color: "#eee6f6", margin: "10px 0 4px" }}>The storm takes the sky</div>
            <div role="button" onClick={retry} style={{ cursor: "pointer", marginTop: 16, padding: "10px 18px", color: "#f2ecff", fontFamily: MONO, fontSize: "12px", letterSpacing: ".2em" }}>
              RETRY ⏎
            </div>
            <div role="button" onClick={onForfeit} style={{ cursor: "pointer", padding: "8px 18px", color: "#b9a8d8", fontFamily: "'Sora',sans-serif", fontSize: "13px" }}>
              Leave · back to the gate
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes battleFloat { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(-34px); opacity: 0; } }
        @keyframes battleIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
