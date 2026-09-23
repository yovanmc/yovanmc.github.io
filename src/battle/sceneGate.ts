// Does the boss layer still compose this frame? A separate `.ts` module so
// the coverage globs measure it and it can be asserted outside the
// component.
//
// Reads `mode`, not `shown.status`: status flips to victory on the first
// animation step after a killing blow, before any death fx, so gating on it
// would blank the arena for the whole ~1.25s death animation. `mode` stays
// "anim" until the victory overlay shows. Defeat needs no special case: the
// boss never dies on a defeat turn.
export type ComposeGateMode = "menu" | "target" | "anim" | "pause" | "victory" | "defeat";

export function shouldComposeBoss(args: { descend: boolean; mode: ComposeGateMode }): boolean {
  return !args.descend && args.mode !== "victory";
}
