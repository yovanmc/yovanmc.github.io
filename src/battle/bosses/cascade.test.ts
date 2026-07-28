import { describe, expect, it } from "vitest";
import {
  damageNode,
  fallForwardIfCarrierDied,
  fanOutNodes,
  headNode,
  isCascadeDefeated,
  livingNodeIds,
  markNode,
  NODE_COUNT,
  NODE_HP,
  resolveCascadeBossTurn,
  spawnCascade,
  turnsUntilStorm,
} from "./cascade";
import type { CascadeBoss } from "./cascade";

/** Kill a node outright for test setup (bypasses the carrier-shield math —
 * tests that care about the shield call damageNode directly). */
function kill(boss: CascadeBoss, nodeId: number): CascadeBoss {
  const nodes = boss.nodes.map((n) => (n.id === nodeId ? { ...n, hp: 0, alive: false } : n));
  return { ...boss, nodes };
}

describe("spawnCascade", () => {
  it("spawns six nodes at 25/25 HP, alive, unmarked, ids 0..5", () => {
    const boss = spawnCascade();
    expect(boss.nodes).toHaveLength(NODE_COUNT);
    expect(NODE_HP).toBe(25);
    boss.nodes.forEach((n, i) => {
      expect(n.id).toBe(i);
      expect(n.hp).toBe(25);
      expect(n.maxHp).toBe(25);
      expect(n.alive).toBe(true);
      expect(n.marked).toBe(false);
    });
  });

  it("(a) battle starts with the pulse ON node 0", () => {
    expect(spawnCascade().carrier).toBe(0);
  });

  it("has no prior hop and a fresh stormIn of 2 (ceil(6/3), loop completes every 2 boss turns at full chain)", () => {
    const boss = spawnCascade();
    expect(boss.lastHop).toBeNull();
    expect(boss.stormIn).toBe(2);
  });
});

describe("livingNodeIds / headNode — (b) head = lowest-index LIVING node", () => {
  it("ring order is every alive node ascending by id", () => {
    expect(livingNodeIds(spawnCascade())).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("dead nodes stay as husks in the ring: skipped by livingNodeIds, head shifts to the next living id", () => {
    let boss = spawnCascade();
    boss = kill(boss, 0);
    boss = kill(boss, 1);
    expect(livingNodeIds(boss)).toEqual([2, 3, 4, 5]);
    expect(headNode(boss)).toBe(2);
  });

  it("head node on the fresh boss is node 0", () => {
    expect(headNode(spawnCascade())).toBe(0);
  });
});

describe("turnsUntilStorm — pulse speed 3 living/turn, constant; CT never slows it (no ct param exists)", () => {
  it("fresh chain (6 living, carrier at head): 2 turns to storm", () => {
    expect(turnsUntilStorm(spawnCascade())).toBe(2);
  });

  it("all nodes dead: 0 (no pulse left to move)", () => {
    let boss = spawnCascade();
    for (let id = 0; id < NODE_COUNT; id++) boss = kill(boss, id);
    expect(turnsUntilStorm(boss)).toBe(0);
  });

  it("2 living nodes: 1 turn to storm (a storm every turn, per the signed table)", () => {
    let boss = spawnCascade();
    boss = kill(boss, 1);
    boss = kill(boss, 2);
    boss = kill(boss, 3);
    boss = kill(boss, 5);
    boss = { ...boss, carrier: 0 }; // ring = [0, 4]
    expect(turnsUntilStorm(boss)).toBe(1);
  });

  it("1 living node (the carrier itself): 1 turn to storm — its 1-node loop always wraps", () => {
    let boss = spawnCascade();
    for (const id of [1, 2, 3, 4, 5]) boss = kill(boss, id);
    boss = { ...boss, carrier: 0 };
    expect(turnsUntilStorm(boss)).toBe(1);
  });
});

describe("resolveCascadeBossTurn — jolt (non-storm boss turn: 9, CT -> 7)", () => {
  it("uncT'd: jolt 9, pulse lands 3 ring-steps ahead (node 3), stormIn recomputed to 1", () => {
    const { boss, outcome, heroDamage } = resolveCascadeBossTurn(spawnCascade(), false, false);
    expect(outcome).toBe("jolt");
    expect(heroDamage).toBe(9);
    expect(boss.carrier).toBe(3);
    expect(boss.lastHop).toEqual([0, 3]);
    expect(boss.stormIn).toBe(1);
  });

  it("CT'd: jolt takenDamage(9, true, false) = round(6.75) = 7 — same landing node as uncT'd (CT never slows the pulse)", () => {
    const ctd = resolveCascadeBossTurn(spawnCascade(), true, false);
    const plain = resolveCascadeBossTurn(spawnCascade(), false, false);
    expect(ctd.outcome).toBe("jolt");
    expect(ctd.heroDamage).toBe(7);
    expect(ctd.boss.carrier).toBe(plain.boss.carrier);
  });
});

describe("resolveCascadeBossTurn — loop/storm (wrap = loop complete: storm 25, CT -> 19, instead of the jolt; pulse restarts at head)", () => {
  it("wrapping past the tail fires a storm instead of a jolt and resets the pulse to head", () => {
    const midChain: CascadeBoss = { ...spawnCascade(), carrier: 3 }; // ring[3]=3, idx3, 3+3=6>=6 -> wrap
    const { boss, outcome, heroDamage } = resolveCascadeBossTurn(midChain, false, false);
    expect(outcome).toBe("storm");
    expect(heroDamage).toBe(25);
    expect(boss.carrier).toBe(0);
    expect(boss.lastHop).toBeNull();
    expect(boss.stormIn).toBe(2); // full 6-node ring again, back at head
  });

  it("CT'd storm: takenDamage(25, true, false) = round(18.75) = 19", () => {
    const midChain: CascadeBoss = { ...spawnCascade(), carrier: 3 };
    const { outcome, heroDamage } = resolveCascadeBossTurn(midChain, true, false);
    expect(outcome).toBe("storm");
    expect(heroDamage).toBe(19);
  });

  it("jolt vs storm exclusivity: a resolution is exactly one outcome, never both a jolt AND a storm amount", () => {
    const jolt = resolveCascadeBossTurn(spawnCascade(), false, false);
    const storm = resolveCascadeBossTurn({ ...spawnCascade(), carrier: 3 }, false, false);
    expect([jolt.outcome, storm.outcome].sort()).toEqual(["jolt", "storm"]);
    expect(jolt.heroDamage).not.toBe(storm.heroDamage);
  });
});

describe("resolveCascadeBossTurn — Debug block / absorb (an absorb replaces the boss turn's damage entirely: no storm AND no jolt)", () => {
  it("pulse arriving at a marked node is absorbed: no damage, pulse resets to head, the mark burns out", () => {
    const offCenter: CascadeBoss = { ...spawnCascade(), carrier: 1 }; // idx1, lands ring[4]=4
    const marked = markNode(offCenter, 4);
    const { boss, outcome, heroDamage } = resolveCascadeBossTurn(marked, false, false);
    expect(outcome).toBe("absorbed");
    expect(heroDamage).toBe(0);
    expect(boss.carrier).toBe(0); // reset to head
    expect(boss.lastHop).toBeNull();
    expect(boss.nodes.find((n) => n.id === 4)!.marked).toBe(false); // consumed on block
  });

  it("absorb also fizzles under CT (no storm AND no jolt regardless of CT)", () => {
    const offCenter: CascadeBoss = { ...spawnCascade(), carrier: 1 };
    const marked = markNode(offCenter, 4);
    const { outcome, heroDamage } = resolveCascadeBossTurn(marked, true, false);
    expect(outcome).toBe("absorbed");
    expect(heroDamage).toBe(0);
  });
});

describe("pulse micro-rule (e): the block triggers on ARRIVAL only", () => {
  it("marking the CURRENT carrier blocks nothing — the pulse leaves, it never arrives there", () => {
    const boss = markNode(spawnCascade(), 0); // node 0 IS the current carrier
    const { outcome, boss: after } = resolveCascadeBossTurn(boss, false, false);
    expect(outcome).toBe("jolt"); // unaffected — landing is node 3, not node 0
    expect(after.carrier).toBe(3);
    expect(boss.nodes.find((n) => n.id === 0)!.marked).toBe(true); // still marked, nothing consumed it
  });

  it("a reset/fall placement is NOT an arrival: a marked head does not block the storm that resets onto it", () => {
    let boss = spawnCascade();
    for (const id of [1, 2, 3, 4, 5]) boss = kill(boss, id); // only node 0 survives
    boss = { ...boss, carrier: 0 };
    boss = markNode(boss, 0); // mark the lone survivor, currently head AND carrier
    const { boss: after, outcome, heroDamage } = resolveCascadeBossTurn(boss, false, false);
    expect(outcome).toBe("storm"); // wraps every turn at 1 living node — not absorbed
    expect(heroDamage).toBe(25);
    expect(after.carrier).toBe(0);
    expect(after.nodes.find((n) => n.id === 0)!.marked).toBe(true); // NOT consumed — reset isn't an arrival
  });
});

describe("carrier shield: the node carrying the pulse takes HALF damage, rounded down, from every source", () => {
  it("halves damage dealt to the current carrier, floored", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 2 };
    const after = damageNode(boss, 2, 11); // floor(11/2) = 5
    expect(after.nodes.find((n) => n.id === 2)!.hp).toBe(20);
  });

  it("applies full damage to a non-carrier node", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 2 };
    const after = damageNode(boss, 0, 11);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(14);
  });

  it("kills a node at exactly 0 HP and flips alive false", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 9 }; // no shield in play
    const after = damageNode(boss, 0, 25);
    const node0 = after.nodes.find((n) => n.id === 0)!;
    expect(node0.hp).toBe(0);
    expect(node0.alive).toBe(false);
  });

  it("clamps at 0 rather than going negative", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 9 };
    const after = damageNode(boss, 0, 999);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(0);
  });

  it("is a no-op against an already-dead node", () => {
    const boss = kill(spawnCascade(), 0);
    const after = damageNode(boss, 0, 25);
    const node0 = after.nodes.find((n) => n.id === 0)!;
    expect(node0.hp).toBe(0);
    expect(node0.alive).toBe(false);
  });
});

describe("Fan Out vs the chain (base 8, CT -> 12 via dealtDamage — every living node hit, carrier shield still applies per-node)", () => {
  it("uncT'd: 8 to every living node, 4 to the carrier", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 0 };
    const after = fanOutNodes(boss, false, false);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(21); // 25 - floor(8/2)
    for (const id of [1, 2, 3, 4, 5]) {
      expect(after.nodes.find((n) => n.id === id)!.hp).toBe(17); // 25 - 8
    }
  });

  it("CT'd: dealtDamage(8, true, false) = 12 to every living node, 6 to the carrier", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 0 };
    const after = fanOutNodes(boss, true, false);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(19); // 25 - floor(12/2)
    for (const id of [1, 2, 3, 4, 5]) {
      expect(after.nodes.find((n) => n.id === id)!.hp).toBe(13); // 25 - 12
    }
  });

  it("threads Conviction too (dealtDamage(8, false, true) = 16, carrier floor(16/2) = 8)", () => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 0 };
    const after = fanOutNodes(boss, false, true);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(17); // 25 - 8
    expect(after.nodes.find((n) => n.id === 1)!.hp).toBe(9); // 25 - 16
  });

  it("never touches an already-dead node", () => {
    const boss = kill({ ...spawnCascade(), carrier: 9 }, 0);
    const after = fanOutNodes(boss, false, false);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(0);
    expect(after.nodes.find((n) => n.id === 0)!.alive).toBe(false);
  });
});

describe("pulse micro-rule (c): carrier killed on a HERO turn falls forward — no reset, no storm", () => {
  it("is a no-op while the carrier is still alive", () => {
    const boss = spawnCascade();
    expect(fallForwardIfCarrierDied(boss)).toEqual(boss);
  });

  it("falls forward to the next living node in ring order when the carrier just died", () => {
    let boss: CascadeBoss = { ...spawnCascade(), carrier: 2, lastHop: [1, 2] };
    boss = kill(boss, 2); // carrier itself dies; 0,1,3,4,5 still alive
    const after = fallForwardIfCarrierDied(boss);
    expect(after.carrier).toBe(3); // next living id > 2
    expect(after.lastHop).toEqual([1, 2]); // untouched — this is NOT a reset
  });

  it("wraps to the lowest living id when the dead carrier was the tail", () => {
    let boss: CascadeBoss = { ...spawnCascade(), carrier: 5 };
    boss = kill(boss, 5); // tail dies; 0-4 still alive
    const after = fallForwardIfCarrierDied(boss);
    expect(after.carrier).toBe(0);
  });

  it("is a no-op when the dead carrier was the last living node (fight already over)", () => {
    let boss = spawnCascade();
    for (const id of [1, 2, 3, 4, 5]) boss = kill(boss, id);
    boss = { ...boss, carrier: 0 };
    boss = kill(boss, 0); // the last node dies
    const after = fallForwardIfCarrierDied(boss);
    expect(after.carrier).toBe(0); // nothing living to fall onto — left as-is
    expect(isCascadeDefeated(after)).toBe(true);
  });
});

describe("node death + loop-period shrink (storms accelerate as the chain shortens)", () => {
  it("killing the first three nodes leaves a 3-node ring that wraps (storms) every turn", () => {
    let boss = spawnCascade();
    boss = kill(boss, 0);
    boss = kill(boss, 1);
    boss = kill(boss, 2);
    boss = { ...boss, carrier: 3 };
    expect(livingNodeIds(boss)).toEqual([3, 4, 5]);
    expect(turnsUntilStorm(boss)).toBe(1);
    const { outcome } = resolveCascadeBossTurn(boss, false, false);
    expect(outcome).toBe("storm");
  });
});

describe("isCascadeDefeated — victory: all six nodes destroyed", () => {
  it("false while any node is alive", () => {
    let boss = spawnCascade();
    for (const id of [0, 1, 2, 3, 4]) boss = kill(boss, id);
    expect(isCascadeDefeated(boss)).toBe(false);
  });

  it("true once every node is dead", () => {
    let boss = spawnCascade();
    for (let id = 0; id < NODE_COUNT; id++) boss = kill(boss, id);
    expect(isCascadeDefeated(boss)).toBe(true);
  });
});
