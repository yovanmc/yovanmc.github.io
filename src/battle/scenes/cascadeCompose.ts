// Cascade's region-composition renderer (M6 plan §Renderer strategy Cascade,
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-1b task 4).
// The lab has no per-node primitive — `cascadeFinal(f)` is a whole-field
// frame with a fixed lit node (core 'X') and one afterglow node (core 'W')
// tied to `f`; the engine kills ARBITRARY node sets, so a naive base-frame
// approach would render a STILL chain (M6 F4). This composer instead builds
// each frame per node, copying the already-`eOutline`d node "box" region
// straight out of a matching source frame — never re-running eOutline itself
// (pass-1 verified: all 6 boxes are pairwise non-adjacent across both bob
// values, so a box's own outline is fully local and survives being pasted
// onto a fresh canvas unchanged).
//
// A `.ts` sibling to bosses/cascade.ts (not `bosses/cascade.ts` itself) so
// the coverage-gated engine module and this presentation module stay
// separate, per the plan's "a `.ts` file so the widened coverage gate
// measures it" note (pass-2 G10) — `src/battle/**/*.ts` covers both either
// way.
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

/** The node's structural footprint at a given row-shift ("bob", 0 or 1) —
 * mirrors `bossCascade.js`'s own per-node box formula exactly (node 0 is the
 * "big" head node, `+2` taller/wider). The carrier is always rendered at
 * `bob = 0` — cascadeFinal(f) never shifts its own lit node (i === f gives
 * `(f + f) % 2 === 0` for every f), matching the plan's "the carrier doesn't
 * bob; it's holding the charge". */
export function nodeBox(i: number, bob: number): NodeBox {
  const [r, c] = NODES[i];
  const big = i === 0 ? 1 : 0;
  const rr = r + bob;
  const r2 = rr + 6 + big * 2;
  const c2 = c + 6 + big * 2;
  return { rr, r2, c, c2 };
}

/** The four ping-burst cells `cascadeFinal(f)` draws around ITS OWN lit node
 * (`f`) — the only node-local content that falls outside `nodeBox`. Exact
 * offsets replicated from the generated slice's own ping-burst block (2 cells
 * beyond each edge midpoint); only the carrier ever needs these. */
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

/** The 3 dotted-link cells between node `i` and node `i + 1`, given each
 * end's own bob — same 4-step interpolation `bossCascade.js`'s `cascadeFinal`
 * uses for its link dots. */
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

/** The smallest source-frame index `f` giving node `i` the requested bob
 * parity, EXCLUDING the frame where `i` is lit (`f === i`, core `'X'`) and
 * the frame where `i` is the afterglow node (`f === (i + 1) % NODE_COUNT`,
 * core `'W'`) — pass-2 G3's exclusion, so a "living unlit" node never copies
 * a stray lit/afterglow core. `i` and `(i + 1) % NODE_COUNT` are always
 * consecutive integers (mod 6), so they never share a parity — exactly one of
 * them is excluded from any given parity's 3 candidates, leaving exactly 2
 * valid frames, and pass-1 verified their node-`i` box CONTENT is
 * byte-identical (box shape only depends on bob = f % 2 parity plus the
 * lit/after checks this exclusion already rules out) — so "smallest" is an
 * arbitrary but stable, fully-tested choice. */
export function sourceFrameFor(i: number, bob: number): number {
  for (let f = 0; f < NODE_COUNT; f++) {
    if (f % 2 === bob && f !== i && f !== (i + 1) % NODE_COUNT) return f;
  }
  /* v8 ignore next 2 -- unreachable: every (i, bob) has 2 valid frames (verified) */
  throw new Error("cascadeCompose: no valid source frame (unreachable)");
}

function copyBox(dst: Grid, src: Grid, box: NodeBox): void {
  for (let r = box.rr; r <= box.r2; r++) {
    for (let c = box.c; c <= box.c2; c++) dst[r][c] = src[r][c];
  }
}

/** Composes one frame of the chain from engine state: each living node's box
 * is pasted from a bob-matching `cascadeFinal` source (the carrier's own box
 * + ping burst from `cascadeFinal(carrier)` itself), each dead node's box
 * from the memoized `cascadeDark(NODE_COUNT, bob)` husk reference, then links
 * are drawn fresh between LIVING neighbors only (hot edge = `boss.lastHop`)
 * — explicitly nulling any non-living pair's 3 link-dot cells, since
 * `cascadeFinal` always draws all 5 links unconditionally and a living node's
 * own box copy can carry one of its neighbor's stale link-dot pixels inside
 * its own footprint (verified: 10 of 12 living-node/parity box slices embed
 * one). No final `eOutline` pass — every pasted box is already outlined by
 * its source frame, and pass-1 verified boxes are pairwise non-adjacent
 * (never touch, even across bob values), so each box's outline is fully
 * local and survives the paste unchanged. */
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
