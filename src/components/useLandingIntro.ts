import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { NO_TAIL, introStart, onGestureTail, onIntroInput, type IntroPhase, type IntroTarget, type TailEvent } from "../site/landingIntro";

/** The intro reaches its settled frame within this, measured from its first visible frame. */
export const INTRO_MS = 3400;
/** The intro waits this long at most for the landing fonts. */
const FONT_WAIT_MS = 1000;

/** The intro's animations under the root. The root's own reduced-motion fade is not one of them. */
function finiteAnimations(root: HTMLElement): Animation[] {
  return root
    .getAnimations({ subtree: true })
    .filter((a) => a.effect?.getTiming().iterations !== Infinity && (a.effect as KeyframeEffect | null)?.target !== root);
}

function targetKind(t: EventTarget | null): IntroTarget {
  const el = t instanceof Element ? t : null;
  if (el?.closest("[data-landing-row]")) return "row";
  if (el?.closest("a, button, input, select, textarea, [role='button']")) return "control";
  return "other";
}

/**
 * Runs the desktop landing's intro once per page load: waits for the fonts
 * (or one second) and a visible frame, then lets the root's sequence play,
 * settling on its last finished animation or after INTRO_MS. While it plays,
 * the gestures `onIntroInput` names skip to the settled frame and are
 * consumed through their matching keyup or click.
 */
export function useLandingIntro(rootRef: RefObject<HTMLElement>, played: boolean, onPlayed: () => void) {
  const [reduced] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [start] = useState(() => introStart(played, reduced));
  const [phase, setPhase] = useState<IntroPhase>(start.phase);
  const [playing, setPlaying] = useState(start.phase === "settled");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onPlayedRef = useRef(onPlayed);
  onPlayedRef.current = onPlayed;

  const settle = useCallback(() => {
    const root = rootRef.current;
    if (root) for (const a of finiteAnimations(root)) a.finish();
    setPlaying(true);
    if (phaseRef.current === "settled") return;
    phaseRef.current = "settled";
    setPhase("settled");
    onPlayedRef.current();
  }, [rootRef]);

  // Settled at mount (a return visit, or reduced motion): jump before first paint.
  useLayoutEffect(() => {
    if (start.phase === "settled") settle();
  }, [start, settle]);

  // Start on the first visible frame after the fonts, then settle.
  useEffect(() => {
    if (start.phase !== "intro") return;
    let raf = 0;
    let timer = 0;
    let cancelled = false;
    const begin = () => {
      raf = requestAnimationFrame(() => {
        if (cancelled) return;
        setPlaying(true);
        timer = window.setTimeout(settle, INTRO_MS);
      });
    };
    const whenVisible = () => {
      if (document.visibilityState === "visible") return begin();
      const onVis = () => {
        if (document.visibilityState !== "visible") return;
        document.removeEventListener("visibilitychange", onVis);
        if (!cancelled) begin();
      };
      document.addEventListener("visibilitychange", onVis);
    };
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const wait = window.setTimeout(() => !cancelled && whenVisible(), FONT_WAIT_MS);
    fonts.then(() => {
      if (cancelled) return;
      window.clearTimeout(wait);
      whenVisible();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.clearTimeout(wait);
      // Unmounted before settling (viewport crossed the breakpoint, or the
      // landing closed): the intro counts as played.
      if (phaseRef.current === "intro") onPlayedRef.current();
    };
  }, [start, settle]);

  // Once playing, settle when the last sequence animation finishes.
  useEffect(() => {
    if (!playing || phaseRef.current !== "intro") return;
    const root = rootRef.current;
    if (!root) return;
    let live = true;
    Promise.all(finiteAnimations(root).map((a) => a.finished)).then(
      () => live && settle(),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [playing, rootRef, settle]);

  // The intro input layer, on window in the capture phase so it runs before
  // the landing's own key handler. A skipping gesture opens a tail, and the
  // rest of that gesture is consumed until the tail closes.
  useEffect(() => {
    let tail = NO_TAIL;
    const root = () => rootRef.current;
    const focusAtRoot = () => {
      const ae = document.activeElement;
      return !ae || ae === document.body || ae === root() || ae.tagName === "MAIN";
    };
    const consume = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    /** Runs the event through the open tail; true when the tail consumed it. */
    const inTail = (e: Event, te: TailEvent) => {
      const r = onGestureTail(tail, te);
      tail = r.tail;
      if (r.consume) consume(e);
      return r.consume;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (inTail(e, { type: "keydown", key: e.key })) return;
      const verdict = onIntroInput(phaseRef.current, {
        kind: "key",
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        meta: e.metaKey,
        focusAtRoot: focusAtRoot(),
        target: targetKind(e.target),
      });
      if (verdict !== "skip") return;
      consume(e);
      tail = { ...tail, key: e.key };
      settle();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      inTail(e, { type: "keyup", key: e.key });
    };
    const onPointerDown = (e: PointerEvent) => {
      inTail(e, { type: "pointerdown" });
      if (e.button !== 0) return;
      const verdict = onIntroInput(phaseRef.current, { kind: "pointer", focusAtRoot: focusAtRoot(), target: targetKind(e.target) });
      if (verdict !== "skip") return;
      consume(e);
      tail = { ...tail, pointer: true };
      settle();
    };
    const onPointerTail = (e: Event) => {
      inTail(e, { type: e.type as "pointerup" | "mousedown" | "mouseup" | "pointercancel" | "contextmenu" | "auxclick" });
    };
    const onBlur = () => {
      tail = onGestureTail(tail, { type: "blur" }).tail;
    };
    const onClick = (e: MouseEvent) => {
      if (inTail(e, { type: "click" })) return;
      const t = e.target instanceof Element ? e.target : null;
      const verdict = onIntroInput(phaseRef.current, {
        kind: "click",
        focusAtRoot: focusAtRoot(),
        target: targetKind(t),
        targetFocused: !!t && (t === document.activeElement || t.contains(document.activeElement)),
      });
      if (verdict !== "skip") return;
      consume(e);
      settle();
    };
    const opts = { capture: true };
    const tails = ["pointerup", "mousedown", "mouseup", "pointercancel", "contextmenu", "auxclick"] as const;
    window.addEventListener("keydown", onKeyDown, opts);
    window.addEventListener("keyup", onKeyUp, opts);
    window.addEventListener("pointerdown", onPointerDown, opts);
    for (const t of tails) window.addEventListener(t, onPointerTail, opts);
    window.addEventListener("click", onClick, opts);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown, opts);
      window.removeEventListener("keyup", onKeyUp, opts);
      window.removeEventListener("pointerdown", onPointerDown, opts);
      for (const t of tails) window.removeEventListener(t, onPointerTail, opts);
      window.removeEventListener("click", onClick, opts);
      window.removeEventListener("blur", onBlur);
    };
  }, [rootRef, settle]);

  return { phase, playing, fade: start.fade, reduced };
}
