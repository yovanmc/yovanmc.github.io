/**
 * Where the desktop landing's moon scene sits and how large its copy is.
 * The scene is a fixed 1280x800 frame, scaled and anchored bottom-right,
 * sized so the moon and its pool never sit under the copy column. Pure, so
 * it tests without a DOM; Landing measures the column and LandingScene
 * applies the fit.
 */
export const SCENE_W = 1280;
export const SCENE_H = 800;

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The settled moon body, in scene px. */
export const MOON: Box = { left: 672, top: 74, right: 1072, bottom: 426 };
/** The moon body united with its pool below, in scene px. */
export const FOCAL: Box = { left: 672, top: 74, right: 1072, bottom: 690 };
/** The moon at its largest intro pose (scale 1.32 about its base), in scene px. */
export const INTRO_MOON: Box = { left: 608, top: 35.5, right: 1136, bottom: 500 };

/** Clear space between the copy column's right edge and the focal box. */
export const COPY_GAP = 32;
/** The settled moon's top stays at least this share of the viewport height below the top edge. */
export const TOP_MARGIN = 0.05;

export type CopyTier = "L" | "M" | "S";

export interface TierSpec {
  /** Copy column width. */
  column: number;
  /** Narrowest viewport the tier takes. */
  minWidth: number;
  /** Viewport height the whole landing needs with three menu rows, measured with the landing fonts loaded. */
  height3: number;
  /** Extra height per menu row beyond three. */
  perRow: number;
  /** Name size and the second line's indent. */
  name: number;
  indent: number;
  /** Bio size and width. One size in every tier, so browser zoom scales it fully. */
  bio: number;
  bioWidth: number;
  /** Rule under the name. */
  rule: number;
}

export const TIERS: Record<CopyTier, TierSpec> = {
  L: { column: 540, minWidth: 1200, height3: 731, perRow: 54, name: 108, indent: 70, bio: 17, bioWidth: 480, rule: 380 },
  M: { column: 470, minWidth: 960, height3: 714, perRow: 54, name: 84, indent: 54, bio: 17, bioWidth: 430, rule: 340 },
  S: { column: 400, minWidth: 0, height3: 0, perRow: 54, name: 64, indent: 42, bio: 17, bioWidth: 380, rule: 300 },
};

/** The largest tier whose landing fits this viewport with `rows` menu rows. */
export function copyTier(vw: number, vh: number, rows: number): CopyTier {
  const fits = (t: TierSpec) => vw >= t.minWidth && vh >= t.height3 + t.perRow * (rows - 3);
  if (fits(TIERS.L)) return "L";
  if (fits(TIERS.M)) return "M";
  return "S";
}

/** The copy column's left edge, matching its `clamp(40px, 6.9vw, 120px)` inset. */
export function copyLeft(vw: number): number {
  return Math.min(120, Math.max(40, 0.069 * vw));
}

export interface SceneFit {
  scale: number;
  /** The frame's left and top edges in viewport px (may be negative). */
  x: number;
  y: number;
  /** The focal box, the settled moon and the intro moon in viewport px. */
  focal: Box;
  moon: Box;
  introMoon: Box;
}

function place(b: Box, scale: number, x: number, y: number): Box {
  return { left: x + b.left * scale, top: y + b.top * scale, right: x + b.right * scale, bottom: y + b.bottom * scale };
}

/**
 * The scale is the smallest of three limits: cover the viewport, keep the
 * focal box `COPY_GAP` px right of `copyRight`, and keep both the settled
 * moon's top margin and the whole intro moon inside the viewport. A
 * `copyRight` that is not a finite number is read as no copy. Any band the
 * frame leaves uncovered shows the night behind it.
 */
export function sceneFit(vw: number, vh: number, copyRight: number): SceneFit {
  const right = Number.isFinite(copyRight) ? copyRight : 0;
  const cover = Math.max(vw / SCENE_W, vh / SCENE_H);
  const focal = (vw - right - COPY_GAP) / (SCENE_W - FOCAL.left);
  const top = Math.min((vh * (1 - TOP_MARGIN)) / (SCENE_H - MOON.top), vh / (SCENE_H - INTRO_MOON.top));
  const scale = Math.max(0, Math.min(cover, focal, top));
  const x = vw - SCENE_W * scale;
  const y = vh - SCENE_H * scale;
  return {
    scale,
    x,
    y,
    focal: place(FOCAL, scale, x, y),
    moon: place(MOON, scale, x, y),
    introMoon: place(INTRO_MOON, scale, x, y),
  };
}
