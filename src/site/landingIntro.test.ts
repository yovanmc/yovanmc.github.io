import { describe, expect, it } from "vitest";
import { NO_TAIL, introStart, onGestureTail, onIntroInput, type GestureTail, type IntroInput } from "./landingIntro";

const key = (k: string, extra: Partial<IntroInput> = {}): IntroInput => ({ kind: "key", key: k, focusAtRoot: true, target: "other", ...extra });
const press = (target: IntroInput["target"], extra: Partial<IntroInput> = {}): IntroInput => ({ kind: "pointer", focusAtRoot: true, target, ...extra });
const click = (target: IntroInput["target"], extra: Partial<IntroInput> = {}): IntroInput => ({ kind: "click", focusAtRoot: true, target, ...extra });

describe("introStart", () => {
  it.each([
    { name: "plays the intro on the first visit of a page load", played: false, reduced: false, expected: { phase: "intro", fade: false } },
    { name: "opens settled once the intro has played", played: true, reduced: false, expected: { phase: "settled", fade: false } },
    { name: "opens settled under reduced motion, fading in the first time", played: false, reduced: true, expected: { phase: "settled", fade: true } },
    { name: "opens settled under reduced motion, without a fade once the intro has played", played: true, reduced: true, expected: { phase: "settled", fade: false } },
  ])("$name", ({ played, reduced, expected }) => {
    expect(introStart(played, reduced)).toEqual(expected);
  });
});

describe("onIntroInput during the intro", () => {
  it.each(["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])("skips on %j with focus at the root", (k) => {
    expect(onIntroInput("intro", key(k))).toBe("skip");
  });

  it.each([
    { name: "skips on the legacy arrow key name Down", input: key("Down"), expected: "skip" },
    { name: "skips on the legacy space key name Spacebar", input: key("Spacebar"), expected: "skip" },
    { name: "skips on a pointer press on the scene or the copy text", input: press("other"), expected: "skip" },
    { name: "skips on a pointer press on a row", input: press("row"), expected: "skip" },
    { name: "skips on a pointer press wherever focus is, unlike a key", input: press("other", { focusAtRoot: false }), expected: "skip" },
    { name: "passes Enter when focus is not at the root, unlike a pointer press", input: key("Enter", { focusAtRoot: false }), expected: "pass" },
    { name: "passes a key event that reports no key", input: { kind: "key", focusAtRoot: true, target: "other" }, expected: "pass" },
    { name: "passes an unlisted key: a", input: key("a"), expected: "pass" },
    { name: "passes an unlisted key: Escape", input: key("Escape"), expected: "pass" },
    { name: "passes an unlisted key: F5", input: key("F5"), expected: "pass" },
    { name: "passes Tab (Shift is not a modifier the policy reads)", input: key("Tab"), expected: "pass" },
    { name: "passes a listed key held with Ctrl", input: key("Enter", { ctrl: true }), expected: "pass" },
    { name: "passes a listed key held with Alt", input: key("ArrowDown", { alt: true }), expected: "pass" },
    { name: "passes a listed key held with Meta", input: key(" ", { meta: true }), expected: "pass" },
    {
      name: "passes Enter while a skip link or any control has focus",
      input: key("Enter", { focusAtRoot: false, target: "control", targetFocused: true }),
      expected: "pass",
    },
    {
      name: "passes Enter while a row has focus",
      input: key("Enter", { focusAtRoot: false, target: "row", targetFocused: true }),
      expected: "pass",
    },
    { name: "passes a pointer press on a footer link or skip link", input: press("control"), expected: "pass" },
    {
      name: "passes a screen reader's synthetic click on a focused link",
      input: click("control", { focusAtRoot: false, targetFocused: true }),
      expected: "pass",
    },
    {
      name: "passes a synthetic click on the focused row, which ignores it while disabled",
      input: click("row", { focusAtRoot: false, targetFocused: true }),
      expected: "pass",
    },
    { name: "skips on a synthetic click on an unfocused row", input: click("row"), expected: "skip" },
  ] as { name: string; input: IntroInput; expected: "skip" | "pass" }[])("$name", ({ input, expected }) => {
    expect(onIntroInput("intro", input)).toBe(expected);
  });
});

describe("onIntroInput once settled", () => {
  it("passes every input", () => {
    expect(onIntroInput("settled", key("Enter"))).toBe("pass");
    expect(onIntroInput("settled", press("other"))).toBe("pass");
    expect(onIntroInput("settled", click("row"))).toBe("pass");
  });
});

// After a skip, the rest of that gesture is consumed: the key's repeats and
// its keyup, or the press's mouse events and click. A gesture whose tail
// never arrives (a right-click, a cancelled pointer, a lost keyup) must not
// swallow the next real one.
describe("onGestureTail", () => {
  const afterKey = (k: string): GestureTail => ({ key: k, pointer: false });
  const afterPress: GestureTail = { key: null, pointer: true };

  it("consumes the skipping key's repeats, then its keyup, and lets the next key through", () => {
    let r = onGestureTail(afterKey("Enter"), { type: "keydown", key: "Enter", repeat: true });
    expect(r.consume).toBe(true);
    r = onGestureTail(r.tail, { type: "keyup", key: "Enter" });
    expect(r).toEqual({ consume: true, tail: NO_TAIL });
    expect(onGestureTail(r.tail, { type: "keydown", key: "Enter", repeat: false }).consume).toBe(false);
  });

  it("lets a fresh press of the skipping key through and closes the tail when its keyup was lost", () => {
    expect(onGestureTail(afterKey("Enter"), { type: "keydown", key: "Enter", repeat: false })).toEqual({ consume: false, tail: NO_TAIL });
  });

  it("leaves other keys alone while a key tail is open", () => {
    expect(onGestureTail(afterKey("Enter"), { type: "keydown", key: "a", repeat: false })).toEqual({ consume: false, tail: afterKey("Enter") });
    expect(onGestureTail(afterKey("Enter"), { type: "keyup", key: "a" })).toEqual({ consume: false, tail: afterKey("Enter") });
  });

  it("consumes the press's mouse events and its click, then lets the next click through", () => {
    expect(onGestureTail(afterPress, { type: "pointerup" }).consume).toBe(true);
    const r = onGestureTail(afterPress, { type: "click" });
    expect(r).toEqual({ consume: true, tail: NO_TAIL });
    expect(onGestureTail(r.tail, { type: "click" }).consume).toBe(false);
  });

  it("drops a press tail that a right-click or a cancelled pointer never finishes", () => {
    for (const type of ["contextmenu", "auxclick", "pointercancel"] as const) {
      expect(onGestureTail(afterPress, { type })).toEqual({ consume: false, tail: NO_TAIL });
    }
  });

  it("drops a stale press tail when a new press starts", () => {
    expect(onGestureTail(afterPress, { type: "pointerdown" })).toEqual({ consume: false, tail: NO_TAIL });
  });

  it("drops every tail when the window loses focus", () => {
    expect(onGestureTail({ key: "Enter", pointer: true }, { type: "blur" })).toEqual({ consume: false, tail: NO_TAIL });
  });
});
