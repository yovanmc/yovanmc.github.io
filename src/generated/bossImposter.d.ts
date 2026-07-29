/**
 * Hand-written declarations for the generated Imposter Syndrome boss module
 * (see bossImposter.js header). Signatures verified against the lab source
 * (boss-imposter-syndrome.html lines 372-444, file 469 lines). THE EXCEPTION
 * SLICE: unlike every other boss module, this one is not self-contained — it
 * imports IDLE/ATK/overlay/flashOf/ROWS/COLS from heroBattle.js and recolors
 * the hero's own frames (the "stolen technique" bit) rather than declaring
 * independent enemy-grid primitives. A Grid here is therefore the HERO's
 * ROWS×COLS (60×48), not an enemy-grid EROWS×ECOLS shape. No PAL export here
 * either — import it from diveTimeline (extractor PAL-ownership note).
 */

export type Grid = (string | null)[][];
/** Loose effect pixels: [row, col, paletteKey]. */
export type Pts = [number, number, string][];
/** Reel entry: [frame, milliseconds]. */
export type Reel = [Grid, number][];

/** Recolors every non-null cell through `map`; cells whose key has no entry
 * pass through unchanged. */
export declare function remapOf(grid: Grid, map: Record<string, string>): Grid;
/** Void-blue flesh, violet glints, darkened clothes; corruption purple
 * carries the twist sheen + all the gold. Red survives only in the eyes
 * (painted separately by `eyes`, not part of this map). */
export declare const IMPOSTER_MAP: Record<string, string>;
/** Overlays the two red eye pixels at head offset `hd` (same convention as
 * the hero's `headO`). */
export declare function eyes(grid: Grid, hd: number): Grid;
/** `[eyes(remapOf(IDLE[0], IMPOSTER_MAP), 0), eyes(remapOf(IDLE[1], IMPOSTER_MAP), 1)]`
 * — the two-bob idle frames, corruption-recolored. */
export declare const IMP_IDLE: Grid[];
/** Single recolored slash frame (`ATK[4]`, the hero's own draw-cut apex),
 * used for the lab's static slash preview only — not part of any reel. */
export declare const IMP_SLASH: Grid;

/** Shifts row bands sideways (gap left transparent), recolors whole
 * scanlines, and sprinkles static noise pixels — the corruption-glitch
 * transform. `shifts`: [r1, r2, dx][]. `scans`: [row, paletteKey][].
 * `noise`: [row, col, paletteKey][]. */
export declare function glitchOf(
  grid: Grid,
  shifts: [number, number, number][],
  scans: [number, string][],
  noise: [number, number, string][],
): Grid;
/** Pre-baked glitch frame off `IMP_IDLE[0]`, injected into the idle loop. */
export declare const GLITCH_A: Grid;
/** Pre-baked glitch frame off `IMP_IDLE[1]`, injected into the idle loop. */
export declare const GLITCH_B: Grid;
/** Idle loop: two-bob breathing with periodic glitch-frame interrupts. */
export declare const IMP_REEL: Reel;

/** Attack: the stolen technique — the hero's own iai draw-cut, remapped to
 * the corruption palette, with glitch tears mid-swing and a glitch flicker
 * on the recovery. Red eyes ride every frame. */
export declare const IMP_ATK: Reel;
/** Hit: it does not flinch, it GLITCHES — white flash, violent band-tear
 * with a red scanline, a standard glitch flicker, settle. */
export declare const IMP_HIT: Reel;

/** Checkerboard-dithers a grid toward transparency: keeps a cell only when
 * `(r + c) % mod === 0`. Must run AFTER `glitchOf` (death reel's escalating
 * destruction). */
export declare function hDither(grid: Grid, mod: number): Grid;
/** A fully empty ROWS×COLS grid — the death reel's final frame (everything
 * dithered away but the lingering eyes, painted by `overlay` directly). */
export declare const VOID: Grid;
/** Death: escalating glitch destruction — tears widen, scanlines take over,
 * the body dithers into static, and the red eyes linger last. */
export declare const IMP_DIE: Reel;
