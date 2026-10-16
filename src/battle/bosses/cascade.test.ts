import { describe, expect, it } from "vitest";
import {
  damageNode,
  fallForwardIfCarrierDied,
  fanOutNodes,
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

/** Kills a node outright, bypassing the carrier shield. */
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

  it("battle starts with the pulse ON node 0", () => {
    expect(spawnCascade().carrier).toBe(0);
  });

  it("has no prior hop and a fresh stormIn of 2 (ceil(6/3), loop completes every 2 boss turns at full chain)", () => {
    const boss = spawnCascade();
    expect(boss.lastHop).toBeNull();
    expect(boss.stormIn).toBe(2);
  });
});

describe("livingNodeIds", () => {
  it("ring order is every alive node ascending by id", () => {
    expect(livingNodeIds(spawnCascade())).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("dead nodes stay as husks in the ring: skipped by livingNodeIds", () => {
    let boss = spawnCascade();
    boss = kill(boss, 0);
    boss = kill(boss, 1);
    expect(livingNodeIds(boss)).toEqual([2, 3, 4, 5]);
  });
});

describe("turnsUntilStorm — pulse speed 3 living/turn, constant; CT never slows it (no ct param exists)", () => {
  it.each([
    { name: "fresh chain (6 living, carrier at head): 2 turns to storm", dead: [], expected: 2 },
    { name: "all nodes dead: 0 (no pulse left to move)", dead: [0, 1, 2, 3, 4, 5], expected: 0 },
    // ring = [0, 4]
    { name: "2 living nodes: 1 turn to storm (a storm every turn)", dead: [1, 2, 3, 5], expected: 1 },
    { name: "1 living node (the carrier itself): 1 turn to storm — its 1-node loop always wraps", dead: [1, 2, 3, 4, 5], expected: 1 },
  ])("$name", ({ dead, expected }) => {
    let boss = spawnCascade();
    for (const id of dead) boss = kill(boss, id);
    if (dead.length < NODE_COUNT) boss = { ...boss, carrier: 0 };
    expect(turnsUntilStorm(boss)).toBe(expected);
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

describe("the pulse block triggers on ARRIVAL only", () => {
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
  it.each([
    { name: "halves damage dealt to the current carrier, floored", carrier: 2, dead: [], node: 2, dmg: 11, hp: 20, alive: true },
    { name: "applies full damage to a non-carrier node", carrier: 2, dead: [], node: 0, dmg: 11, hp: 14, alive: true },
    // carrier 9: no shield in play
    { name: "kills a node at exactly 0 HP and flips alive false", carrier: 9, dead: [], node: 0, dmg: 25, hp: 0, alive: false },
    { name: "clamps at 0 rather than going negative", carrier: 9, dead: [], node: 0, dmg: 999, hp: 0, alive: false },
    { name: "is a no-op against an already-dead node", carrier: 0, dead: [0], node: 0, dmg: 25, hp: 0, alive: false },
  ])("$name", ({ carrier, dead, node, dmg, hp, alive }) => {
    let boss: CascadeBoss = { ...spawnCascade(), carrier };
    for (const id of dead) boss = kill(boss, id);
    const after = damageNode(boss, node, dmg);
    expect(after.nodes.find((n) => n.id === node)!.hp).toBe(hp);
    expect(after.nodes.find((n) => n.id === node)!.alive).toBe(alive);
  });
});

describe("Fan Out vs the chain (base 8, CT -> 12 via dealtDamage — every living node hit, carrier shield still applies per-node)", () => {
  it.each([
    // carrier 0 takes floor(dmg / 2), every other node takes dmg
    { name: "uncT'd: 8 to every living node, 4 to the carrier", ct: false, conviction: false, carrierHp: 21, otherHp: 17 },
    { name: "CT'd: dealtDamage(8, true, false) = 12 to every living node, 6 to the carrier", ct: true, conviction: false, carrierHp: 19, otherHp: 13 },
    { name: "threads Conviction too (dealtDamage(8, false, true) = 16, carrier floor(16/2) = 8)", ct: false, conviction: true, carrierHp: 17, otherHp: 9 },
  ])("$name", ({ ct, conviction, carrierHp, otherHp }) => {
    const boss: CascadeBoss = { ...spawnCascade(), carrier: 0 };
    const after = fanOutNodes(boss, ct, conviction);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(carrierHp);
    for (const id of [1, 2, 3, 4, 5]) {
      expect(after.nodes.find((n) => n.id === id)!.hp).toBe(otherHp);
    }
  });

  it("never touches an already-dead node", () => {
    const boss = kill({ ...spawnCascade(), carrier: 9 }, 0);
    const after = fanOutNodes(boss, false, false);
    expect(after.nodes.find((n) => n.id === 0)!.hp).toBe(0);
    expect(after.nodes.find((n) => n.id === 0)!.alive).toBe(false);
  });
});

describe("carrier killed on a HERO turn falls forward, with no reset and no storm", () => {
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
