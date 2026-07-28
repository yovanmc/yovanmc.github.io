/**
 * Hand-written declarations for the generated Cascade boss module (see
 * bossCascade.js header). Signatures verified against the lab source
 * (boss-cascade.html lines 374-653). Per-node PRIMITIVES are the API the
 * renderer composes with (cascadeFinal per-node boxes + cascadeDark husks +
 * effect helpers); the lab's draftA/B/C serpent reels ride along inertly. A
 * Grid is EROWS×ECOLS of palette keys or null. No PAL export here — import it
 * from diveTimeline (extractor PAL-ownership note).
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

/** S-curve path (7 points) shared by the draftA/draftC serpent reels. */
export declare const PATH: [number, number][];
/** Draft reel A: domino serpent — rides along inertly, never wired to the engine. */
export declare function draftA(f: number): Grid;

/** The six chain-node anchor points [row, col], head (node 0) first. */
export declare const NODES: [number, number][];
/** Draft reel B: node chain — rides along inertly, never wired to the engine. */
export declare function draftB(f: number): Grid;
/** Draft reel C: waterfall wyrm — rides along inertly, never wired to the engine. */
export declare function draftC(f: number): Grid;
export declare const DR_A: Grid[];
export declare const DR_B: Grid[];
export declare const DR_C: Grid[];

/** Paint the full 6-node chain with the pulse lit at node `f` (0-5); the
 * previous node holds a gold afterglow, the link the pulse just crossed lights
 * gold. This is a whole-field frame — the engine-driven renderer composes
 * per-node boxes from these, it does not call this directly per §Renderer
 * strategy. */
export declare function cascadeFinal(f: number): Grid;
/** `[0,1,2,3,4,5].map(cascadeFinal)` — one full-chain frame per pulse position. */
export declare const CASCADE: Grid[];
export declare const CASCADE_MS: number[];

/** Enemy-grid effect helpers (60×64) — never reuse the hero's 60×48 `overlay`. */
export declare function eOverlay(grid: Grid, pts: Pts): Grid;
export declare function eFlashOf(grid: Grid): Grid;
export declare function eDitherAll(grid: Grid, mod: number): Grid;

/** Retry-storm frame: every node core lit, every link hot, ping bursts on all
 * six nodes. `f` selects the bob-parity source (same convention as `cascadeFinal`). */
export declare function cascadeOverload(f: number): Grid;
export declare const BOLTS1: Pts;
export declare const BOLTS2: Pts;
/** Attack reel: chain builds to overload, bolts rain, settles back to node 0 lit. */
export declare const CAS_ATK: Reel;

/** Hit frame: the chain shudders sideways, every link strained red. */
export declare function cascadeJolt(): Grid;
export declare const CAS_HIT: Reel;

/** First-`k` nodes dark (husks); `dr` is an optional vertical fall offset for
 * the death reel's collapse frames. */
export declare function cascadeDark(k: number, dr?: number): Grid;
export declare function cascadeAshes(): Grid;
export declare const CAS_DIE: Reel;
