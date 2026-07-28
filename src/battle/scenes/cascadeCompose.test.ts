// composeCascade purity tests (M6 plan §Renderer strategy Cascade / "Tests +
// tooling" PR-1b list): per-box deep-equality against source frames, links
// only between living neighbors (hot edge from lastHop), zero stray cells
// outside boxes + links, and the semantic guard pass-2 G3 demanded — a
// living UNLIT node's core is never a stray 'X' lit core or 'W' afterglow
// (cascadeFinal always draws all 5 links unconditionally, so a node's own
// copied box can legitimately show a COLD link dot — 'a' or 'P' — crossing
// its core pixels; that is real canonical content, not a bug, and it is
// excluded from the strict per-box/core checks below the same way the
// composer's own link pass has final authority over those coordinates).
import { describe, expect, it } from "vitest";
import { cascadeFinal, cascadeDark } from "../../generated/bossCascade";
import type { CascadeBoss, CascadeNode } from "../bosses/cascade";
import { NODE_COUNT } from "../bosses/cascade";
import { composeCascade, linkPoints, nodeBox, pingPoints, sourceFrameFor } from "./cascadeCompose";

function makeNode(id: number, overrides: Partial<CascadeNode> = {}): CascadeNode {
  return { id, hp: 25, maxHp: 25, alive: true, marked: false, ...overrides };
}

function makeBoss(overrides: Partial<CascadeBoss> = {}): CascadeBoss {
  return {
    kind: "cascade",
    nodes: Array.from({ length: NODE_COUNT }, (_, id) => makeNode(id)),
    carrier: 0,
    stormIn: 2,
    lastHop: null,
    ...overrides,
  };
}

function bobForBoss(boss: CascadeBoss, flutter: number) {
  return (i: number) => (i === boss.carrier ? 0 : (flutter + i) % 2);
}

/** The 2x2 core square `bossCascade.js`'s `cascadeFinal` draws for node `i`
 * at box `box` (`eR(g, rr+2+big, rr+3+big, c+2+big, c+3+big, core)`). */
function coreCells(i: number, box: { rr: number; c: number }): [number, number][] {
  const big = i === 0 ? 1 : 0;
  const pts: [number, number][] = [];
  for (const r of [box.rr + 2 + big, box.rr + 3 + big]) {
    for (const c of [box.c + 2 + big, box.c + 3 + big]) pts.push([r, c]);
  }
  return pts;
}

/** Every cell segment `(i, i+1)`'s link touches, across the two node
 * boxes it neighbors — used to exclude the composer's own link-redraw
 * coordinates from a strict per-box source-frame comparison (the link pass
 * has final authority there, by design; see composeCascade's own doc). */
function linkCellSet(boss: CascadeBoss, flutter: number): Set<string> {
  const bobFor = bobForBoss(boss, flutter);
  const cells = new Set<string>();
  for (let i = 0; i < NODE_COUNT - 1; i++) {
    for (const [r, c] of linkPoints(i, bobFor(i), bobFor(i + 1))) cells.add(`${r},${c}`);
  }
  return cells;
}

/** Every cell the composer is allowed to have painted this frame: every
 * node's own box (carrier's box widened by its ping points) plus every
 * living-neighbor link's 3 dot cells. */
function allowedCells(boss: CascadeBoss, flutter: number): Set<string> {
  const allowed = new Set<string>();
  const bobFor = bobForBoss(boss, flutter);
  const addBox = (i: number, bob: number, ping: boolean) => {
    const box = nodeBox(i, bob);
    for (let r = box.rr; r <= box.r2; r++) for (let c = box.c; c <= box.c2; c++) allowed.add(`${r},${c}`);
    if (ping) for (const [r, c] of pingPoints(box)) allowed.add(`${r},${c}`);
  };
  for (let i = 0; i < NODE_COUNT; i++) {
    const alive = boss.nodes.find((n) => n.id === i)!.alive;
    addBox(i, bobFor(i), i === boss.carrier && alive);
  }
  for (let i = 0; i < NODE_COUNT - 1; i++) {
    const a = boss.nodes.find((n) => n.id === i)!;
    const b = boss.nodes.find((n) => n.id === i + 1)!;
    if (!a.alive || !b.alive) continue;
    for (const [r, c] of linkPoints(i, bobFor(i), bobFor(i + 1))) allowed.add(`${r},${c}`);
  }
  return allowed;
}

describe("composeCascade — per-box deep-equality against source frames", () => {
  it("a living unlit node's box exactly matches the source frame chosen by sourceFrameFor, outside the link-redraw cells", () => {
    const boss = makeBoss({ carrier: 0 });
    const out = composeCascade(boss, 0);
    const linkCells = linkCellSet(boss, 0);
    for (const i of [1, 2, 3, 4, 5]) {
      const bob = (0 + i) % 2;
      const f = sourceFrameFor(i, bob);
      const src = cascadeFinal(f);
      const box = nodeBox(i, bob);
      for (let r = box.rr; r <= box.r2; r++) {
        for (let c = box.c; c <= box.c2; c++) {
          if (linkCells.has(`${r},${c}`)) continue; // the link pass has final authority there
          expect(out[r][c]).toBe(src[r][c]);
        }
      }
    }
  });

  it("the carrier's box + ping points exactly match cascadeFinal(carrier), outside the link-redraw cells", () => {
    const boss = makeBoss({ carrier: 3 });
    const out = composeCascade(boss, 1);
    const linkCells = linkCellSet(boss, 1);
    const src = cascadeFinal(3);
    const box = nodeBox(3, 0);
    for (let r = box.rr; r <= box.r2; r++) {
      for (let c = box.c; c <= box.c2; c++) {
        if (linkCells.has(`${r},${c}`)) continue;
        expect(out[r][c]).toBe(src[r][c]);
      }
    }
    for (const [r, c] of pingPoints(box)) {
      if (linkCells.has(`${r},${c}`)) continue;
      expect(out[r][c]).toBe(src[r][c]);
    }
  });

  it("a dead node's box exactly matches cascadeDark(NODE_COUNT, bob) (k=6 draws zero links, so no exclusion needed)", () => {
    const boss = makeBoss({
      carrier: 5,
      nodes: Array.from({ length: NODE_COUNT }, (_, id) => makeNode(id, id === 2 ? { alive: false, hp: 0 } : {})),
    });
    const out = composeCascade(boss, 0);
    const bob = (0 + 2) % 2; // node 2, flutter 0
    const src = cascadeDark(NODE_COUNT, bob);
    const box = nodeBox(2, bob);
    for (let r = box.rr; r <= box.r2; r++) {
      for (let c = box.c; c <= box.c2; c++) expect(out[r][c]).toBe(src[r][c]);
    }
  });
});

describe("composeCascade — links only between living neighbors, hot edge from lastHop", () => {
  it("draws all 5 links when every node is alive, cold (no lastHop)", () => {
    const boss = makeBoss({ carrier: 0, lastHop: null });
    const out = composeCascade(boss, 0);
    const bobFor = bobForBoss(boss, 0);
    for (let i = 0; i < NODE_COUNT - 1; i++) {
      const pts = linkPoints(i, bobFor(i), bobFor(i + 1));
      for (const [r, c] of pts) expect(out[r][c]).not.toBeNull();
    }
  });

  it("lights the hot edge X when it matches lastHop, other links stay cold", () => {
    const hopBoss = makeBoss({ carrier: 1, lastHop: [0, 1] });
    const outHop = composeCascade(hopBoss, 0);
    const bobForHop = bobForBoss(hopBoss, 0);
    const hotPts = linkPoints(0, bobForHop(0), bobForHop(1));
    expect(hotPts.every(([r, c]) => outHop[r][c] === "X")).toBe(true);

    // a hop that is NOT this exact index-adjacent pair (e.g. it skipped a
    // dead node) leaves every segment cold — no single edge is "the" hop.
    const skipBoss = makeBoss({ carrier: 3, lastHop: [0, 3] });
    const outSkip = composeCascade(skipBoss, 0);
    const bobForSkip = bobForBoss(skipBoss, 0);
    const coldPts = linkPoints(0, bobForSkip(0), bobForSkip(1));
    expect(coldPts.some(([r, c]) => outSkip[r][c] === "X")).toBe(false);
  });

  it("skips the link (all 3 dots cleared to null) when either neighbor is dead, even though a source box copy could have embedded a stray dot there", () => {
    const boss = makeBoss({
      carrier: 5,
      nodes: Array.from({ length: NODE_COUNT }, (_, id) => makeNode(id, id === 2 ? { alive: false, hp: 0 } : {})),
    });
    const out = composeCascade(boss, 0);
    const bobFor = bobForBoss(boss, 0);
    const seg1 = linkPoints(1, bobFor(1), bobFor(2)); // node1(alive)-node2(dead)
    const seg2 = linkPoints(2, bobFor(2), bobFor(3)); // node2(dead)-node3(alive)
    for (const [r, c] of [...seg1, ...seg2]) expect(out[r][c]).toBeNull();
  });
});

describe("composeCascade — zero stray cells outside boxes + links", () => {
  it("every non-null cell in the composed frame falls inside a node box, the carrier's ping points, or a living-neighbor link", () => {
    const scenarios: CascadeBoss[] = [
      makeBoss({ carrier: 0 }),
      makeBoss({ carrier: 3, lastHop: [0, 3] }),
      makeBoss({
        carrier: 5,
        lastHop: [4, 5],
        nodes: Array.from({ length: NODE_COUNT }, (_, id) =>
          makeNode(id, [0, 1, 2].includes(id) ? { alive: false, hp: 0 } : {}),
        ),
      }),
    ];
    for (const boss of scenarios) {
      for (const flutter of [0, 1]) {
        const out = composeCascade(boss, flutter);
        const allowed = allowedCells(boss, flutter);
        for (let r = 0; r < out.length; r++) {
          for (let c = 0; c < out[r].length; c++) {
            if (out[r][c] === null) continue;
            expect(allowed.has(`${r},${c}`)).toBe(true);
          }
        }
      }
    }
  });
});

describe("composeCascade — semantic guard: living-unlit core is never a stray lit/afterglow read (pass-2 G3)", () => {
  it("no living non-carrier node's core cell ever reads X (lit) or W (afterglow) — cold link overlap (a/P) is legitimate and excluded", () => {
    const boss = makeBoss({ carrier: 0, lastHop: null }); // no hot edge anywhere
    for (const flutter of [0, 1]) {
      const out = composeCascade(boss, flutter);
      for (const i of [1, 2, 3, 4, 5]) {
        const bob = (flutter + i) % 2;
        const box = nodeBox(i, bob);
        for (const [r, c] of coreCells(i, box)) {
          expect(out[r][c]).not.toBe("X");
          expect(out[r][c]).not.toBe("W");
        }
      }
    }
  });

  it("a living non-carrier node whose core has no link overlap reads a clean N", () => {
    // node 0 and node 2 at bob 0 were verified link-free at their core cells
    const boss = makeBoss({ carrier: 5, lastHop: null });
    const out = composeCascade(boss, 0);
    for (const i of [0, 2]) {
      const box = nodeBox(i, 0);
      for (const [r, c] of coreCells(i, box)) expect(out[r][c]).toBe("N");
    }
  });

  it("the carrier's own core is X (holding the charge), never N or W", () => {
    const boss = makeBoss({ carrier: 4, lastHop: null });
    const out = composeCascade(boss, 1);
    const linkCells = linkCellSet(boss, 1);
    const box = nodeBox(4, 0);
    const coreOutsideLinks = coreCells(4, box).filter(([r, c]) => !linkCells.has(`${r},${c}`));
    expect(coreOutsideLinks.length).toBeGreaterThan(0); // sanity: not every core cell is link-covered
    for (const [r, c] of coreOutsideLinks) expect(out[r][c]).toBe("X");
  });
});
