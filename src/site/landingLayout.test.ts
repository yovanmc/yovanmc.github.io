import { describe, expect, it } from "vitest";
import { COPY_GAP, TIERS, copyLeft, copyTier, hintsShown, sceneFit } from "./landingLayout";

// [vw, vh, tier, scale, frame x, frame y] for a three-row menu, computed by
// plain arithmetic apart from the module. Includes zoomed laptop sizes
// (1366x657 at 125%, 150% and 160%) and the smallest desktop width.
const SWEEP: [number, number, string, number, number, number][] = [
  [1024, 600, "S", 0.7767, 29.8, -21.4],
  [1280, 720, "M", 0.932, 87.0, -25.6],
  [1280, 800, "L", 1.0, 0.0, 0.0],
  [1366, 657, "S", 0.8505, 277.4, -23.4],
  [1440, 900, "L", 1.125, 0.0, 0.0],
  [1600, 640, "S", 0.8285, 539.5, -22.8],
  [1920, 1080, "L", 1.3981, 130.5, -38.4],
  [2560, 1440, "L", 1.8641, 174.0, -51.3],
  [800, 1000, "S", 0.5145, 141.5, 588.4],
  [760, 600, "S", 0.4532, 179.9, 237.4],
  [1093, 526, "S", 0.6809, 221.4, -18.7],
  [911, 438, "S", 0.567, 185.3, -15.6],
  [853, 480, "S", 0.5956, 90.6, 3.5],
];

const copyRightAt = (vw: number, vh: number, rows = 3) => copyLeft(vw) + TIERS[copyTier(vw, vh, rows)].column;

describe("copyTier", () => {
  it.each(SWEEP)("at %ix%i takes tier %s for three rows", (vw, vh, tier) => {
    expect(copyTier(vw, vh, 3)).toBe(tier);
  });

  it("needs a narrower tier width before the larger tiers", () => {
    expect(copyTier(1199, 2000, 3)).toBe("M");
    expect(copyTier(959, 2000, 3)).toBe("S");
  });

  it("steps down a tier when a fourth row no longer fits the height", () => {
    const h = TIERS.L.height3;
    expect(copyTier(1440, h, 3)).toBe("L");
    expect(copyTier(1440, h, 4)).not.toBe("L");
    expect(copyTier(1440, h + TIERS.L.perRow, 4)).toBe("L");
  });

  it("keeps the bio at one size in every tier, so browser zoom scales it fully", () => {
    const sizes = new Set(Object.values(TIERS).map((t) => t.bio));
    expect(sizes.size).toBe(1);
    for (const z of [1.1, 1.25, 1.5, 2]) {
      const tier = copyTier(1920 / z, 1080 / z, 3);
      expect(TIERS[tier].bio * z).toBeCloseTo(TIERS.L.bio * z, 9);
    }
  });
});

describe("copyLeft", () => {
  it("clamps 6.9vw between 40 and 120 px", () => {
    expect(copyLeft(400)).toBe(40);
    expect(copyLeft(1280)).toBeCloseTo(88.32, 2);
    expect(copyLeft(3000)).toBe(120);
  });
});

describe("sceneFit", () => {
  it.each(SWEEP)("at %ix%i (tier %s) scales %f with the frame at %f, %f", (vw, vh, _t, scale, x, y) => {
    const f = sceneFit(vw, vh, copyRightAt(vw, vh));
    expect(f.scale).toBeCloseTo(scale, 3);
    expect(f.x).toBeCloseTo(x, 0);
    expect(f.y).toBeCloseTo(y, 0);
  });

  it.each(SWEEP)("at %ix%i keeps the moon and pool clear of the copy", (vw, vh) => {
    const right = copyRightAt(vw, vh);
    expect(sceneFit(vw, vh, right).focal.left).toBeGreaterThanOrEqual(right + COPY_GAP - 1e-9);
  });

  it.each(SWEEP)("at %ix%i keeps the settled moon 5%% below the top and inside the viewport", (vw, vh) => {
    const { moon } = sceneFit(vw, vh, copyRightAt(vw, vh));
    expect(moon.top).toBeGreaterThanOrEqual(0.05 * vh - 1e-9);
    expect(moon.left).toBeGreaterThanOrEqual(0);
    expect(moon.right).toBeLessThanOrEqual(vw + 1e-9);
    expect(moon.bottom).toBeLessThanOrEqual(vh + 1e-9);
  });

  it.each(SWEEP)("at %ix%i keeps the intro moon wholly inside the viewport, its rim clear of the top", (vw, vh) => {
    const { introMoon, scale } = sceneFit(vw, vh, copyRightAt(vw, vh));
    expect(introMoon.top).toBeGreaterThanOrEqual(8 * scale - 1e-9);
    expect(introMoon.right).toBeLessThanOrEqual(vw + 1e-9);
    expect(introMoon.bottom).toBeLessThanOrEqual(vh + 1e-9);
  });

  it("ignores a copy edge that is not a finite number", () => {
    const plain = sceneFit(1440, 900, 0);
    expect(sceneFit(1440, 900, Number.NaN)).toEqual(plain);
    expect(sceneFit(1440, 900, Number.POSITIVE_INFINITY)).toEqual(plain);
  });

  it("treats a copy edge of 0 as no copy at all", () => {
    expect(sceneFit(1440, 900, 0).scale).toBeCloseTo(1.125, 9);
  });

  it("returns scale 0, never negative, when the copy leaves no room", () => {
    expect(sceneFit(760, 600, 760 - COPY_GAP).scale).toBe(0);
    expect(sceneFit(760, 600, 2000).scale).toBe(0);
  });
});

// The key hints sit fixed at the bottom right. Where the scene is small they
// land on the pool's glow, so they give way below 40 scene px of clearance.
describe("hintsShown", () => {
  it.each([
    [1280, 800, true],
    [1440, 900, true],
    [1600, 640, true],
    [1024, 600, true],
    [1920, 1080, true],
    [1093, 526, true],
    [800, 1000, false],
    [760, 600, false],
    [911, 438, false],
    [853, 480, false],
  ])("at %ix%i shows the hints: %s", (vw, vh, shown) => {
    expect(hintsShown(vw, vh, sceneFit(vw, vh, copyRightAt(vw, vh)))).toBe(shown);
  });

  it("shows the hints when they clear the pool's width, however close below", () => {
    const fit = sceneFit(800, 1000, copyRightAt(800, 1000));
    expect(hintsShown(800 + 400, 1000, { ...fit, pool: { ...fit.pool, left: fit.pool.left - 400, right: fit.pool.right - 400 } })).toBe(true);
  });
});
