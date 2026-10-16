import { describe, expect, it } from "vitest";
import { coerceRushPrefix, parseActions, parseBoss, parseDefeatedBosses } from "./bootParams";

describe("parseBoss (`boss=` capture key — whitelist = IMPLEMENTED_BOSSES, default alert-storm)", () => {
  it.each([
    { param: null, state: "absent" },
    { param: "", state: "empty" },
  ])("defaults to alert-storm when the param is $state", ({ param }) => {
    expect(parseBoss(param)).toBe("alert-storm");
  });

  it.each(["alert-storm", "cascade", "silent-failure", "imposter-syndrome"])("accepts %s", (id) => {
    expect(parseBoss(id)).toBe(id);
  });

  it("falls back to alert-storm for an id outside the whitelist", () => {
    expect(parseBoss("not-a-real-boss")).toBe("alert-storm");
  });
});

describe("parseDefeatedBosses (`defeated=` capture key — rush-order PREFIX validation after dedupe)", () => {
  it.each([
    { name: "is empty, not rejected, when the param is absent", param: null, expected: { value: [], rejected: false } },
    { name: "is empty, not rejected, when the param is present but blank", param: "", expected: { value: [], rejected: false } },
    { name: "accepts a single-boss prefix", param: "alert-storm", expected: { value: ["alert-storm"], rejected: false } },
    {
      name: "accepts a multi-boss prefix in rush order",
      param: "alert-storm,cascade",
      expected: { value: ["alert-storm", "cascade"], rejected: false },
    },
    {
      name: "accepts the full rush order",
      param: "alert-storm,cascade,silent-failure,imposter-syndrome",
      expected: { value: ["alert-storm", "cascade", "silent-failure", "imposter-syndrome"], rejected: false },
    },
    {
      name: "dedupes a repeated id and still validates",
      param: "alert-storm,alert-storm",
      expected: { value: ["alert-storm"], rejected: false },
    },
    {
      name: "rejects silent-failure alone (rider count and kit derivation would disagree: 110/12 with Root Cause but no Fan Out is unreachable in play)",
      param: "silent-failure",
      expected: { value: [], rejected: true },
    },
    {
      name: "rejects a set that skips an earlier boss (cascade without alert-storm)",
      param: "cascade",
      expected: { value: [], rejected: true },
    },
    {
      name: "rejects an out-of-order prefix (PREFIX means sequence order, not just set membership)",
      param: "cascade,alert-storm",
      expected: { value: [], rejected: true },
    },
    { name: "rejects an unknown id", param: "not-a-real-boss", expected: { value: [], rejected: true } },
    {
      name: "rejects more ids than the rush order has, even if the prefix is otherwise valid",
      param: "alert-storm,cascade,silent-failure,imposter-syndrome,bogus",
      expected: { value: [], rejected: true },
    },
  ])("$name", ({ param, expected }) => {
    expect(parseDefeatedBosses(param)).toEqual(expected);
  });
});

describe("coerceRushPrefix (shared dedupe+prefix-validation core)", () => {
  it.each([
    {
      name: "dedupes preserving first-seen order and validates against the default RUSH_ORDER",
      tokens: ["alert-storm", "alert-storm", "cascade"],
      expected: { value: ["alert-storm", "cascade"], rejected: false },
    },
    {
      name: "rejects an out-of-order token set against the default RUSH_ORDER",
      tokens: ["cascade", "alert-storm"],
      expected: { value: [], rejected: true },
    },
    {
      name: "accepts an empty token list as an empty, non-rejected prefix",
      tokens: [],
      expected: { value: [], rejected: false },
    },
  ])("$name", ({ tokens, expected }) => {
    expect(coerceRushPrefix(tokens)).toEqual(expected);
  });

  it("validates against an explicit non-default rushOrder parameter, not the real RUSH_ORDER", () => {
    const localRoster = ["a", "b", "c"];
    expect(coerceRushPrefix(["a", "b"], localRoster)).toEqual({ value: ["a", "b"], rejected: false });
    // "alert-storm" is valid against the real RUSH_ORDER but not against localRoster.
    expect(coerceRushPrefix(["alert-storm"], localRoster)).toEqual({ value: [], rejected: true });
  });
});

describe("parseActions (`actions=` capture key)", () => {
  it.each([
    { token: "ct", why: "Critical Thinking is untargeted" },
    { token: "fo", why: "Fan Out hits all living targets, no target id" },
    { token: "rb", why: "Rollback is untargeted" },
    { token: "conv", why: "Conviction is untargeted" },
  ])("parses a bare $token token ($why)", ({ token }) => {
    expect(parseActions(token)).toEqual([{ type: token }]);
  });

  it("parses a targeted rc token (Root Cause carries a target id)", () => {
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

  it.each([
    { name: "returns undefined when the param is absent", param: null, expected: undefined },
    { name: "returns undefined when the param is blank", param: "", expected: undefined },
    { name: "drops a targetless rc token (target id required, same rule as attack/pt/debug)", param: "rc", expected: undefined },
    {
      name: "silently drops unrecognized tokens, keeping the recognized ones",
      param: "ct,bogus,fo",
      expected: [{ type: "ct" }, { type: "fo" }],
    },
    { name: "returns undefined when every token is unrecognized", param: "bogus", expected: undefined },
  ])("$name", ({ param, expected }) => {
    expect(parseActions(param)).toEqual(expected);
  });
});
