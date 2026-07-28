/**
 * Hand-written declarations for the generated battlefield scene module (see
 * battlefieldScene.js header). Signatures verified against the lab source
 * (battlefield.html lines 29-222). Scene builders take a flutter phase (0|1)
 * and RETURN a full SR×SC grid of palette keys; varAS is the
 * Alert-Storm-corrupted arena mandated at battle start. The SPR actor
 * literal and compose/composeER are excluded from the slice — the renderer
 * owns actor placement. PAL comes from diveTimeline.
 */

export type Grid = (string | null)[][];

export declare const PAL: Record<string, string>;
export declare const SR: number;
export declare const SC: number;
/** Feet row for actor placement. */
export declare const FEET: number;
export declare const BOSS_AT: [number, number];
export declare const HERO_AT: [number, number];
export declare const DCX: number;
export declare const DCY: number;
export declare const DA: number;
export declare const DB: number;
/** Safe footing column spans on the disc. */
export declare const SAFE: [number, number][];

/** Fresh SR×SC grid filled with palette key k. */
export declare function mk(k: string): Grid;
export declare function fillR(g: Grid, r1: number, r2: number, c1: number, c2: number, k: string): void;
export declare function hl(g: Grid, r: number, c1: number, c2: number, k: string): void;
export declare function vl(g: Grid, c: number, r1: number, r2: number, k: string): void;
export declare function dot(g: Grid, r: number, c: number, k: string): void;
/** Stamp packed string-art rows ('.'-transparent) at (r0,c0). */
export declare function stamp(g: Grid, packed: string[], r0: number, c0: number): void;
export declare function hsh(r: number, c: number): number;
/** Normalized elliptical radius from disc center. */
export declare function uOf(r: number, c: number): number;
export declare function inDisc(r: number, c: number): boolean;
/** Column-only test against the SAFE spans. */
export declare function inSafe(c: number): boolean;
export declare function secOf(r: number, c: number): number;
export declare function ringOf(u: number): number;

export declare function buildBase(
  ph: number,
  opt?: { shafts?: boolean; motes?: "up" | "red" | "purple" | "off" },
): Grid;
export declare function glassMap(
  g: Grid,
  fn: (r: number, c: number, cur: string | null) => string | null | undefined,
): void;
export declare function isGlass(ch: string | null): boolean;

/** Per-boss corrupted scenes; ph = flutter phase 0|1. Each returns a fresh grid. */
export declare function varAS(ph: number): Grid;
export declare function varCC(ph: number): Grid;
export declare function varSF(ph: number): Grid;
export declare function varIS(ph: number): Grid;
/** Mutates g: corrupt glass outside pure radius rp. */
export declare function corruptGlass(g: Grid, rp: number): void;
/** Mutates g: horizontal shear bands [[r1,r2,dx],...] + static flecks. */
export declare function glitchScene(g: Grid, bands: [number, number, number][], statics: number): void;
/** Erosion reel stage t = 0..3 (boss HP 100/66/33/0). */
export declare function erosionStage(t: number, ph: number): Grid;
