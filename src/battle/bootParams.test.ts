import { describe, expect, it } from "vitest";
import { parseActions, parseBoss, parseDefeatedBosses } from "./bootParams";

describe("parseBoss (`boss=` capture key — whitelist = IMPLEMENTED_BOSSES, default alert-storm)", () => {
  it("defaults to alert-storm when the param is absent", () => {
    expect(parseBoss(null)).toBe("alert-storm");
  });

  it("defaults to alert-storm when the param is empty", () => {
    expect(parseBoss("")).toBe("alert-storm");
  });

  it("accepts alert-storm", () => {
    expect(parseBoss("alert-storm")).toBe("alert-storm");
  });

  it("accepts cascade (implemented as of PR-1b)", () => {
    expect(parseBoss("cascade")).toBe("cascade");
  });

  it("accepts silent-failure (implemented as of PR-2)", () => {
    expect(parseBoss("silent-failure")).toBe("silent-failure");
  });

  it("accepts imposter-syndrome (implemented as of PR-3)", () => {
    expect(parseBoss("imposter-syndrome")).toBe("imposter-syndrome");
  });

  it("falls back to alert-storm for a fake id (E3 reconciliation: the roster is now complete, so the G1 anti-crash fallback must outlive roster completion — probed with a literal fake id rather than a real-but-unimplemented one, since none remains)", () => {
    expect(parseBoss("not-a-real-boss")).toBe("alert-storm");
  });

  it("rejects garbage input, falling back to alert-storm", () => {
    expect(parseBoss("not-a-real-boss")).toBe("alert-storm");
  });
});

describe("parseDefeatedBosses (`defeated=` capture key — rush-order PREFIX validation after dedupe)", () => {
  it("is empty, not rejected, when the param is absent", () => {
    expect(parseDefeatedBosses(null)).toEqual({ value: [], rejected: false });
  });

  it("is empty, not rejected, when the param is present but blank", () => {
    expect(parseDefeatedBosses("")).toEqual({ value: [], rejected: false });
  });

  it("accepts a single-boss prefix", () => {
    expect(parseDefeatedBosses("alert-storm")).toEqual({ value: ["alert-storm"], rejected: false });
  });

  it("accepts a multi-boss prefix in rush order", () => {
    expect(parseDefeatedBosses("alert-storm,cascade")).toEqual({
      value: ["alert-storm", "cascade"],
      rejected: false,
    });
  });

  it("accepts the full rush order", () => {
    expect(parseDefeatedBosses("alert-storm,cascade,silent-failure,imposter-syndrome")).toEqual({
      value: ["alert-storm", "cascade", "silent-failure", "imposter-syndrome"],
      rejected: false,
    });
  });

  it("dedupes a repeated id and still validates", () => {
    expect(parseDefeatedBosses("alert-storm,alert-storm")).toEqual({
      value: ["alert-storm"],
      rejected: false,
    });
  });

  it("rejects the pinned dissect-F8 example: silent-failure alone (rider count and kit derivation would disagree — 110/12 with Root Cause but no Fan Out is unreachable in play)", () => {
    expect(parseDefeatedBosses("silent-failure")).toEqual({ value: [], rejected: true });
  });

  it("rejects a set that skips an earlier boss (cascade without alert-storm)", () => {
    expect(parseDefeatedBosses("cascade")).toEqual({ value: [], rejected: true });
  });

  it("rejects an out-of-order prefix (PREFIX means sequence order, not just set membership)", () => {
    expect(parseDefeatedBosses("cascade,alert-storm")).toEqual({ value: [], rejected: true });
  });

  it("rejects an unknown id", () => {
    expect(parseDefeatedBosses("not-a-real-boss")).toEqual({ value: [], rejected: true });
  });

  it("rejects more ids than the rush order has, even if the prefix is otherwise valid", () => {
    expect(
      parseDefeatedBosses("alert-storm,cascade,silent-failure,imposter-syndrome,bogus"),
    ).toEqual({ value: [], rejected: true });
  });
});

describe("parseActions (`actions=` capture key — extends the M5 grammar with `fo`)", () => {
  it("returns undefined when the param is absent", () => {
    expect(parseActions(null)).toBeUndefined();
  });

  it("returns undefined when the param is blank", () => {
    expect(parseActions("")).toBeUndefined();
  });

  it("parses a bare ct token", () => {
    expect(parseActions("ct")).toEqual([{ type: "ct" }]);
  });

  it("parses a bare fo token (Fan Out hits all living targets, no target id)", () => {
    expect(parseActions("fo")).toEqual([{ type: "fo" }]);
  });

  it("parses a bare rb token (Rollback is untargeted, M6 PR-2 task 5 — the grammar was specified in PR-1a task 5 but rb was not a valid AbilityId until PR-2 task 4)", () => {
    expect(parseActions("rb")).toEqual([{ type: "rb" }]);
  });

  it("parses a bare conv token (Conviction is untargeted, M6 PR-3 task 5)", () => {
    expect(parseActions("conv")).toEqual([{ type: "conv" }]);
  });

  it("parses a targeted rc token (Root Cause carries a target id, M6 PR-3 task 5)", () => {
    expect(parseActions("rc:1")).toEqual([{ type: "rc", target: 1 }]);
  });

  it("parses targeted tokens (attack/pt/debug/rc carry a bat id)", () => {
    expect(parseActions("attack:3")).toEqual([{ type: "attack", target: 3 }]);
    expect(parseActions("debug:5,pt:2,rc:0")).toEqual([
      { type: "debug", target: 5 },
      { type: "pt", target: 2 },
      { type: "rc", target: 0 },
    ]);
  });

  it("drops a targetless rc token (target id required, same rule as attack/pt/debug)", () => {
    expect(parseActions("rc")).toBeUndefined();
  });

  it("silently drops unrecognized tokens (today's path), keeping the recognized ones", () => {
    expect(parseActions("ct,bogus,fo")).toEqual([{ type: "ct" }, { type: "fo" }]);
  });

  it("returns undefined when every token is unrecognized", () => {
    expect(parseActions("bogus")).toBeUndefined();
  });
});
