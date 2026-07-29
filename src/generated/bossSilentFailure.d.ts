/**
 * Hand-written declarations for the generated Silent Failure boss module (see
 * bossSilentFailure.js header). Signatures verified against the lab source
 * (boss-silent-failure.html lines 372-688). Monolithic reels are the API here
 * (single entity, no per-entity state, unlike Cascade's per-node primitives):
 * engine phase drives frame family (SIL_BODY/SIL_FADE/SIL_EMPTY), SIL_ATK on
 * the ambush, SIL_HIT (body only), SIL_DIE. A Grid is EROWS×ECOLS of palette
 * keys or null. No PAL export here — import it from diveTimeline (extractor
 * PAL-ownership note).
 */

export type Grid = (string | null)[][];
/** Loose effect pixels: [row, col, paletteKey]. */
export type Pts = [number, number, string][];
/** Reel entry: [frame, milliseconds]. */
export type Reel = [Grid, number][];

export declare const EROWS: number;
export declare const ECOLS: number;
export declare function newG(): Grid;
export declare function eP(g: Grid, r: number, c: number, k: string): void;
export declare function eR(g: Grid, r1: number, r2: number, c1: number, c2: number, k: string): void;
export declare function eCarve(g: Grid, r1: number, r2: number, c1: number, c2: number): void;
export declare function eOutline(g: Grid): Grid;
/** Translucency: checkerboard a region to transparent. Must run AFTER eOutline. */
export declare function eDither(g: Grid, r1: number, r2: number, c1: number, c2: number): void;

/** Draft reel A: hooded specter — rides along inertly, never wired to the engine. */
export declare function draftA(fr: number): Grid;
/** Draft reel B: smoke mass — rides along inertly, never wired to the engine. */
export declare function draftB(fr: number): Grid;
/** Draft reel C: hollow armor (nothing inside) — rides along inertly, never wired to the engine. */
export declare function draftC(fr: number): Grid;
export declare const DRAFT_A: Grid[];
export declare const DRAFT_B: Grid[];
export declare const DRAFT_C: Grid[];

/** The shipped final boss art: hollow armor + wisp tail. `mode` selects the
 * frame family — `'body'` (spectral body inside the armor, the default),
 * `'fade'` (body dithered, mid-vanish tween), `'empty'` (untargetable: bare
 * armor, no body, no tail — the vanished-phase silhouette). */
export declare function silentFinal(fr: number, mode?: "body" | "fade" | "empty"): Grid;
/** `[silentFinal(0,'body'), silentFinal(1,'body')]` — the two-bob embodied frames. */
export declare const SIL_BODY: Grid[];
/** `[silentFinal(0,'fade'), silentFinal(1,'fade')]` — mid-vanish tween frames. */
export declare const SIL_FADE: Grid[];
/** `[silentFinal(0,'empty'), silentFinal(1,'empty')]` — the vanished-phase, untargetable frames. */
export declare const SIL_EMPTY: Grid[];
/** Vanish-cycle idle reel: body -> flicker -> untargetable empty armor -> return. */
export declare const SIL_REEL: Reel;

/** Enemy-grid effect helpers (60x64) — never reuse the hero's 60x48 `overlay`. */
export declare function eOverlay(grid: Grid, pts: Pts): Grid;
export declare function eFlashOf(grid: Grid): Grid;
export declare function eDitherAll(grid: Grid, mod: number): Grid;
export declare function eShift(grid: Grid, dr: number, dc: number): Grid;

/** Attack reel, populated by `buildSilAtk()` — telekinetic point-and-swing:
 * the armor stays planted, the far gauntlet + ghost blade lift and thrust,
 * then swing home and the body flickers back (the tell). Empty until
 * `buildSilAtk()` runs (the slice calls it once, at the end). */
export declare const SIL_ATK: Reel;
/** Builds `SIL_ATK` in place (push side effect, no return value). Depends on
 * `PIECES`/`pieceShift` — invoked in the slice AFTER both are declared. */
export declare function buildSilAtk(): void;

/** Loose wisp-debris pixels knocked free on a hit. */
export declare const KNOCKED: Pts;
/** Hit reel: only the embodied form takes hits — white flash, recoil, settle. */
export declare const SIL_HIT: Reel;

/** The eight armor-piece boxes `[r1,r2,c1,c2]` on `SIL_EMPTY[0]` (om=0,
 * os=1), in piece order: helmet, near pauldron, far pauldron, breastplate,
 * near gauntlet, far gauntlet, hip plate, ghost blade. */
export declare const PIECES: [number, number, number, number][];
/** Redraws `src` with each of the 8 `PIECES` boxes shifted by its own
 * `[dr, dc]` offset — the death reel's separate/fall/heap frames all compose
 * from this against `SIL_EMPTY[0]`. */
export declare function pieceShift(src: Grid, moves: [number, number][]): Grid;
/** Per-piece offsets for the "pieces separate" death-reel frame. */
export declare const SEP_MOVES: [number, number][];
/** Per-piece offsets for the "pieces fall" death-reel frame. */
export declare const FALL_MOVES: [number, number][];
/** The final landed heap of armor pieces (death reel's resting frame). */
export declare function silentHeap(): Grid;
/** Death reel: body dissolves, the wisps let go, pieces separate, fall, and
 * land in a heap that fades to nothing. */
export declare const SIL_DIE: Reel;
