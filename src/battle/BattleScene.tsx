import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  assertNever,
  battleReduce,
  deriveKit,
  initBattle,
  isScreamTurn,
  type AbilityId,
  type Bat,
  type BattleAction,
  type BattleState,
  type BossState,
} from "./engine";
import { commandsForKit, type AbilityCommand } from "./abilities";
import { deriveMenuView, initialMenuState, menuReduce, type MenuInput, type MenuState } from "./commandMenu";
import { sceneFor } from "./scenes";
import { CASCADE_ID, type CascadeNode } from "./bosses/cascade";
import { livingTargets, SF_TARGET_ID, SILENT_FAILURE_ID } from "./bosses/silentFailure";
import {
  IMPOSTER_ID,
  livingTargets as imposterLivingTargets,
} from "./bosses/imposter";
import { imposterBatAnchor, imposterCursorAnchor } from "./scenes/imposter";
import { nodeBox } from "./scenes/cascadeCompose";
import { cellRect, stageMetrics } from "./layout";
import { menuPanelMaxHeight } from "./panelBudget";
import { PIECES as SF_PIECES } from "../generated/bossSilentFailure";
import { shouldComposeBoss } from "./sceneGate";
import type { ComposeGateMode } from "./sceneGate";
import { PAL } from "../generated/diveTimeline";
import {
  IDLE, ATK, ATK_MS, BUFF, BUFF_MS, CAST, CAST_MS, PWR, PWR_MS,
  FAN, FAN_MS, RBK, RBK_MS,
  HIT, HIT_MS, KO, KO_MS,
  ROOT, ROOT_MS, CONV, CONV_MS, DEBUFF, goldHairOf,
} from "../generated/heroBattle";
import type { Grid } from "../generated/heroBattle";
import { SWARM } from "../generated/bossAlertStorm";
import { SR, SC, BOSS_AT, HERO_AT } from "../generated/battlefieldScene";
import { battleExit, skipToWork } from "../landingCopy";

/** Alert Storm's bat list, or [] for any other boss, so the targeting,
 * float and plate helpers below never crash on a different boss shape. */
function alertBats(boss: BossState): Bat[] {
  if (boss.kind === "alert-storm") return boss.bats;
  if (boss.kind === CASCADE_ID) return [];
  if (boss.kind === SILENT_FAILURE_ID) return [];
  if (boss.kind === IMPOSTER_ID) return [];
  return assertNever(boss);
}

function cascadeNodes(boss: BossState): CascadeNode[] {
  if (boss.kind === CASCADE_ID) return boss.nodes;
  if (boss.kind === "alert-storm") return [];
  if (boss.kind === SILENT_FAILURE_ID) return [];
  if (boss.kind === IMPOSTER_ID) return [];
  return assertNever(boss);
}

/** Silent Failure's one static position, derived from the generated armor
 * pieces so it cannot drift from the art. The armor never moves, so one
 * bounding box is enough. */
const SF_ARMOR_BOX = SF_PIECES.reduce(
  (acc, [r1, , c1, c2]) => ({
    top: Math.min(acc.top, r1),
    left: Math.min(acc.left, c1),
    right: Math.max(acc.right, c2),
  }),
  { top: Infinity, left: Infinity, right: -Infinity },
);
const SF_ARMOR_MID_COL = Math.floor((SF_ARMOR_BOX.left + SF_ARMOR_BOX.right) / 2);

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

/**
 * Battle renderer. The engine is the only rules authority; this composes the
 * scene from generated sprite primitives against engine state and sequences
 * the reels. Actor grids stamp top-left-anchored, 1:1 cells, swarm at
 * BOSS_AT, hero at HERO_AT.
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

// Imported, not re-declared, so a new mode here cannot desync from the gate.
type UiMode = ComposeGateMode;

interface Props {
  seed: number;
  attempt?: number;
  /** `boss=` capture key / FIGHT selection, passed to `initBattle`. Undefined
   * falls back to Alert Storm. */
  boss?: string;
  /** dev capture key: actions replayed through the engine before first render */
  replayActions?: BattleAction[];
  defeatedBosses: string[];
  onVictory: (s: BattleState) => void;
  onForfeit: () => void;
  /** Leaves the fight for the landing page. Always visible, mouse and touch. */
  onExit: () => void;
  vw: number;
  vh: number;
  isMobile: boolean;
  playMove: () => void;
  playEnter: () => void;
  playBack: () => void;
}

/** Stamp a (string|null)[][] grid onto the scene, skipping nulls. */
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

/** Timeline step: at +ms from action start, do fn. */
interface Step {
  at: number;
  fn: () => void;
}

let floatSeq = 1;

export default function BattleScene(props: Props) {
  const { seed, attempt = 1, boss, replayActions, defeatedBosses, onVictory, onForfeit, onExit, vw, vh, isMobile } = props;

  const [state, setState] = useState<BattleState>(() => {
    let s = initBattle({ seed, attempt, defeatedBosses, boss });
    for (const a of replayActions ?? []) s = battleReduce(s, a);
    return s;
  });
  /** what the canvas shows — lags `state` during action animation */
  const [shown, setShown] = useState<BattleState>(state);
  const [mode, setMode] = useState<UiMode>(() =>
    state.status === "victory" ? "victory" : state.status === "defeat" ? "defeat" : "menu",
  );
  const [menu, setMenu] = useState<MenuState>(initialMenuState);
  const [pendingCmd, setPendingCmd] = useState<AbilityCommand | null>(null);
  const [cursorBat, setCursorBat] = useState<number | null>(null);
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [flutter, setFlutter] = useState(0);
  const [swarmFx, setSwarmFx] = useState<{ jitter?: boolean; ripple?: number; fall?: number; dither?: number }>({});
  const [heroReel, setHeroReel] = useState<{ frames: Grid[]; ms: number[] } | null>(null);
  const [heroFrame, setHeroFrame] = useState(0);
  const [banner, setBanner] = useState("");
  const [descend, setDescend] = useState(true);

  const scene = sceneFor(state.boss.kind);
  const commands = useMemo(
    () => commandsForKit(deriveKit(state.defeatedBosses)),
    [state.defeatedBosses],
  );
  const view = useMemo(() => deriveMenuView(commands, menu.level), [commands, menu.level]);
  const currentCursor = menu.cursor[menu.level];
  const activeRow = view.rows[currentCursor];
  const footerDesc = activeRow ? (activeRow.kind === "ability" ? activeRow.cmd.desc : activeRow.desc) : "";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const timers = useRef<number[]>([]);
  const stateRef = useRef({ mode, menu, pendingCmd, cursorBat, state, shown, commands });
  stateRef.current = { mode, menu, pendingCmd, cursorBat, state, shown, commands };

  // The panel is height-clamped and its list scrolls, so keep the active row
  // in view on every cursor move, including wraps and level changes (each
  // level keeps its own cursor).
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [menu.level, currentCursor]);

  // Drives the bottom fade and chevron. The effect sits below
  // `cmdPanelMaxHeight`, which is in its dependency array.
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Contain-fit on desktop, width-fit on mobile (layout.ts).
  const { scale, stageW, stageH, stageLeft, stageTop } = useMemo(
    () => stageMetrics(vw, vh, isMobile),
    [vw, vh, isMobile],
  );

  // Viewport-aware cap on the command panel (panelBudget.ts). The
  // container's height equals `vh` at every viewport, so `vh` is passed.
  const cmdPanelMaxHeight = useMemo(
    () => Math.round(menuPanelMaxHeight(vw, vh, vh, isMobile)),
    [vw, vh, isMobile],
  );

  useEffect(() => {
    const el = scrollBodyRef.current;
    setOverflowing(!!el && el.scrollHeight > el.clientHeight + 0.5);
  }, [view, cmdPanelMaxHeight, isMobile, mode]);

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

    // Reads `shown` (animation-lagged), not `state`, so the stage-3 station
    // stays on screen through the Imposter's death animation. Bosses without
    // `arenaFor` use the scene's single static arena.
    const g = (scene.arenaFor?.(shown.boss) ?? scene.arena)[flutter].map((row) => row.slice());
    const screaming = isScreamTurn(shown) && shown.status === "active";
    // Gate on `mode`, not `shown.status`: status flips to "victory" on the
    // first animation step after a killing blow, which would blank the boss
    // layer for the whole death animation. `mode` stays "anim" until the
    // victory overlay is up.
    if (shouldComposeBoss({ descend, mode })) {
      const bossGrid = scene.composeBoss(shown.boss, screaming, flutter, swarmFx);
      // Imposter's clone spread supplies its own origin; others use BOSS_AT.
      const bossOrigin = scene.stampOrigin?.(shown.boss) ?? BOSS_AT;
      stampGrid(g, bossGrid, bossOrigin[0], bossOrigin[1]);
    }
    // Conviction's gold-hair remap applies to whatever frame is selected,
    // idle or mid-cast. `hd` matches the idle frames' headO exactly; reel
    // frames vary headO with no exported metadata, so `flutter` approximates
    // there (cosmetic). The DEBUFF cue shows only at idle so it never fights
    // an ability animation for the frame.
    const heroBase = heroReel
      ? heroReel.frames[Math.min(heroFrame, heroReel.frames.length - 1)]
      : shown.heroMarked
        ? DEBUFF[Math.min(flutter, DEBUFF.length - 1)]
        : IDLE[flutter];
    const heroGrid = shown.conviction ? goldHairOf(heroBase, flutter) : heroBase;
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
  }, [shown, flutter, swarmFx, heroReel, heroFrame, scene, descend, scale, mode]);

  const schedule = useCallback((steps: Step[]) => {
    for (const s of steps) timers.current.push(window.setTimeout(s.fn, s.at));
  }, []);

  const pushFloat = useCallback((text: string, color: string, r: number, c: number) => {
    setFloats((fs) => [...fs, { id: floatSeq++, text, color, r, c, born: performance.now() }]);
  }, []);

  /** Float (damage/dot/mark numbers) and cursor anchor for a target id.
   * Cascade centers above the node's real footprint (`nodeBox`, bob 0);
   * node 0 is larger than the rest. */
  const batCell = useCallback((s: BattleState, targetId: number): [number, number] => {
    if (s.boss.kind === CASCADE_ID) {
      const box = nodeBox(targetId, 0);
      const midC = Math.floor((box.c + box.c2) / 2);
      return [BOSS_AT[0] + box.rr, BOSS_AT[1] + midC];
    }
    if (s.boss.kind === "alert-storm") {
      const bat = alertBats(s.boss).find((b) => b.id === targetId)!;
      const [r, c] = SWARM[bat.pos];
      return [BOSS_AT[0] + r, BOSS_AT[1] + c + 7];
    }
    if (s.boss.kind === SILENT_FAILURE_ID) {
      // Centered above the armor's bounding box, like Cascade's nodes.
      return [BOSS_AT[0] + SF_ARMOR_BOX.top, BOSS_AT[1] + SF_ARMOR_MID_COL];
    }
    if (s.boss.kind === IMPOSTER_ID) {
      // Keyed off the same `stampOrigin` composeBoss stamps at, so the float
      // never targets art that isn't there. One home per slot during CLONES.
      return imposterBatAnchor(s.boss, targetId);
    }
    return assertNever(s.boss);
  }, []);

  /** Target-cursor arrow anchor: sits closer above the sprite than the
   * `batCell` float. */
  const cursorCell = useCallback((s: BattleState, targetId: number): [number, number] => {
    if (s.boss.kind === CASCADE_ID) {
      const box = nodeBox(targetId, 0);
      const midC = Math.floor((box.c + box.c2) / 2);
      return [BOSS_AT[0] + box.rr - 5, BOSS_AT[1] + midC - 2];
    }
    if (s.boss.kind === "alert-storm") {
      const bat = alertBats(s.boss).find((b) => b.id === targetId)!;
      const [r, c] = SWARM[bat.pos];
      return [BOSS_AT[0] + r - 5, BOSS_AT[1] + c + 5];
    }
    if (s.boss.kind === SILENT_FAILURE_ID) {
      // The fight's one cursor home, vanished or not, so the boss stays
      // selectable the whole fight.
      return [BOSS_AT[0] + SF_ARMOR_BOX.top - 5, BOSS_AT[1] + SF_ARMOR_MID_COL - 2];
    }
    if (s.boss.kind === IMPOSTER_ID) {
      return imposterCursorAnchor(s.boss, targetId);
    }
    return assertNever(s.boss);
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
        fo: { frames: FAN, ms: FAN_MS },
        rb: { frames: RBK, ms: RBK_MS },
        // Every ability needs real frames: an empty pair makes
        // `Math.min(heroFrame, frames.length - 1)` index `frames[-1]`.
        rc: { frames: ROOT, ms: ROOT_MS },
        conv: { frames: CONV, ms: CONV_MS },
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
              // A zero-amount hit is the vanished whiff; a floating "0" would read
              // as a bug.
              const text = e.type === "damage" && e.amount === 0 ? "MISS" : String(e.amount);
              pushFloat(text, e.type === "dot" ? "#c9a4ff" : "#ffe9a8", r, c);
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

  /** Living targets in cycle order: Alert Storm by swarm column, Cascade by
   * node id (the pulse's ring order). Callers read only `.id`. */
  const livingByColumn = useCallback((s: BattleState): { id: number }[] => {
    if (s.boss.kind === CASCADE_ID) {
      return cascadeNodes(s.boss).filter((n) => n.alive);
    }
    if (s.boss.kind === "alert-storm") {
      return alertBats(s.boss)
        .filter((b) => b.alive)
        .sort((a, b) => SWARM[a.pos][1] - SWARM[b.pos][1]);
    }
    if (s.boss.kind === SILENT_FAILURE_ID) {
      // [0] while alive, [] when dead. The armor stays selectable while
      // vanished; battleReduce refuses the action.
      return livingTargets(s.boss).map((id) => ({ id }));
    }
    if (s.boss.kind === IMPOSTER_ID) {
      // [0,1,2] during CLONES, else [0].
      return imposterLivingTargets(s.boss).map((id) => ({ id }));
    }
    return assertNever(s.boss);
  }, []);

  /** Enter target mode. `cmd` is kept in `pendingCmd` for the confirm
   * sites; the nested menu has no flat index into `commands`. */
  const startTarget = useCallback(
    (cmd: AbilityCommand) => {
      setPendingCmd(cmd);
      const living = livingByColumn(stateRef.current.state);
      setCursorBat(living[0]?.id ?? null);
      setMode("target");
      props.playEnter();
    },
    [livingByColumn, props],
  );

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

  /** Sound and mode/commit handling for a `menuReduce` effect, shared by the
   * keyboard path and the row onClick so they stay in lockstep. */
  const applyEffect = useCallback(
    (effect: ReturnType<typeof menuReduce>["effect"]) => {
      switch (effect.type) {
        case "moved":
          props.playMove();
          break;
        case "descend":
          props.playEnter();
          break;
        case "ascend":
          props.playBack();
          break;
        case "pause":
          setMode("pause");
          props.playBack();
          break;
        case "blocked":
          props.playBack();
          break;
        case "cast":
          if (effect.cmd.needsTarget) startTarget(effect.cmd);
          else commit({ type: effect.cmd.id } as BattleAction);
          break;
        default:
          assertNever(effect);
      }
    },
    [props, startTarget, commit],
  );

  /** Keyboard entry point. Reads live values off `stateRef`, since the
   * keydown effect rarely resubscribes. */
  const applyMenuInput = useCallback(
    (input: MenuInput) => {
      const { menu: nextMenu, effect } = menuReduce(
        stateRef.current.menu,
        input,
        stateRef.current.commands,
        stateRef.current.state.hero.mp,
      );
      setMenu(nextMenu);
      applyEffect(effect);
    },
    [applyEffect],
  );

  const retry = useCallback(() => {
    const nextAttempt = stateRef.current.state.attempt + 1;
    let s = initBattle({ seed, attempt: nextAttempt, defeatedBosses, boss });
    setState(s);
    setShown(s);
    setFloats([]);
    setSwarmFx({});
    setHeroReel(null);
    setBanner("");
    setMode("menu");
    setMenu(initialMenuState);
    props.playEnter();
  }, [seed, defeatedBosses, boss, props]);

  // ---- boss banner (scene-owned copy) ----
  useEffect(() => {
    if (descend) {
      setBanner("");
      return;
    }
    setBanner(scene.banner(shown));
  }, [shown, descend, scene]);

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
        // ArrowLeft is `back` only inside a submenu, never an accidental pause.
        if (k === "ArrowUp" || k === "ArrowDown") {
          applyMenuInput(k === "ArrowUp" ? "up" : "down");
        } else if (k === "Enter" || k === " " || k === "ArrowRight") {
          applyMenuInput("confirm");
        } else if (k === "ArrowLeft") {
          if (stateRef.current.menu.level !== "top") applyMenuInput("back");
        } else if (k === "Escape" || k === "Backspace") {
          applyMenuInput("back");
        }
      } else if (m === "target") {
        if (k === "ArrowLeft" || k === "ArrowUp") cycleTarget(-1);
        else if (k === "ArrowRight" || k === "ArrowDown") cycleTarget(1);
        else if (k === "Enter" || k === " ") {
          const cmd = stateRef.current.pendingCmd;
          const target = stateRef.current.cursorBat;
          if (cmd && target !== null)
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
  }, [applyMenuInput, commit, cycleTarget, onForfeit, onVictory, props, retry]);

  // Cascade has no real/fake identity, so its plate sums the living chain's
  // HP and never masks. The switch is exhaustive with a never-typed default
  // so a new boss kind cannot fall silently into the Alert Storm shape.
  let revealBoss: boolean;
  let livingCount: number;
  let plateHp: { hp: number; maxHp: number };
  let cursorBatObj: Bat | undefined | null;
  let cursorNodeObj: CascadeNode | undefined | null;
  if (state.boss.kind === CASCADE_ID) {
    const nodes = cascadeNodes(state.boss);
    revealBoss = true;
    livingCount = nodes.filter((n) => n.alive).length;
    plateHp = nodes.reduce(
      (acc, n) => ({ hp: acc.hp + n.hp, maxHp: acc.maxHp + n.maxHp }),
      { hp: 0, maxHp: 0 },
    );
    cursorBatObj = null;
    cursorNodeObj = cursorBat !== null ? nodes.find((n) => n.id === cursorBat) : null;
  } else if (state.boss.kind === "alert-storm") {
    const bats = alertBats(state.boss);
    const real = bats.find((b) => b.real)!;
    revealBoss = real.marked || !real.alive;
    livingCount = bats.filter((b) => b.alive).length;
    plateHp = { hp: real.hp, maxHp: real.maxHp };
    cursorBatObj = cursorBat !== null ? bats.find((b) => b.id === cursorBat) : null;
    cursorNodeObj = null;
  } else if (state.boss.kind === SILENT_FAILURE_ID) {
    // HP always shown; VANISHED is a label concern (labelFor). Reuses
    // Cascade's cursorNodeObj because the display rule is identical; the
    // literal only satisfies CascadeNode's shape.
    revealBoss = true;
    livingCount = state.boss.hp > 0 ? 1 : 0;
    plateHp = { hp: state.boss.hp, maxHp: state.boss.maxHp };
    cursorBatObj = null;
    cursorNodeObj =
      cursorBat !== null
        ? { id: SF_TARGET_ID, hp: state.boss.hp, maxHp: state.boss.maxHp, alive: state.boss.hp > 0, marked: state.boss.marked }
        : null;
  } else if (state.boss.kind === IMPOSTER_ID) {
    // HP always shown: the puzzle is the phases. Clone slots have no HP, so
    // every slot reads the one boss entity through cursorNodeObj.
    revealBoss = true;
    livingCount = state.boss.hp > 0 ? 1 : 0;
    plateHp = { hp: state.boss.hp, maxHp: state.boss.maxHp };
    cursorBatObj = null;
    cursorNodeObj =
      cursorBat !== null
        ? { id: cursorBat, hp: state.boss.hp, maxHp: state.boss.maxHp, alive: state.boss.hp > 0, marked: state.boss.marked }
        : null;
  } else {
    assertNever(state.boss);
  }
  const cursorTargetId = cursorBatObj ? cursorBatObj.id : cursorNodeObj ? cursorNodeObj.id : null;
  const cursorRead = cursorBatObj
    ? cursorBatObj.marked || !cursorBatObj.alive
      ? `${cursorBatObj.hp}/${cursorBatObj.maxHp}`
      : "??/??"
    : cursorNodeObj
      ? `${cursorNodeObj.hp}/${cursorNodeObj.maxHp}` // no masking
      : "";
  // Only {left, top}: a call site spreads this into an inline style, where
  // width/height would set properties the element must not carry.
  const cellPx = (r: number, c: number) => {
    const rect = cellRect({ scale, stageW, stageH, stageLeft, stageTop }, r, c);
    return { left: rect.left, top: rect.top };
  };

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
      {mode === "target" && cursorTargetId !== null && (
        <div
          style={{
            position: "absolute",
            ...cellPx(...cursorCell(state, cursorTargetId)),
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

      {/* boss plate (scene-owned label/hidden-copy/footer) */}
      <div style={{ ...panel, position: "absolute", right: isMobile ? 10 : 30, top: isMobile ? 10 : 26, padding: "10px 14px", zIndex: 11 }}>
        <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".28em", color: "#ff9d8a" }}>
          {scene.plate.labelFor?.(state) ?? scene.plate.label}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          {revealBoss ? (
            bar(plateHp.hp, plateHp.maxHp, "linear-gradient(90deg,#e04838,#bd2421)", isMobile ? 110 : 150)
          ) : (
            <div style={{ fontFamily: MONO, fontSize: "12px", color: "#c9a4ff", letterSpacing: ".2em" }}>{scene.plate.hiddenLabel}</div>
          )}
        </div>
        <div style={{ fontFamily: MONO, fontSize: "10px", color: "#b9a8d8", marginTop: 5, letterSpacing: ".12em" }}>
          {scene.plate.footerFor?.(state) ?? scene.plate.footer(livingCount)}
        </div>
      </div>

      {/* exit control: above every overlay so it works mid-fight, paused, or beaten */}
      <div
        role="button"
        tabIndex={0}
        onClick={onExit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onExit();
          }
        }}
        style={{
          ...panel,
          position: "absolute",
          left: isMobile ? 10 : 30,
          top: isMobile ? 10 : 26,
          padding: "9px 14px",
          zIndex: 15,
          cursor: "pointer",
          fontFamily: MONO,
          fontSize: "11px",
          letterSpacing: ".2em",
          color: "#b9a8d8",
        }}
      >
        <span style={{ color: "#c9a4ff" }}>◂</span> {battleExit}
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
        <div
          data-cmd-panel
          data-cmd-level={menu.level}
          style={{
            ...panel,
            position: "absolute",
            left: isMobile ? 10 : 38,
            bottom: isMobile ? 10 : 38,
            width: isMobile ? "auto" : 262,
            right: isMobile ? 10 : "auto",
            zIndex: 11,
            overflow: "hidden",
            maxHeight: cmdPanelMaxHeight,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              // Tighter chrome on desktop; mobile keeps the roomier padding
              // because its height budget is never tight.
              padding: isMobile ? "11px 14px" : "7px 14px",
              borderBottom: "1px solid rgba(190,140,255,.2)",
              background: "linear-gradient(90deg, rgba(150,80,255,.14), transparent)",
              flex: "0 0 auto",
            }}
          >
            {/* "COMMAND" at the top level; in a submenu a "◂ TITLE" breadcrumb
                (the mobile back affordance) that ascends like ArrowLeft. */}
            <span
              role={mode === "menu" && view.title ? "button" : undefined}
              onClick={mode === "menu" && view.title ? () => applyMenuInput("back") : undefined}
              style={{
                fontFamily: MONO,
                fontSize: "10px",
                letterSpacing: ".3em",
                color: "#c9a4ff",
                cursor: mode === "menu" && view.title ? "pointer" : undefined,
              }}
            >
              {mode === "target" ? "TARGET" : view.title ? `◂ ${view.title}` : "COMMAND"}
            </span>
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".14em", color: "#8a7ba8" }}>TURN {state.turn}</span>
          </div>
          {mode === "target" ? (
            <div style={{ padding: "8px" }}>
              <div style={{ padding: "8px 10px", fontFamily: MONO, fontSize: "12px", color: "#d8ccf0", lineHeight: 1.6 }}>
                {isMobile ? "Tap the swarm to cycle · " : "←→ cycle · "}⏎ confirm · ESC back
              </div>
            </div>
          ) : (
            <div
              ref={scrollBodyRef}
              style={{ position: "relative", padding: "8px", overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}
            >
              {view.rows.map((row, i) => {
                const active = i === currentCursor;
                const afford = row.kind === "ability" ? state.hero.mp >= row.cmd.mp : !row.locked;
                return (
                  <div
                    key={row.kind === "ability" ? row.cmd.id : row.id}
                    ref={active ? activeRowRef : undefined}
                    role="button"
                    onClick={() => {
                      if (mode !== "menu" || descend) return;
                      const withCursor: MenuState = { ...menu, cursor: { ...menu.cursor, [menu.level]: i } };
                      const { menu: nextMenu, effect } = menuReduce(withCursor, "confirm", commands, state.hero.mp);
                      setMenu(nextMenu);
                      applyEffect(effect);
                    }}
                    onMouseEnter={() => setMenu((m) => ({ ...m, cursor: { ...m.cursor, [m.level]: i } }))}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: isMobile ? "10px 12px" : "6px 12px",
                      borderRadius: 9,
                      cursor: afford ? "pointer" : "default",
                      color: !afford ? "#5f5576" : active ? "#f2ecff" : "#c2b4de",
                      background: active ? "linear-gradient(90deg, rgba(160,90,255,.3), rgba(160,90,255,.05))" : "transparent",
                      border: active ? "1px solid rgba(200,150,255,.4)" : "1px solid transparent",
                      // Rows run a step smaller on desktop to fit the panel's
                      // height budget on short viewports; whatever still
                      // overflows scrolls.
                      fontSize: isMobile ? "14px" : "13px",
                      fontFamily: "'Sora',sans-serif",
                    }}
                  >
                    <span style={{ width: 12, color: active ? "#c9a4ff" : "transparent" }}>▸</span>
                    <span style={{ flex: 1 }}>{row.kind === "ability" ? row.cmd.label : row.label}</span>
                    <span style={{ fontFamily: MONO, fontSize: "11px", color: afford ? "#9f8fd0" : "#5f5576" }}>
                      {row.kind === "ability" ? (row.cmd.mp > 0 ? row.cmd.mp + " MP" : "FREE") : "▸"}
                    </span>
                  </div>
                );
              })}
              {/* Scroll affordance for overflowing rows. pointer-events none so it
                  never intercepts row clicks. */}
              {overflowing && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 22,
                    background: "linear-gradient(to bottom, rgba(20,14,32,0), rgba(14,10,26,.92))",
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 2,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: "12px", color: "#c9a4ff", textShadow: "0 0 6px #000" }}>▾</span>
                </div>
              )}
            </div>
          )}
          {mode === "menu" && (
            <div
              style={{
                padding: isMobile ? "7px 12px 3px" : "5px 12px 3px",
                fontFamily: MONO,
                // Footer font runs a step smaller on desktop, matching the
                // row compaction above.
                fontSize: isMobile ? "10px" : "9px",
                color: "#8a7ba8",
                letterSpacing: ".08em",
                borderTop: "1px solid rgba(190,140,255,.14)",
                marginTop: isMobile ? 4 : 2,
                marginLeft: 8,
                marginRight: 8,
                flex: "0 0 auto",
              }}
            >
              {footerDesc}
            </div>
          )}
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
            const cmd = stateRef.current.pendingCmd;
            const target = stateRef.current.cursorBat;
            if (cmd && target !== null) commit({ type: cmd.id, target } as BattleAction);
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
              {skipToWork}
            </div>
          </div>
        </div>
      )}

      {/* victory overlay (scene-owned copy) */}
      {mode === "victory" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 14, background: "radial-gradient(ellipse at 50% 40%, rgba(30,20,10,.5), rgba(6,4,12,.88))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...panel, border: "1px solid rgba(255,215,120,.45)", boxShadow: "0 0 60px rgba(255,190,80,.2), inset 0 0 0 1px rgba(255,255,255,.06)", padding: "30px 40px", textAlign: "center", maxWidth: 420 }}>
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".34em", color: "#ffd97a" }}>{scene.victoryCopy.eyebrow}</div>
            <div style={{ fontFamily: SERIF, fontSize: "26px", color: "#fdf6e3", margin: "12px 0 4px" }}>{scene.victoryCopy.title}</div>
            {state.events.some((e) => e.type === "forge") || state.defeatedBosses.includes(scene.id) ? (
              <div style={{ fontFamily: MONO, fontSize: "12px", color: "#ffe9b0", letterSpacing: ".12em", marginTop: 10, lineHeight: 2 }}>
                {state.events.some((e) => e.type === "forge") ? (
                  <>
                    {scene.victoryCopy.forgeLines.map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))}
                  </>
                ) : (
                  <>{scene.victoryCopy.rematchLine}<br /></>
                )}
              </div>
            ) : null}
            <div style={{ fontFamily: "'Sora',sans-serif", fontSize: "13px", color: "#b9a8d8", marginTop: 14 }}>
              {scene.victoryCopy.footer}
            </div>
            <div role="button" onClick={() => onVictory(stateRef.current.state)} style={{ cursor: "pointer", marginTop: 18, padding: "10px 18px", color: "#f2ecff", fontFamily: MONO, fontSize: "12px", letterSpacing: ".22em" }}>
              {scene.victoryCopy.cta}
            </div>
          </div>
        </div>
      )}

      {/* defeat overlay (scene-owned copy) */}
      {mode === "defeat" && (
        <div style={{ position: "absolute", inset: 0, zIndex: 14, background: "rgba(6,4,12,.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...panel, padding: "28px 38px", textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".3em", color: "#ff9d8a" }}>{scene.defeatCopy.eyebrow}</div>
            <div style={{ fontFamily: SERIF, fontSize: "22px", color: "#eee6f6", margin: "10px 0 4px" }}>{scene.defeatCopy.title}</div>
            <div role="button" onClick={retry} style={{ cursor: "pointer", marginTop: 16, padding: "10px 18px", color: "#f2ecff", fontFamily: MONO, fontSize: "12px", letterSpacing: ".2em" }}>
              {scene.defeatCopy.retryCta}
            </div>
            <div role="button" onClick={onForfeit} style={{ cursor: "pointer", padding: "8px 18px", color: "#b9a8d8", fontFamily: "'Sora',sans-serif", fontSize: "13px" }}>
              {scene.defeatCopy.leaveCta}
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
