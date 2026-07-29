// Pure predicate for BattleScene.tsx's canvas-composition effect (M6 PR-2
// task 6b, plan §D5a — the death-reel gate, owner-ruled 2026-07-28).
// Extracted into its own .ts file rather than left inline in the useEffect
// for two load-bearing reasons: the widened coverage gate only measures
// `src/battle/**/*.ts` (BattleScene.tsx is a `.tsx` file and sits outside
// it), and a gate buried in a useEffect is exactly the kind of thing that
// stayed silently wrong for two milestones with a fully green test suite —
// nothing could assert it from outside the component.
//
// The bug this fixes: the shipped gate was `!descend && shown.status !==
// "victory"`. `shown` flips to a victory-status state at the very first
// animation step after a killing blow (the same step that reveals damage
// numbers), which is BEFORE any of the death-escalation fx steps fire
// (Alert Storm's fall/dither, Cascade's CAS_DIE, Silent Failure's SIL_DIE
// via forceBodyForDeath) and well before the victory OVERLAY takes over —
// so the boss blinked out at impact and the arena sat empty for the whole
// ~1.25s death-animation window, for every boss, since M5.
//
// The fix: gate on the overlay's own `mode` instead of `shown.status`. The
// boss layer must keep composing through the entire death-animation window
// (mode stays "anim" throughout it) and stop only once the victory overlay
// itself is showing (`mode === "victory"`). Defeat is unaffected by
// construction: the boss never dies on a defeat turn, so there is nothing
// for this predicate to special-case there — `mode` becoming "defeat"
// (or staying "menu"/"target"/"pause") never matches the one excluded
// value.
export type ComposeGateMode = "menu" | "target" | "anim" | "pause" | "victory" | "defeat";

export function shouldComposeBoss(args: { descend: boolean; mode: ComposeGateMode }): boolean {
  return !args.descend && args.mode !== "victory";
}
