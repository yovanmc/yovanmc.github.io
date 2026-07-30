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
import { commandsForKit } from "./abilities";
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

/**
 * M6 PR-1b task 2/4: `BattleState.boss` is a discriminated union (Cascade
 * joined Alert Storm). This narrows to Alert Storm's own bat list for the
 * type checker without changing runtime behavior when the current fight
 * isn't Alert Storm — the same accessor-path carve as bosses/alertStorm.ts's
 * own `bats()` helper. Cascade's equivalent (`cascadeNodes` below) sits
 * alongside it; every targeting/float/plate helper below branches on
 * `boss.kind` rather than assuming Alert Storm (M6 PR-1b task 5 — the Cascade
 * fight is now reachable through the FIGHT chooser, so this shell must not
 * crash against it).
 */
function alertBats(boss: BossState): Bat[] {
  if (boss.kind === "alert-storm") return boss.bats;
  if (boss.kind === CASCADE_ID) return [];
  if (boss.kind === SILENT_FAILURE_ID) return [];
  // Imposter has no bat list of its own (M6 PR-3 task 6) — same permanent
  // empty-array contribution Silent Failure and Cascade each make here.
  if (boss.kind === IMPOSTER_ID) return [];
  return assertNever(boss);
}

function cascadeNodes(boss: BossState): CascadeNode[] {
  if (boss.kind === CASCADE_ID) return boss.nodes;
  if (boss.kind === "alert-storm") return [];
  if (boss.kind === SILENT_FAILURE_ID) return [];
  // Imposter has no node list of its own (M6 PR-3 task 6) — same permanent
  // empty-array contribution Silent Failure and Alert Storm each make here.
  if (boss.kind === IMPOSTER_ID) return [];
  return assertNever(boss);
}

/**
 * M6 PR-2 task 6 (D1, pass-2 J4): the Silent Failure's single static on-stage
 * position, derived from `PIECES` (bossSilentFailure.js's armor-piece boxes,
 * the same generated data scenes/silentFailure.ts's mote overlay reads) so
 * this can't silently drift from the actual art. Unlike Cascade's six
 * per-node positions (`nodeBox`), the armor never moves, so a single
 * module-level bounding box is enough — no per-frame lookup needed.
 */
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

// M6 PR-2 task 6b: UiMode's literal set is identical to sceneGate.ts's
// ComposeGateMode by construction (both name every state this component's
// own `mode` can hold) — importing rather than re-declaring keeps the
// predicate's input type and this component's actual state in lockstep, so
// a future mode addition here can't silently desync from the gate.
type UiMode = ComposeGateMode;

interface Props {
  seed: number;
  attempt?: number;
  /** `boss=` capture key / FIGHT selection, forwarded straight to
   * `initBattle` (M6 PR-1b task 5 — `App.tsx`'s `battleBoot.boss` flows in
   * here). Undefined falls back to Alert Storm, same as `initBattle` itself. */
  boss?: string;
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

/** Timeline step: at +ms from action start, do fn. */
interface Step {
  at: number;
  fn: () => void;
}

let floatSeq = 1;

export default function BattleScene(props: Props) {
  const { seed, attempt = 1, boss, replayActions, defeatedBosses, onVictory, onForfeit, vw, vh, isMobile } = props;

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
  const [cmdIdx, setCmdIdx] = useState(0);
  const [cursorBat, setCursorBat] = useState<number | null>(null);
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [flutter, setFlutter] = useState(0);
  const [swarmFx, setSwarmFx] = useState<{ jitter?: boolean; ripple?: number; fall?: number; dither?: number }>({});
  const [heroReel, setHeroReel] = useState<{ frames: Grid[]; ms: number[] } | null>(null);
  const [heroFrame, setHeroFrame] = useState(0);
  const [banner, setBanner] = useState("");
  const [descend, setDescend] = useState(true);

  // ---- boss scene module + kit-derived command menu (M6 §Scene generalization) ----
  const scene = sceneFor(state.boss.kind);
  const commands = useMemo(
    () => commandsForKit(deriveKit(state.defeatedBosses)),
    [state.defeatedBosses],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offRef = useRef<HTMLCanvasElement | null>(null);
  const timers = useRef<number[]>([]);
  const stateRef = useRef({ mode, cmdIdx, cursorBat, state, shown, commands });
  stateRef.current = { mode, cmdIdx, cursorBat, state, shown, commands };

  // M7 PR-B task B5: the COMMAND panel is now height-clamped and its ability
  // list scrolls (see the `data-cmd-panel` block below), so the arrow-key
  // cursor (`cmdIdx`, wrapping via `(i + dir + len) % len` above) can move
  // outside the visible scroll area. Keep the active row in view on every
  // cursor move, including the wrap.
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [cmdIdx]);

  // ---- geometry: contain-fit desktop, width-fit mobile (plan §Architecture 3) ----
  // M7 PR-B task B3: verbatim-ported into src/battle/layout.ts (a pure,
  // covered module — this .tsx file is not matched by the coverage globs).
  // Same useMemo wrapper, same dependency array; only the body moved.
  const { scale, stageW, stageH, stageLeft, stageTop } = useMemo(
    () => stageMetrics(vw, vh, isMobile),
    [vw, vh, isMobile],
  );

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

    // M6 PR-3 task 6 (E9): `arenaFor?.(shown.boss)` reads `shown` (the
    // animation-lagged copy), not the live `state` — so the stage-3 PURE
    // station is what's on screen during the Imposter's death-animation
    // window (`shouldComposeBoss` below keeps the boss layer alive through
    // it). Shipped modules don't implement `arenaFor`, so their `?? scene.arena`
    // fallback keeps their output byte-identical.
    const g = (scene.arenaFor?.(shown.boss) ?? scene.arena)[flutter].map((row) => row.slice());
    const screaming = isScreamTurn(shown) && shown.status === "active";
    // M6 PR-2 task 6b (D5a — owner-ruled): gate on `mode`, not `shown.status`.
    // `shown.status` flips to "victory" at the very first animation step
    // after a killing blow, BEFORE any death-escalation fx step fires and
    // well before the victory overlay itself takes over — the old gate blew
    // out the boss layer at the instant of impact and left the arena empty
    // for the whole death-animation window (SIL_DIE, Alert Storm's
    // fall/dither, Cascade's CAS_DIE all authored, none ever rendering).
    // `mode` stays "anim" through that entire window and only becomes
    // "victory" once the overlay is actually up, so the boss layer now keeps
    // composing (still showing `shown.boss`, whose hp/phase already reflect
    // the kill, feeding composeBoss's death-frame selection) right up to
    // that point.
    if (shouldComposeBoss({ descend, mode })) {
      const bossGrid = scene.composeBoss(shown.boss, screaming, flutter, swarmFx);
      // M6 PR-3 task 6 (E4): stamp at the boss module's own `stampOrigin`
      // when it implements one (the Imposter's leftward clone spread),
      // falling back to the bare `BOSS_AT` constant otherwise — shipped
      // modules don't implement this, so their stamp position is untouched.
      const bossOrigin = scene.stampOrigin?.(shown.boss) ?? BOSS_AT;
      stampGrid(g, bossGrid, bossOrigin[0], bossOrigin[1]);
    }
    // M6 PR-3 task 6: gold-hair remap "on every reel while active" (N10 —
    // Conviction doubles every other ability's effects AND recolors the
    // hero, persisting once cast) applies uniformly to whatever frame was
    // already selected, idle or mid-cast. `hd` matches the idle frames'
    // own headO exactly (IDLE[0]/[1] build at headO 0/1 — see
    // heroBattle.js's buildFrame); active-reel frames use varying headO
    // internally with no per-frame metadata exported, so `flutter` is a
    // deliberate approximation there (cosmetic only, no test can assert
    // pixel-perfect hair alignment against every reel frame).
    // The DEBUFF cue (visual only, grants nothing mechanically, M5
    // mark-chevron precedent) shows only at idle (no active reel) so it
    // never fights an ability animation for the same frame slot.
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

  // ---- action sequencing ----
  const schedule = useCallback((steps: Step[]) => {
    for (const s of steps) timers.current.push(window.setTimeout(s.fn, s.at));
  }, []);

  const pushFloat = useCallback((text: string, color: string, r: number, c: number) => {
    setFloats((fs) => [...fs, { id: floatSeq++, text, color, r, c, born: performance.now() }]);
  }, []);

  /** Float-position (damage/dot/mark numbers) and target-cursor anchor for a
   * given target id. Cascade arm (M6 PR-1b task 5): NODES coordinates come
   * from the generated bossCascade.js NODES export, same BOSS_AT anchor the
   * swarm uses; `nodeBox` (scenes/cascadeCompose.ts) gives the node's actual
   * on-stage footprint so the number lands centered above the node box
   * regardless of which node it is (node 0's box is taller/wider — the "big"
   * head node). Bob is irrelevant here (a float/cursor position, not a
   * render pass), so this always reads the bob-0 box. */
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
      // M6 PR-2 task 6: the real on-stage footprint — the armor's own
      // bounding box (SF_ARMOR_BOX, derived from PIECES), top edge, mid
      // column, same "float above the box, centered" convention Cascade
      // uses against `nodeBox`. This is the D1/pass-2 J4 fix: batCell now
      // returns a real, art-derived position instead of the BOSS_AT stopgap.
      return [BOSS_AT[0] + SF_ARMOR_BOX.top, BOSS_AT[1] + SF_ARMOR_MID_COL];
    }
    if (s.boss.kind === IMPOSTER_ID) {
      // M6 PR-3 task 6 (E4): the shared-origin contract — this computes
      // from `imposterBatAnchor`, which internally keys off the exact same
      // `stampOrigin` function `scenes/imposter.ts`'s `composeBoss` stamps
      // its canvas at, so the float/cursor never targets art that isn't
      // there. Three real homes during CLONES, one per slot.
      return imposterBatAnchor(s.boss, targetId);
    }
    return assertNever(s.boss);
  }, []);

  /** Target-cursor arrow anchor — a separate offset from `batCell`'s float
   * placement (the arrow sits closer above the sprite than the damage
   * number). Alert Storm's formula is byte-identical to what shipped before
   * task 5; the Cascade arm mirrors it against `nodeBox`. */
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
      // M6 PR-2 task 6: the D1/pass-2 J4 fix — the cursor arrow now sits
      // above the armor's real bounding box (same 5-row/2-col arrow offset
      // Cascade's arm uses against its own box), instead of the BOSS_AT
      // stopgap task 4 shipped. Per D2 this is the fight's ONE cursor home,
      // vanished or not — the boss stays selectable the whole fight.
      return [BOSS_AT[0] + SF_ARMOR_BOX.top - 5, BOSS_AT[1] + SF_ARMOR_MID_COL - 2];
    }
    if (s.boss.kind === IMPOSTER_ID) {
      // M6 PR-3 task 6 (E4): same shared-origin contract as `batCell` above,
      // via `imposterCursorAnchor` (a fixed offset from the float anchor).
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
        // M6 PR-3 task 6: real reels, not the task-4 compile-only stub — E5
        // measured ROOT/ROOT_MS and CONV/CONV_MS as already exported from
        // canon heroBattle.js (wiring, not extraction). This was a LIVE
        // CRASH PATH once the Imposter became bootable (task 5): the stub's
        // empty frames/ms made `Math.min(heroFrame, frames.length - 1)`
        // evaluate to -1 and index `frames[-1]`.
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
              // M6 PR-2 task 6 (D2, pass-2 J7): a zero-amount damage event is
              // the vanished-phase attack whiff (D2's signed rule — turn
              // consumed, 0 damage, no +1 MP) — floating a literal "0" would
              // read as a bug, not a deliberate miss.
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

  /** Living targets in cycle order. Alert Storm cycles left-to-right by swarm
   * column; Cascade has no columns to sort by, so cycling by node id order is
   * the ring order the pulse itself travels (M6 PR-1b task 5). Only `.id` is
   * read by any caller below, so the two boss kinds share this return shape. */
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
      // Single-entity case: livingTargets is [0] while alive, [] when dead —
      // correct as-is (D2 keeps the armor selectable whether embodied or
      // vanished; only battleReduce refuses the action).
      return livingTargets(s.boss).map((id) => ({ id }));
    }
    if (s.boss.kind === IMPOSTER_ID) {
      // M6 PR-3 task 6: [0,1,2] during CLONES (three targetable slots, per
      // E8's targeting/rendering overlay), else just the single entity's
      // [0] — same shape SF's own arm above returns.
      return imposterLivingTargets(s.boss).map((id) => ({ id }));
    }
    return assertNever(s.boss);
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
    let s = initBattle({ seed, attempt: nextAttempt, defeatedBosses, boss });
    setState(s);
    setShown(s);
    setFloats([]);
    setSwarmFx({});
    setHeroReel(null);
    setBanner("");
    setMode("menu");
    setCmdIdx(0);
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
        if (k === "ArrowUp" || k === "ArrowDown") {
          const dir = k === "ArrowUp" ? -1 : 1;
          const len = stateRef.current.commands.length;
          setCmdIdx((i) => (i + dir + len) % len);
          props.playMove();
        } else if (k === "Enter" || k === " " || k === "ArrowRight") {
          const cmd = stateRef.current.commands[stateRef.current.cmdIdx];
          if (stateRef.current.state.hero.mp < cmd.mp) {
            props.playBack();
            return;
          }
          if (cmd.needsTarget) startTarget();
          else commit({ type: cmd.id } as BattleAction);
        } else if (k === "Escape" || k === "Backspace") {
          setMode("pause");
          props.playBack();
        }
      } else if (m === "target") {
        if (k === "ArrowLeft" || k === "ArrowUp") cycleTarget(-1);
        else if (k === "ArrowRight" || k === "ArrowDown") cycleTarget(1);
        else if (k === "Enter" || k === " ") {
          const cmd = stateRef.current.commands[stateRef.current.cmdIdx];
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
  // M6 PR-1b task 5: Cascade has no single "real" boss entity to mask/reveal
  // (six independent nodes, no fake/real identity) — the plate bar sums the
  // living chain's HP/maxHp in place of Alert Storm's reveal-on-mark rule,
  // and it never masks (plan §Boss 2 "Targeting": nodes show real HP always).
  // M6 PR-2 task 1 (D1, pass-1 H2): exhaustive dispatch over boss.kind with a
  // never-typed default, replacing the old isCascadeFight boolean shortcut —
  // that shortcut let a third boss kind silently fall into the "alert storm"
  // shape below with no compile error (measured: stubbing a third BossState
  // member produced ZERO errors here before this refactor).
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
    // Single-entity case: HP always shown (plan §Scene generalization — the
    // VANISHED/embodied swap is a plate-LABEL concern, D3's labelFor, not
    // this HP-bar-vs-hiddenLabel reveal flag).
    // M6 PR-2 task 6 (D1, pass-2 J4 fix): cursorNodeObj now carries a real
    // object instead of the task-4 stopgap's unconditional null — reusing
    // Cascade's variable/branch rather than adding a third one, because SF's
    // display rule is IDENTICAL to Cascade's: no masking, HP shown as-is,
    // regardless of alive/marked (cursorRead's cascade branch never checks
    // either field). The literal below satisfies CascadeNode's shape
    // structurally; it isn't a real cascade node, just the same read
    // contract. Per D2 the boss stays the cursor's one selectable target for
    // the whole fight, embodied or vanished.
    revealBoss = true;
    livingCount = state.boss.hp > 0 ? 1 : 0;
    plateHp = { hp: state.boss.hp, maxHp: state.boss.maxHp };
    cursorBatObj = null;
    cursorNodeObj =
      cursorBat !== null
        ? { id: SF_TARGET_ID, hp: state.boss.hp, maxHp: state.boss.maxHp, alive: state.boss.hp > 0, marked: state.boss.marked }
        : null;
  } else if (state.boss.kind === IMPOSTER_ID) {
    // M6 PR-3 task 6: real HP shown always (plan §Scene generalization —
    // "the puzzle is its phases, not its HP", same as Cascade/SF's no-mask
    // rule). cursorNodeObj reuses Cascade/SF's structural shape (only `.id`
    // is ever read below) — `cursorBat` during CLONES is the clone slot
    // (0/1/2), otherwise always 0; every slot reads the SAME single boss
    // entity's hp/maxHp/marked, since clone slots have no HP of their own
    // (E8: they're a targeting/rendering overlay only).
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
      ? `${cursorNodeObj.hp}/${cursorNodeObj.maxHp}` // no masking (plan §Boss 2 "Targeting")
      : "";
  // M7 PR-B task B3: verbatim-ported into layout.ts's cellRect. Returns only
  // {left, top} (not the full Rect) — a call site below spreads this whole
  // object into an inline style (`...cellPx(...)`), so adding width/height
  // here would set CSS properties that were never set before, a real
  // behaviour change this task must not make.
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
          style={{
            ...panel,
            position: "absolute",
            left: isMobile ? 10 : 38,
            bottom: isMobile ? 10 : 38,
            width: isMobile ? "auto" : 262,
            right: isMobile ? 10 : "auto",
            zIndex: 11,
            overflow: "hidden",
            // M7 PR-B task B5 (owner-ruled Option C): the panel's UNCLAMPED
            // content (362px measured pre-fix) clips the leftmost clone's
            // foot at every swept viewport, worst at 800x600 where 151px is
            // the binding threshold. A flat 150 clears every viewport
            // (provable, not responsive) — see layout.test.ts's re-enabled
            // invariant. The ability list scrolls inside; header/footer stay
            // pinned via the flex children below.
            maxHeight: 150,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderBottom: "1px solid rgba(190,140,255,.2)",
              background: "linear-gradient(90deg, rgba(150,80,255,.14), transparent)",
              flex: "0 0 auto",
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".3em", color: "#c9a4ff" }}>
              {mode === "target" ? "TARGET" : "COMMAND"}
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
            <div style={{ padding: "8px", overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>
              {commands.map((c, i) => {
                const active = i === cmdIdx;
                const afford = state.hero.mp >= c.mp;
                return (
                  <div
                    key={c.id}
                    ref={active ? activeRowRef : undefined}
                    role="button"
                    onClick={() => {
                      if (mode !== "menu" || descend) return;
                      setCmdIdx(i);
                      if (!afford) {
                        props.playBack();
                        return;
                      }
                      if (c.needsTarget) startTarget();
                      else commit({ type: c.id } as BattleAction);
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
              })}
            </div>
          )}
          {mode === "menu" && (
            <div
              style={{
                padding: "7px 12px 3px",
                fontFamily: MONO,
                fontSize: "10px",
                color: "#8a7ba8",
                letterSpacing: ".08em",
                borderTop: "1px solid rgba(190,140,255,.14)",
                marginTop: 4,
                flex: "0 0 auto",
              }}
            >
              {commands[cmdIdx].desc}
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
            const cmd = stateRef.current.commands[stateRef.current.cmdIdx];
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
