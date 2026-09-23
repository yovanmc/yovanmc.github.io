// Cascade's region-composition renderer. There is no per-node art primitive:
// `cascadeFinal(f)` is a whole-field frame with a fixed lit node and afterglow
// node, while the engine kills arbitrary node sets. So each frame is built per
// node, pasting the already-outlined node box out of a matching source frame.
// eOutline never reruns: the 6 boxes are pairwise non-adjacent at both bob
// values, so each outline is local and survives the paste.
import { NODES, cascadeFinal, cascadeDark, newG } from "../../generated/bossCascade";
import type { Grid } from "../../generated/heroBattle";
import type { CascadeBoss } from "../bosses/cascade";
import { NODE_COUNT } from "../bosses/cascade";

export interface NodeBox {
  rr: number;
  r2: number;
  c: number;
  c2: number;
}

/** Node footprint at a row-shift ("bob", 0 or 1), matching bossCascade.js's
 * box formula (node 0 is 2 cells larger). The carrier always renders at
 * bob 0: cascadeFinal never shifts its own lit node. */
export function nodeBox(i: number, bob: number): NodeBox {
  const [r, c] = NODES[i];
  const big = i === 0 ? 1 : 0;
  const rr = r + bob;
  const r2 = rr + 6 + big * 2;
  const c2 = c + 6 + big * 2;
  return { rr, r2, c, c2 };
}

/** The four ping-burst cells around the lit node, 2 cells past each edge
 * midpoint, as in the generated slice. Only the carrier needs them. */
export function pingPoints(box: NodeBox): [number, number][] {
  const mid = Math.floor((box.c + box.c2) / 2);
  const rmid = Math.floor((box.rr + box.r2) / 2);
  return [
    [box.rr - 2, mid],
    [box.r2 + 2, mid],
    [rmid, box.c - 2],
    [rmid, box.c2 + 2],
  ];
}

/** The 3 link-dot cells between node `i` and `i + 1`, with cascadeFinal's
 * 4-step interpolation. */
export function linkPoints(i: number, bobI: number, bobJ: number): [number, number][] {
  const [r1, c1] = NODES[i];
  const [r2, c2] = NODES[i + 1];
  const cy1 = r1 + bobI + 4;
  const cx1 = c1 + 4;
  const cy2 = r2 + bobJ + 4;
  const cx2 = c2 + 4;
  const pts: [number, number][] = [];
  for (let t = 1; t <= 3; t++) {
    const rr = Math.round(cy1 + ((cy2 - cy1) * t) / 4);
    const cc = Math.round(cx1 + ((cx2 - cx1) * t) / 4);
    pts.push([rr, cc]);
  }
  return pts;
}

/** Smallest source frame giving node `i` the requested bob parity, excluding
 * the frames where `i` is lit (`f === i`) or the afterglow
 * (`f === (i + 1) % NODE_COUNT`), so an unlit node never copies a stray core.
 * Those two frames differ in parity, so each parity leaves 2 frames with
 * identical box content; "smallest" is just a stable choice. */
export function sourceFrameFor(i: number, bob: number): number {
  for (let f = 0; f < NODE_COUNT; f++) {
    if (f % 2 === bob && f !== i && f !== (i + 1) % NODE_COUNT) return f;
  }
  /* v8 ignore next 2 -- unreachable: every (i, bob) has 2 valid frames */
  throw new Error("cascadeCompose: no valid source frame (unreachable)");
}

function copyBox(dst: Grid, src: Grid, box: NodeBox): void {
  for (let r = box.rr; r <= box.r2; r++) {
    for (let c = box.c; c <= box.c2; c++) dst[r][c] = src[r][c];
  }
}

/** One frame of the chain: living boxes pasted from bob-matching sources (the
 * carrier's box and ping burst from `cascadeFinal(carrier)`), dead boxes from
 * the `cascadeDark` husk, then links drawn between living neighbors only (hot
 * edge = `boss.lastHop`). Link dots of non-living pairs are nulled explicitly:
 * cascadeFinal draws all 5 links, and a pasted box can carry a neighbor's
 * stale link dot. */
export function composeCascade(boss: CascadeBoss, flutter: number): Grid {
  const out = newG();
  const bobOf = (i: number) => (flutter + i) % 2;
  const bobFor = (i: number) => (i === boss.carrier ? 0 : bobOf(i));

  for (let i = 0; i < NODE_COUNT; i++) {
    const node = boss.nodes.find((n) => n.id === i)!;
    if (i === boss.carrier && node.alive) {
      const src = cascadeFinal(boss.carrier);
      const box = nodeBox(i, 0);
      copyBox(out, src, box);
      for (const [r, c] of pingPoints(box)) out[r][c] = src[r][c];
    } else if (node.alive) {
      const bob = bobOf(i);
      copyBox(out, cascadeFinal(sourceFrameFor(i, bob)), nodeBox(i, bob));
    } else {
      const bob = bobOf(i);
      copyBox(out, cascadeDark(NODE_COUNT, bob), nodeBox(i, bob));
    }
  }

  for (let i = 0; i < NODE_COUNT - 1; i++) {
    const a = boss.nodes.find((n) => n.id === i)!;
    const b = boss.nodes.find((n) => n.id === i + 1)!;
    const pts = linkPoints(i, bobFor(i), bobFor(i + 1));
    if (a.alive && b.alive) {
      const hot = !!boss.lastHop && boss.lastHop[0] === i && boss.lastHop[1] === i + 1;
      pts.forEach(([r, c], idx) => {
        out[r][c] = hot ? "X" : (idx + 1) % 2 ? "a" : "P";
      });
    } else {
      for (const [r, c] of pts) out[r][c] = null;
    }
  }

  return out;
}
