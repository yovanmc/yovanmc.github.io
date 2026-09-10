// Pure predicate for BattleScene.tsx's canvas-composition effect: does the
// boss layer still compose this frame? It sits in its own `.ts` file rather
// than inline in the useEffect for two reasons: only `src/battle/**/*.ts` is
// measured by the coverage globs (BattleScene.tsx is a `.tsx` file and sits
// outside them), and a gate buried in a useEffect cannot be asserted from
// outside the component at all.
//
// The gate reads the victory overlay's own `mode`, NOT `shown.status`.
// `shown` flips to a victory-status state at the very first animation step
// after a killing blow (the same step that reveals damage numbers), which is
// BEFORE any of the death-escalation fx steps fire (Alert Storm's
// fall/dither, Cascade's CAS_DIE, Silent Failure's SIL_DIE via
// forceBodyForDeath) and well before the victory overlay takes over. Gating
// on status blanks the boss at impact and leaves the arena empty for the
// whole ~1.25s death-animation window. `mode` instead stays "anim" for that
// window and turns "victory" only once the overlay itself is showing.
// Defeat needs no special case: the boss never dies on a defeat turn, and
// `mode` becoming "defeat" (or staying "menu"/"target"/"pause") never
// matches the one excluded value.
export type ComposeGateMode = "menu" | "target" | "anim" | "pause" | "victory" | "defeat";

export function shouldComposeBoss(args: { descend: boolean; mode: ComposeGateMode }): boolean {
  return !args.descend && args.mode !== "victory";
}
