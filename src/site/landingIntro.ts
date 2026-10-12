/**
 * The desktop landing's intro: which phase the landing opens in, and which
 * inputs during the intro skip to the settled frame. Pure, so it tests
 * without a DOM; Landing.tsx reads events into `IntroInput` and applies the
 * verdict.
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
 * no row activates. Everything else passes through: unlisted keys, Tab,
 * modified keys, keys while focus is on a control, input on links and
 * controls, and a click on the focused row (a screen reader's synthetic
 * click, which the aria-disabled row ignores).
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
