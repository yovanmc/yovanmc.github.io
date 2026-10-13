/**
 * The desktop landing's intro: which phase the landing opens in, and which
 * inputs during the intro skip to the settled frame. Pure, so it tests
 * without a DOM; useLandingIntro.ts reads events into `IntroInput` and
 * `TailEvent` and applies the verdicts.
 */
export type IntroPhase = "intro" | "settled";

export interface IntroStart {
  phase: IntroPhase;
  /** The reduced-motion entrance: one opacity fade of the settled frame. */
  fade: boolean;
}

/** The intro plays once per page load and never under reduced motion. */
export function introStart(played: boolean, reducedMotion: boolean): IntroStart {
  if (reducedMotion) return { phase: "settled", fade: !played };
  return { phase: played ? "settled" : "intro", fade: false };
}

/** What an event targets: a landing row, a link or other control outside
 * the rows (skip links, footer links), or anything else (scene, copy text). */
export type IntroTarget = "row" | "control" | "other";

export interface IntroInput {
  kind: "key" | "pointer" | "click";
  /** `KeyboardEvent.key`, for kind "key". */
  key?: string;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
  /** The active element is the body, `main` or the landing root. */
  focusAtRoot: boolean;
  target: IntroTarget;
  /** The target is the focused element. */
  targetFocused?: boolean;
}

const SKIP_KEYS = new Set([" ", "Spacebar", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Up", "Down", "Left", "Right"]);

/**
 * "skip" jumps to the settled frame and the caller consumes the gesture, so
 * no row activates. Keys skip only while focus is on the page itself. A
 * pointer press skips wherever focus is, since the press itself moves it
 * and a row it lands on is disabled anyway. Everything else passes
 * through: unlisted keys, Tab, keys held with Ctrl, Alt or Meta, keys while
 * focus is on a control, input on links and controls, and a click on the
 * focused row (a screen reader's synthetic click, which the aria-disabled
 * row ignores).
 */
export function onIntroInput(phase: IntroPhase, input: IntroInput): "skip" | "pass" {
  if (phase !== "intro") return "pass";
  if (input.kind === "key") {
    if (input.ctrl || input.alt || input.meta || !input.focusAtRoot) return "pass";
    return SKIP_KEYS.has(input.key ?? "") ? "skip" : "pass";
  }
  if (input.target === "control") return "pass";
  if (input.kind === "click" && input.targetFocused) return "pass";
  return "skip";
}

/** The rest of a gesture that skipped the intro, which the intro layer
 * still consumes: the key's repeats and keyup, or the press's mouse events
 * and click. */
export interface GestureTail {
  key: string | null;
  pointer: boolean;
}

export const NO_TAIL: GestureTail = { key: null, pointer: false };

export type TailEvent =
  | { type: "keydown" | "keyup"; key: string }
  | { type: "pointerdown" | "pointerup" | "mousedown" | "mouseup" | "click" }
  | { type: "pointercancel" | "contextmenu" | "auxclick" | "blur" };

/**
 * Whether an event belongs to the open tail (and is consumed), and the tail
 * after it. A tail closes on its own end (the keyup, the click), and also
 * when that end can no longer come: a right-click or a cancelled pointer, a
 * new press, or the window losing focus. So a lost end never swallows the
 * next real gesture.
 */
export function onGestureTail(tail: GestureTail, e: TailEvent): { consume: boolean; tail: GestureTail } {
  switch (e.type) {
    case "keydown":
      return { consume: e.key === tail.key, tail };
    case "keyup":
      return e.key === tail.key ? { consume: true, tail: { ...tail, key: null } } : { consume: false, tail };
    case "pointerdown":
      return { consume: false, tail: { ...tail, pointer: false } };
    case "pointerup":
    case "mousedown":
    case "mouseup":
      return { consume: tail.pointer, tail };
    case "click":
      return { consume: tail.pointer, tail: { ...tail, pointer: false } };
    case "blur":
      return { consume: false, tail: NO_TAIL };
    default:
      return { consume: false, tail: { ...tail, pointer: false } };
  }
}
