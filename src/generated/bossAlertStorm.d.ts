/**
 * Hand-written declarations for the generated Alert Storm boss module (see
 * bossAlertStorm.js header). Signatures verified against the lab source
 * (boss-alert-storm.html lines 374-621). Per-bat PRIMITIVES are the API the
 * renderer composes with (batFinal/batFinalPost + effect helpers + SWARM
 * formation); the monolithic storm reels ride along inertly. A Grid is
 * EROWS×ECOLS of palette keys or null. No PAL export here — import it from
 * diveTimeline (extractor PAL-ownership note).
 */

export type Grid = (string | null)[][];
/** Loose effect pixels: [row, col, paletteKey]. */
export type Pts = [number, number, string][];
/** Reel entry: [frame, milliseconds]. */
export type Reel = [Grid, number][];
export type Mouth = "stitched" | "hollow" | "red";

export declare const EROWS: number;
export declare const ECOLS: number;
export declare function newG(): Grid;
export declare function eP(g: Grid, r: number, c: number, k: string): void;
export declare function eR(g: Grid, r1: number, r2: number, c1: number, c2: number, k: string): void;
export declare function eCarve(g: Grid, r1: number, r2: number, c1: number, c2: number): void;
export declare function eOutline(g: Grid): Grid;

/** Default 10-slot formation: [row, col, flutterPhase] per bat. */
export declare const SWARM: [number, number, number][];
/** The lab's hardcoded real-bat index — engine state supersedes this. */
export declare const REAL_I: number;

export declare function bellImp(g: Grid, r: number, c: number, f: number, real: boolean): void;
export declare function bellPost(g: Grid, r: number, c: number, f: number, real: boolean): void;
export declare function signImp(g: Grid, r: number, c: number, f: number, real: boolean): void;
export declare function signPost(g: Grid, r: number, c: number, f: number, real: boolean): void;
export declare function batImp(g: Grid, r: number, c: number, f: number, real: boolean): void;
export declare function batPost(g: Grid, r: number, c: number, f: number, real: boolean): void;
export declare function swarmOf(
  impFn: (g: Grid, r: number, c: number, f: number, real: boolean) => void,
  postFn: (g: Grid, r: number, c: number, f: number, real: boolean) => void,
  f: number,
): Grid;
export declare const OPT_A: Grid[];
export declare const OPT_B: Grid[];
export declare const OPT_C: Grid[];

/** Paint one final-design bat (15w×12h) at (r,c); f = flutter frame 0|1. */
export declare function batFinal(g: Grid, r: number, c: number, f: number, mouth: Mouth): void;
/** Post-outline details for the same bat — call on the eOutline output. */
export declare function batFinalPost(out: Grid, r: number, c: number, f: number, mouth: Mouth): void;

export declare function stormOf(f: number, phase: "hidden" | "scream"): Grid;
export declare const HIDDEN: Grid[];
export declare const SCREAM: Grid[];
export declare const STORM_REEL: Reel;
export declare function soloBat(mouth: Mouth): Grid;
export declare const SOLO_STITCH: Grid;
export declare const SOLO_HOLLOW: Grid;
export declare const SOLO_RED: Grid;

export declare function eOverlay(grid: Grid, pts: Pts): Grid;
export declare function eFlashOf(grid: Grid): Grid;
export declare function eDitherAll(grid: Grid, mod: number): Grid;
/** Scream ripple pixel set for wave 1|2|3 (uses SWARM/REAL_I positions). */
export declare function screamRipple(wave: number): Pts;
export declare const STORM_ATK: Reel;
export declare const JIT: [number, number][];
export declare function stormJitterOf(f: number): Grid;
export declare const STORM_HIT: Reel;
export declare function stormFallOf(dr: number): Grid;
export declare function stormAshes(): Grid;
export declare const STORM_DIE: Reel;
