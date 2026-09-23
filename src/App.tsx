import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CATS } from "./content";
import type { BattleAction, BattleState } from "./battle/engine";
import { parseActions, parseBoss, parseDefeatedBosses } from "./battle/bootParams";
import { deriveFightChoice, nextUndefeatedBoss, type FightRow } from "./battle/fight";
import { BOSS_NAMES } from "./battle/rushOrder";
import { clearProgress, readProgress, writeProgress, type ProgressStore } from "./progress/store";
import { UNLOCK_BY_BOSS, guardingBoss, isGateable, unlockedSlugs } from "./progress/unlocks";
import { Station } from "./components/Station";
import { stationVisible } from "./site/stationVisible";
import { Atmosphere } from "./components/Atmosphere";
import { CaseStudyPage, type PageRef } from "./components/CaseStudyPage";
import { DiveIntro, type IntroTarget } from "./components/DiveIntro";
import { Landing } from "./components/Landing";
import { LockedCaseStudy } from "./components/LockedCaseStudy";
import { BrowseIndex } from "./components/BrowseIndex";
import { BuildPage } from "./components/BuildPage";
import { pathForPage, pageForPath, rowHref } from "./router";
import { isNativeActivationTarget } from "./site/nativeActivate";
import { shouldRouteInApp } from "./site/linkClick";
import { canonicalPath, phaseForPath } from "./site/phaseForPath";
import { sealedLine, skipToContent } from "./landingCopy";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";
const MOBILE_BREAKPOINT = 760;

/** Aria-label of the seal glyph on a locked item, not visible text. Locked
 * items keep title, meta and stat; body, tags and primary link stay sealed. */
const SEAL_LABEL = "Sealed";

/**
 * Top-level phases. Root entry lands on the gate; the dive cinematic plays on
 * the first "Enter the game" per page load, not on every visit.
 * - gate: the fork and site entry. No hero until the dive brings him.
 * - intro: the cinematic; skip lands in play.
 * - play: the RPG command menu.
 * - browse: the flat portfolio index; case-study pages open over it.
 * - build: the engineering page. Routes like browse (own path, own shell,
 *   ESC/Backspace back to the gate).
 */
type Phase = "intro" | "gate" | "play" | "browse" | "build" | "battle";

type Col = "root" | "sub" | "fight";

/** Lazy so the battle chunk stays out of the landing bundle. */
const BattleScene = lazy(() => import("./battle/BattleScene"));

interface BattleBoot {
  seed: number;
  attempt: number;
  actions?: BattleAction[];
  /** Dev capture keys, validated in bootParams.ts. Set only by decideBoot's
   * capture-key path. `defeatedBosses` seeds the `defeatedBosses` state. */
  boss?: string;
  defeatedBosses?: string[];
}

interface BootState {
  phase: Phase;
  page: PageRef | null;
  freezeAt?: number;
  battle?: BattleBoot;
}

/** Even reading `window.localStorage` can throw: some privacy settings throw
 * on the getter itself, not only on method calls. */
function progressStore(): ProgressStore | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function decideBoot(): BootState {
  const loc = window.location;
  const dev = import.meta.env.DEV || loc.hostname === "localhost";
  let path = loc.pathname;

  // Must run before the pageForPath early returns below, or
  // /work/curio/?resetProgress=1 would silently do nothing.
  if (dev) {
    const resetParams = new URLSearchParams(loc.search);
    if (resetParams.get("resetProgress") === "1") clearProgress(progressStore());
  }

  // 404.html stashes unknown deep-link paths; a restored deep link bypasses the
  // intro, same as a direct one.
  try {
    const stash = sessionStorage.getItem("dl");
    if (stash) {
      sessionStorage.removeItem("dl");
      const stashPath = stash.split("?")[0];
      const stashPhase = pageForPath(stashPath) ? "browse" : phaseForPath(stashPath); // phaseForPath also resolves "build"
      if (stashPhase) {
        // Show the canonical path, so an old /browse/ link lands on /work/.
        window.history.replaceState({ phase: stashPhase }, "", canonicalPath(stashPath) + stash.slice(stashPath.length));
        path = stashPath;
      }
    }
  } catch {
    /* sessionStorage unavailable — fall through to the normal table */
  }

  const initial = pageForPath(path);
  if (initial) return { phase: "browse", page: initial }; // pageForPath never resolves a "build" page
  const pathPhase = phaseForPath(path);
  if (pathPhase) {
    // A legacy path served directly (no 404 stash) is rewritten too.
    if (canonicalPath(path) !== path) window.history.replaceState({ phase: pathPhase }, "", canonicalPath(path) + loc.search);
    return { phase: pathPhase, page: null };
  }

  if (dev) {
    const params = new URLSearchParams(loc.search);
    const p = params.get("phase");
    if (p === "gate" || p === "play" || p === "browse" || p === "build") return { phase: p, page: null };
    if (p === "battle") {
      const rawDefeated = params.get("defeated");
      const defeated = parseDefeatedBosses(rawDefeated);
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
          // Absent param stays undefined, distinct from an explicit empty
          // list, so the boot falls back to stored progress.
          ...(rawDefeated !== null ? { defeatedBosses: defeated.value } : {}),
        },
      };
    }
    const t = params.get("t");
    if (t !== null) return { phase: "intro", page: null, freezeAt: parseInt(t, 10) || 0 };
  }
  return { phase: "gate", page: null };
}

/** Lazily created WebAudio blip synth (respects the autoplay policy). */
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
  // A dev boot's explicit `defeated=` wins over stored progress. Lazy
  // initializer so storage is not re-read on every render.
  const bootBattle = boot.current.battle;
  const [defeatedBosses, setDefeatedBosses] = useState<string[]>(() =>
    bootBattle?.defeatedBosses !== undefined ? bootBattle.defeatedBosses : readProgress(progressStore()),
  );
  // The dive has run this page load: later play entries skip to the menu, and
  // the hero stands at the station only after he has dived.
  const [hasDived, setHasDived] = useState(false);
  // Slugs revealed with "read it anyway". Session-only by design, never
  // persisted, so a reload re-seals everything.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const revealItem = useCallback((slug: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  }, []);
  const [col, setCol] = useState<Col>("root");
  const [rootIdx, setRootIdx] = useState(0);
  const [subIdx, setSubIdx] = useState(0);
  const [page, setPage] = useState<PageRef | null>(boot.current.page);
  const [toast, setToast] = useState("");
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const [h, setH] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  // Opens only when deriveFightChoice offers more than one boss; otherwise
  // `enterFight` launches directly.
  const [fightChooserOpen, setFightChooserOpen] = useState(false);
  const [fightChooserIdx, setFightChooserIdx] = useState(0);

  const snd = useBlips();
  const toastTimer = useRef<number | undefined>(undefined);
  /** Which surface opened the current page, deciding where closing it lands.
   * Never "build": pageForPath never resolves a build path, and a page opened
   * from build records "browse". */
  const pageOrigin = useRef<"play" | "browse">(boot.current.page ? "browse" : "play");

  const booted = phase === "play";

  const fightChoice = deriveFightChoice(defeatedBosses);
  const fightRows: FightRow[] = fightChoice.mode === "chooser" ? fightChoice.rows : [];

  // Live mirror of state so the keydown listener reads current values.
  const stateRef = useRef({ phase, col, rootIdx, subIdx, page, hasDived, fightChooserOpen, fightChooserIdx, fightRows, defeatedBosses });
  stateRef.current = { phase, col, rootIdx, subIdx, page, hasDived, fightChooserOpen, fightChooserIdx, fightRows, defeatedBosses };

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

  // Phase transitions replace the current history entry (never push), so Back
  // only walks pages and popstate to "/" can't replay the intro. Battle records
  // "play": a dead fight must never resurrect via Forward/bfcache.
  const goPhase = useCallback((p: Exclude<Phase, "intro">) => {
    setPhase(p);
    const stored = p === "battle" ? "play" : p;
    const path = p === "build" ? "/build/" : p === "browse" ? "/work/" : "/";
    if (window.location.pathname !== path || (window.history.state?.phase ?? null) !== stored) {
      window.history.replaceState({ phase: stored }, "", path);
    }
  }, []);

  // Declared before the keyboard effect: its dependency array reads these
  // during render, so they must be initialized here (TDZ).
  /** Boots the chosen boss straight into battle. Fresh seed every fight. */
  const launchFight = useCallback(
    (bossId: string) => {
      setBattleBoot({ seed: (Math.random() * 2147483646) | 0 || 1, attempt: 1, boss: bossId });
      goPhase("battle");
      snd.enter();
    },
    [goPhase, snd],
  );

  /** Launches directly when `deriveFightChoice` offers one boss, otherwise
   * opens the chooser. */
  const enterFight = useCallback(() => {
    snd.resume();
    if (fightChoice.mode === "direct") {
      launchFight(fightChoice.boss);
    } else {
      setFightChooserIdx(0);
      setFightChooserOpen(true);
      snd.enter();
    }
  }, [snd, fightChoice, launchFight]);

  const enterPlay = useCallback(() => {
    snd.resume();
    setCol("root");
    setRootIdx(0);
    setSubIdx(0);
    if (!stateRef.current.hasDived) {
      // First play entry this page load runs the cinematic; warm the battle chunk
      // now so touchdown never shows a loading flash.
      void import("./battle/BattleScene");
      setPhase("intro");
      setIntroOn(true);
      snd.enter();
      return;
    }
    goPhase("play");
    snd.enter();
  }, [snd, goPhase]);

  /** Splash Continue: lands in the play menu with the dive skipped. Marks
   * hasDived like the dive's own handoff, so later play entries skip it too. */
  const continuePlay = useCallback(() => {
    snd.resume();
    setCol("root");
    setRootIdx(0);
    setSubIdx(0);
    setHasDived(true);
    goPhase("play");
    snd.enter();
  }, [snd, goPhase]);

  const enterBrowse = useCallback(() => {
    snd.resume();
    goPhase("browse"); // "build" is entered through the render site's onBuild
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
      // A page reached from build closes back to /work/, same as from browse.
      pageOrigin.current =
        stateRef.current.phase === "browse" || stateRef.current.phase === "build" ? "browse" : "play";
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
    // pageOrigin is never "build" (see openPage), so /work/ covers it.
    const home = pageOrigin.current === "browse" ? "/work/" : "/";
    if (window.location.pathname !== home)
      window.history.pushState({ phase: pageOrigin.current }, "", home);
    if (pageOrigin.current === "browse" && stateRef.current.phase !== "browse") setPhase("browse"); // origin is never "build"
    snd.back();
  }, [snd]);

  const back = useCallback(() => {
    snd.resume();
    const s = stateRef.current;
    if (s.fightChooserOpen) {
      setFightChooserOpen(false);
      snd.back();
    } else if (s.page) {
      closePage();
    } else if (s.phase === "browse" || s.phase === "build") {
      goPhase("gate");
      snd.back();
    } else if (s.col === "sub" || s.col === "fight") {
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
        // Locked items still open: the render-boundary gate (`pageLocked`)
        // decides what shows, including for a popstate-restored page.
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

  // Keyboard and resize, gated per phase.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      // Intro, gate and battle own their inputs. Without the battle arm, Enter
      // here would open a case-study page over the fight.
      if (s.phase === "intro" || s.phase === "battle" || (s.phase === "gate" && !s.page)) return;
      const k = e.key;
      // A focused anchor/button/control owns its Enter/Space activation: step
      // aside so the browser handles it without a double fire. No ancestor walk:
      // play command-menu rows are non-focusable divs.
      if (isNativeActivationTarget(document.activeElement) && (k === "Enter" || k === " ")) return;
      const handled = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Escape", "Backspace", " "];
      if (handled.includes(k)) e.preventDefault();
      snd.resume();

      // The open chooser owns all input: arrows cycle, Enter launches,
      // Esc/Backspace close back to the FIGHT row.
      if (s.fightChooserOpen) {
        if (k === "ArrowUp" || k === "ArrowDown") {
          const dir = k === "ArrowUp" ? -1 : 1;
          const n = s.fightRows.length;
          if (n > 0) setFightChooserIdx((i) => (i + dir + n) % n);
          snd.move();
        } else if (k === "ArrowRight" || k === "Enter" || k === " ") {
          const row = s.fightRows[s.fightChooserIdx];
          if (row) {
            setFightChooserOpen(false);
            launchFight(row.boss);
          }
        } else if (k === "ArrowLeft" || k === "Escape" || k === "Backspace") {
          back();
        }
        return;
      }
      if (s.page) {
        if (k === "Escape" || k === "ArrowLeft" || k === "Backspace") back();
        return;
      }
      if (s.phase === "browse" || s.phase === "build") {
        if (k === "Escape" || k === "Backspace") back();
        return;
      }
      const c = CATS[s.rootIdx];
      if (k === "ArrowUp" || k === "ArrowDown") {
        const dir = k === "ArrowUp" ? -1 : 1;
        if (s.col === "sub") {
          const n = c.items.length;
          setSub((s.subIdx + dir + n) % n);
        } else if (s.col === "fight") {
          // FIGHT sits one step past either end of the root list, so a further
          // press in the same direction continues into CATS's own wrap.
          setRoot(dir === 1 ? 0 : CATS.length - 1);
        } else {
          const atTop = s.rootIdx === 0;
          const atBottom = s.rootIdx === CATS.length - 1;
          if ((dir === -1 && atTop) || (dir === 1 && atBottom)) {
            setCol("fight");
            snd.move();
          } else {
            setRoot(s.rootIdx + dir);
          }
        }
      } else if (k === "ArrowRight" || k === "Enter" || k === " ") {
        if (s.col === "fight") enterFight();
        else if (s.col === "root") enter();
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
  }, [snd, back, enter, activate, setRoot, setSub, enterFight, launchFight]);

  // Back/Forward. "/" never resolves to intro here.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const path = window.location.pathname;
      const statePhase: Phase | undefined = e.state?.phase;
      const p = pageForPath(path);
      if (p) {
        const ph = statePhase === "play" ? "play" : "browse"; // pages never open from build
        pageOrigin.current = ph;
        setPhase(ph);
        setPage(p);
        setRootIdx(p.ri);
        setSubIdx(p.si);
      } else {
        const pathPhase = phaseForPath(path);
        if (pathPhase) {
          setPage(null);
          setPhase(pathPhase);
          return;
        }
        setPage(null);
        // battle and intro are never restorable; both map to safe ground
        setPhase(
          statePhase && statePhase !== "intro" && statePhase !== "battle" ? statePhase : "gate",
        );
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // The dive lands in battle, on the visitor's next undefeated boss (Alert
  // Storm when fresh). A visitor who has beaten every implemented boss skips
  // the battle and lands in the menu world. Reads stateRef because this
  // callback is created once on mount; a closed-over `defeatedBosses` would
  // stay frozen at its mount-time value.
  const onIntroHandoff = useCallback(
    (_target: IntroTarget) => {
      setHasDived(true);
      const nextBoss = nextUndefeatedBoss(stateRef.current.defeatedBosses);
      if (nextBoss === undefined) {
        goPhase("play");
        return;
      }
      setBattleBoot({ seed: (Math.random() * 2147483646) | 0 || 1, attempt: 1, boss: nextBoss });
      goPhase("battle");
    },
    [goPhase],
  );
  const onIntroDone = useCallback(() => setIntroOn(false), []);

  const onBattleVictory = useCallback(
    (final: BattleState) => {
      // From stateRef, not state: this callback is created once on mount, so
      // a closed-over `defeatedBosses` stays [] forever and a rematch would
      // fire a spurious unlock toast.
      const prevDefeated = stateRef.current.defeatedBosses;
      const newlyDefeated = final.defeatedBosses.filter((id) => !prevDefeated.includes(id));
      setDefeatedBosses(final.defeatedBosses);
      // The only write site. Persist now so a reload never loses a win.
      writeProgress(progressStore(), final.defeatedBosses);
      setBattleBoot(null);
      setCol("root");
      goPhase("play");
      if (newlyDefeated.length > 0) {
        const titles = newlyDefeated
          .map((bossId) => UNLOCK_BY_BOSS[bossId])
          .filter((slug): slug is string => !!slug)
          .map((slug) => CATS.find((c) => c.key === "projects")?.items.find((it) => it.slug === slug)?.title)
          .filter((t): t is string => !!t);
        if (titles.length > 0) showToast("Unlocked: " + titles.join(", "));
      }
    },
    [goPhase, showToast],
  );

  // Forfeit lands in the play menu, not the gate, hence the control's
  // "Skip to the work" label.
  const onBattleForfeit = useCallback(() => {
    setBattleBoot(null);
    goPhase("play");
    setCol("root");
    snd.back();
  }, [goPhase, snd]);

  const onBattleExit = useCallback(() => {
    setBattleBoot(null);
    goPhase("gate");
    setCol("root");
    snd.back();
  }, [goPhase, snd]);

  /** Player-facing progress wipe, so a player who beat the rush can replay
   * from zero. One click, confirmed by toast, no are-you-sure step. */
  const resetProgressAction = useCallback(() => {
    snd.resume();
    clearProgress(progressStore());
    setDefeatedBosses([]);
    showToast("Progress reset. Back to the start.");
    snd.back();
  }, [snd, showToast]);

  const isMobile = w < MOBILE_BREAKPOINT;
  const cat = CATS[rootIdx];
  const item = cat.items[subIdx] ?? cat.items[0];
  // Locks the project items not yet earned. The browse path always shows
  // every item.
  const unlockedSet = unlockedSlugs(defeatedBosses);
  const isLocked = (catKey: string, slug: string | undefined) =>
    phase === "play" && isGateable(catKey, slug) && !unlockedSet.has(slug!);
  const itemLocked = isLocked(cat.key, item.slug);
  const itemBoss = itemLocked && item.slug ? guardingBoss(item.slug) : null;
  // The authoritative gate. `activate()`'s early return cannot see the
  // popstate handler's own `setPage(p)` (beat the rush, open a project,
  // reset, press Back), so the resolved page is gated at render.
  const pageCat = page ? CATS[page.ri] : null;
  const pageItem = page && pageCat ? pageCat.items[page.si] : null;
  // A slug revealed this session overrides the lock.
  const pageLocked =
    page !== null &&
    pageCat !== null &&
    isLocked(pageCat.key, pageItem?.slug) &&
    !(pageItem?.slug && revealed.has(pageItem.slug));
  const pageBoss = pageItem?.slug ? guardingBoss(pageItem.slug) : null;
  // The station only mounts during intro, so it only needs the idle dim.
  const ringOpacity = 0.82;
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
  // The wordmark is the one <h1> only while play is active. This element
  // is opacity-toggled, not unmounted, across phases, so it must not
  // claim heading semantics at the gate.
  const NameTag = phase === "play" ? "h1" : "div";

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
      <a href="#main" className="skip">
        {skipToContent}
      </a>
      <Atmosphere />

      {/* The station is the dive's landing geometry only. */}
      {stationVisible(phase) && (
        <Station scale={glassScale} opacity={ringOpacity} top={isMobile ? "31%" : "40%"} />
      )}

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
            boss={battleBoot.boss}
            replayActions={battleBoot.actions}
            defeatedBosses={defeatedBosses}
            onVictory={onBattleVictory}
            onForfeit={onBattleForfeit}
            onExit={onBattleExit}
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
        <Landing
          onPlay={enterPlay}
          onContinue={continuePlay}
          onBrowse={enterBrowse}
          hasProgress={defeatedBosses.length > 0}
          vw={w}
          vh={h}
          playMove={snd.move}
          playEnter={snd.enter}
        />
      )}

      {/* /build/ renders directly below, same isMobile pattern as browse */}
      {phase === "browse" && !page && (
        <BrowseIndex
          isMobile={isMobile}
          onItem={(ri, si) => activate(ri, si)}
          onBuild={() => goPhase("build")}
          onBack={() => goPhase("gate")}
        />
      )}

      {phase === "build" && !page && <BuildPage isMobile={isMobile} onBack={() => goPhase("gate")} />}

      {/* id/tabIndex only while play is active: this block is opacity-toggled,
          not unmounted, so an unconditional id="main" would collide with the
          <main id="main"> of BrowseIndex and BuildPage. */}
      <main id={phase === "play" ? "main" : undefined} tabIndex={phase === "play" ? -1 : undefined}>
        {/* wordmark (play phase only; browse carries its own) */}
        <NameTag
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
            margin: 0,
          }}
        >
          <div style={{ fontFamily: SERIF, fontSize: "30px", letterSpacing: ".05em", color: "#eaf1ff", filter: "drop-shadow(0 0 16px rgba(90,150,255,.4))" }}>
            Yovan
          </div>
          <div style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".4em", color: "#7fb0ff", marginTop: "3px" }}>BACKEND SOFTWARE ENGINEER</div>
        </NameTag>

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

        <div style={{ display: "flex", alignItems: "center", gap: "10px", fontFamily: SERIF, fontSize: "42px", lineHeight: 1.05, color: "#f1f5fc", letterSpacing: ".01em", filter: "drop-shadow(0 0 22px rgba(90,150,255,.3))" }}>
          {item.title}
          {itemLocked && (
            <span aria-label={SEAL_LABEL} role="img" style={{ fontSize: "0.4em", color: "#9fb6d6" }}>
              🔒
            </span>
          )}
        </div>
        <div style={{ marginTop: "10px", fontFamily: MONO, fontSize: "12px", letterSpacing: ".14em", color: "#9fc0ec" }}>
          {item.meta}
        </div>

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

        <div style={{ marginTop: "22px", color: "#b6c2d8", fontSize: "15.5px", lineHeight: 1.65, maxWidth: "430px" }}>
          {itemLocked ? sealedLine(itemBoss) : item.body}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "24px" }}>
          {!itemLocked && item.tags.map((t, i) => (
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

        {!itemLocked && !!item.linkLabel && (() => {
          // Real anchor when there is a case study or external link; a button
          // only for an item with a label but no link.
          const href = rowHref(item, rootIdx, subIdx);
          const external = !item.slug && href !== null;
          const linkStyle: CSSProperties = {
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
            ...(href ? { textDecoration: "none" } : {}),
          };
          const body = (
            <>
              <span style={{ color: "#9fc4ff" }}>▸</span>
              {item.linkLabel}
            </>
          );
          if (href) {
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                onClick={(e) => {
                  if (!shouldRouteInApp(e)) return;
                  e.preventDefault();
                  activate();
                }}
                style={linkStyle}
              >
                {body}
              </a>
            );
          }
          return (
            <div onClick={() => activate()} role="button" style={linkStyle}>
              {body}
            </div>
          );
        })()}
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

        {/* FIGHT: a play-only row outside the CATS roster. Its tag shows the
            boss name for a direct launch, or CHOOSE when the chooser opens. */}
        <div
          role="button"
          onClick={enterFight}
          onMouseEnter={() => setCol("fight")}
          style={{
            marginTop: "10px",
            width: "236px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            borderRadius: "13px",
            background:
              col === "fight"
                ? "linear-gradient(160deg, rgba(120,32,46,.86), rgba(50,12,26,.82))"
                : "linear-gradient(160deg, rgba(70,20,30,.78), rgba(30,8,18,.74))",
            border: col === "fight" ? "1px solid rgba(255,165,145,.55)" : "1px solid rgba(255,130,110,.36)",
            boxShadow:
              col === "fight"
                ? "inset 0 0 0 1px rgba(255,255,255,.06), 0 12px 36px -14px rgba(0,0,0,.7), 0 0 30px rgba(255,90,60,.24)"
                : "inset 0 0 0 1px rgba(255,255,255,.05), 0 12px 36px -14px rgba(0,0,0,.7), 0 0 26px rgba(255,70,50,.14)",
            fontFamily: "'Sora',sans-serif",
            fontSize: "14px",
            color: "#ffd9cf",
            letterSpacing: ".04em",
          }}
        >
          <span style={{ color: "#ff9d8a", textShadow: "0 0 8px #ff6a50" }}>⚔</span>
          <span style={{ flex: 1 }}>Fight</span>
          <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".18em", color: defeatedBosses.length ? "#e8c87a" : "#c98d80" }}>
            {fightChoice.mode === "direct" ? BOSS_NAMES[fightChoice.boss].toUpperCase() : "CHOOSE"}
          </span>
        </div>

        {/* RESET: play-path progress wipe. Hidden until a boss is defeated, so
            a first-time visitor sees no state machinery. Click-only (no
            tabIndex or onKeyDown): a focusable element under the global
            keydown listener can double-fire. */}
        {defeatedBosses.length > 0 && (
          <div
            role="button"
            aria-label="Reset progress"
            onClick={resetProgressAction}
            style={{
              marginTop: "10px",
              width: "236px",
              padding: "9px 16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              borderRadius: "10px",
              background: "rgba(255,255,255,.02)",
              border: "1px solid rgba(140,160,190,.18)",
              fontFamily: MONO,
              fontSize: "10.5px",
              letterSpacing: ".14em",
              color: "#7f8fac",
            }}
          >
            <span style={{ color: "#9aa8c4" }}>↺</span>
            <span>RESET PROGRESS</span>
          </div>
        )}

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
                const locked = isLocked(cat.key, it.slug);
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
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        opacity: locked ? 0.55 : 1,
                      }}
                    >
                      {it.title}
                    </span>
                    {locked && (
                      <span aria-label={SEAL_LABEL} role="img" style={{ fontFamily: MONO, fontSize: "10px", color: "#5f7196" }}>🔒</span>
                    )}
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

      {/* FIGHT chooser. Top-level (outside the desktop command-system
          container) so the mobile FIGHT chip opens the same panel. zIndex 25
          beats the mobile category sheet (22) and command bar / FIGHT chip
          (24); all are direct children of the root fixed container, so they
          share one stacking context. */}
      {/* Tap-outside backdrop: same z-index as the panel and placed before
          it, so the panel wins where they overlap. Routes through `back()`
          like Escape. `data-ui` keeps `bgClick` from also firing. */}
      {fightChooserOpen && booted && !page && (
        <div
          data-ui
          role="presentation"
          onClick={() => back()}
          style={{ position: "absolute", inset: 0, zIndex: 25 }}
        />
      )}
      {fightChooserOpen && booted && !page && (
        <div
          data-ui
          style={{
            position: "absolute",
            left: isMobile ? "50%" : "248px",
            bottom: isMobile ? "calc(150px + env(safe-area-inset-bottom, 0px))" : "38px",
            transform: isMobile ? "translateX(-50%)" : "none",
            zIndex: 25,
            width: isMobile ? "min(88vw, 280px)" : "246px",
          }}
        >
          <div
            style={{
              background: "linear-gradient(160deg, rgba(70,20,30,.92), rgba(28,8,18,.9))",
              backdropFilter: "blur(11px)",
              WebkitBackdropFilter: "blur(11px)",
              border: "1px solid rgba(255,150,130,.42)",
              borderRadius: "13px",
              overflow: "hidden",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05), 0 18px 48px -14px rgba(0,0,0,.75), 0 0 36px rgba(255,70,50,.18)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 16px",
                borderBottom: "1px solid rgba(255,130,110,.22)",
                background: "linear-gradient(90deg, rgba(255,90,70,.16), transparent)",
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".3em", color: "#ff9d8a" }}>CHOOSE A FIGHT</span>
            </div>
            <div style={{ padding: "8px" }}>
              {fightRows.map((row, i) => {
                const active = i === fightChooserIdx;
                return (
                  <div
                    key={row.boss}
                    role="button"
                    onClick={() => {
                      setFightChooserOpen(false);
                      launchFight(row.boss);
                    }}
                    onMouseEnter={() => setFightChooserIdx(i)}
                    style={{ ...rowStyle(active), minHeight: "44px" }}
                  >
                    <span style={cursorStyle(active, "#ff9d8a")}>▸</span>
                    <span style={{ flex: 1 }}>{row.label}</span>
                    {row.isRematch && (
                      <span style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: ".18em", color: "#e8c87a" }}>
                        REMATCH
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
          // Closed means nothing inside is tabbable, not just invisible.
          visibility: sheetOpen ? "visible" : "hidden",
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
          {cat.items.map((it, j) => {
            const locked = isLocked(cat.key, it.slug);
            // A locked row shows the seal, never a link.
            const href = locked ? null : rowHref(it, rootIdx, j);
            const external = !locked && !it.slug && href !== null;
            const rowStyle: CSSProperties = {
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "18px",
              marginBottom: "11px",
              borderRadius: "15px",
              background: "linear-gradient(160deg, rgba(22,44,86,.62), rgba(12,22,46,.54))",
              border: "1px solid rgba(140,185,255,.26)",
              boxShadow: "0 10px 30px -12px rgba(0,0,0,.5)",
              opacity: locked ? 0.6 : 1,
              ...(href ? { textDecoration: "none" } : {}),
            };
            const rowBody = (
              <>
                <span aria-label={locked ? SEAL_LABEL : undefined} role={locked ? "img" : undefined} style={{ color: locked ? "#5f7196" : "#7fb0ff", fontSize: "15px" }}>{locked ? "🔒" : "▸"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SERIF, fontSize: "21px", color: "#eaf1ff", marginBottom: "4px" }}>
                    {it.title}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: ".06em", color: "#9fb6d6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {it.meta}
                  </div>
                </div>
                {!locked && !!it.stat && (
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
              </>
            );
            if (href) {
              return (
                <a
                  key={j}
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={(e) => {
                    if (!shouldRouteInApp(e)) return;
                    e.preventDefault();
                    setSub(j);
                    activate(rootIdx, j);
                  }}
                  style={rowStyle}
                >
                  {rowBody}
                </a>
              );
            }
            return (
              <div
                key={j}
                onClick={() => {
                  setSub(j);
                  activate(rootIdx, j);
                }}
                role="button"
                style={rowStyle}
              >
                {rowBody}
              </div>
            );
          })}
        </div>
      </div>

      {/* mobile command bar (play phase only, never over the gate) */}
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

      {/* mobile FIGHT chip, same play-only rule as the command bar */}
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

      {/* mobile RESET chip: top-right because the bottom edge holds the
          command bar and FIGHT chip. Shown only after a defeat, like the
          desktop row. */}
      {defeatedBosses.length > 0 && (
      <div
        data-ui
        role="button"
        aria-label="Reset progress"
        onClick={resetProgressAction}
        style={{
          position: "absolute",
          right: "14px",
          top: "20px",
          zIndex: 24,
          display: isMobile && booted && !page ? "flex" : "none",
          alignItems: "center",
          gap: "6px",
          padding: "8px 14px",
          borderRadius: "999px",
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(160,175,200,.28)",
          fontFamily: MONO,
          fontSize: "10px",
          letterSpacing: ".12em",
          color: "#aab6cc",
          cursor: "pointer",
        }}
      >
        ↺ RESET
      </div>
      )}
      </main>

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

      <CaseStudyPage page={pageLocked ? null : page} isMobile={isMobile} onClose={closePage} />
      {pageLocked && pageCat && pageItem && (
        <LockedCaseStudy
          item={pageItem}
          catLabel={pageCat.label}
          isMobile={isMobile}
          boss={pageBoss}
          onReveal={() => pageItem.slug && revealItem(pageItem.slug)}
          onClose={closePage}
        />
      )}

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
