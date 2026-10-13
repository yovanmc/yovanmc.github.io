import { describe, expect, it } from "vitest";
import { NO_TAIL, introStart, onGestureTail, onIntroInput, type GestureTail, type IntroInput } from "./landingIntro";

const key = (k: string, extra: Partial<IntroInput> = {}): IntroInput => ({ kind: "key", key: k, focusAtRoot: true, target: "other", ...extra });
const press = (target: IntroInput["target"], extra: Partial<IntroInput> = {}): IntroInput => ({ kind: "pointer", focusAtRoot: true, target, ...extra });
const click = (target: IntroInput["target"], extra: Partial<IntroInput> = {}): IntroInput => ({ kind: "click", focusAtRoot: true, target, ...extra });

describe("introStart", () => {
  it("plays the intro on the first visit of a page load", () => {
    expect(introStart(false, false)).toEqual({ phase: "intro", fade: false });
  });

  it("opens settled once the intro has played", () => {
    expect(introStart(true, false)).toEqual({ phase: "settled", fade: false });
  });

  it("opens settled under reduced motion, fading in only the first time", () => {
    expect(introStart(false, true)).toEqual({ phase: "settled", fade: true });
    expect(introStart(true, true)).toEqual({ phase: "settled", fade: false });
  });
});

describe("onIntroInput during the intro", () => {
  it.each(["Enter", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"])("skips on %j with focus at the root", (k) => {
    expect(onIntroInput("intro", key(k))).toBe("skip");
  });

  it("skips on the legacy arrow and space key names", () => {
    expect(onIntroInput("intro", key("Down"))).toBe("skip");
    expect(onIntroInput("intro", key("Spacebar"))).toBe("skip");
  });

  it("passes a key event that reports no key", () => {
    expect(onIntroInput("intro", { kind: "key", focusAtRoot: true, target: "other" })).toBe("pass");
  });

  it("passes an unlisted key", () => {
    expect(onIntroInput("intro", key("a"))).toBe("pass");
    expect(onIntroInput("intro", key("Escape"))).toBe("pass");
    expect(onIntroInput("intro", key("F5"))).toBe("pass");
  });

  it("passes Tab, with or without Shift (Shift is not a modifier the policy reads)", () => {
    expect(onIntroInput("intro", key("Tab"))).toBe("pass");
  });

  it("passes listed keys held with Ctrl, Alt or Meta", () => {
    expect(onIntroInput("intro", key("Enter", { ctrl: true }))).toBe("pass");
    expect(onIntroInput("intro", key("ArrowDown", { alt: true }))).toBe("pass");
    expect(onIntroInput("intro", key(" ", { meta: true }))).toBe("pass");
  });

  it("passes Enter while a skip link or any control has focus", () => {
    expect(onIntroInput("intro", key("Enter", { focusAtRoot: false, target: "control", targetFocused: true }))).toBe("pass");
    expect(onIntroInput("intro", key("Enter", { focusAtRoot: false, target: "row", targetFocused: true }))).toBe("pass");
  });

  it("skips on a pointer press on the scene, the copy text or a row", () => {
    expect(onIntroInput("intro", press("other"))).toBe("skip");
    expect(onIntroInput("intro", press("row"))).toBe("skip");
  });

  it("skips on a pointer press wherever focus is, unlike a key", () => {
    expect(onIntroInput("intro", press("other", { focusAtRoot: false }))).toBe("skip");
    expect(onIntroInput("intro", key("Enter", { focusAtRoot: false }))).toBe("pass");
  });

  it("passes a pointer press on a footer link or skip link", () => {
    expect(onIntroInput("intro", press("control"))).toBe("pass");
  });

  it("passes a screen reader's synthetic click on a focused link", () => {
    expect(onIntroInput("intro", click("control", { focusAtRoot: false, targetFocused: true }))).toBe("pass");
  });

  it("passes a synthetic click on the focused row, which ignores it while disabled", () => {
    expect(onIntroInput("intro", click("row", { focusAtRoot: false, targetFocused: true }))).toBe("pass");
  });

  it("skips on a synthetic click on an unfocused row", () => {
    expect(onIntroInput("intro", click("row"))).toBe("skip");
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
    let r = onGestureTail(afterKey("Enter"), { type: "keydown", key: "Enter" });
    expect(r.consume).toBe(true);
    r = onGestureTail(r.tail, { type: "keyup", key: "Enter" });
    expect(r).toEqual({ consume: true, tail: NO_TAIL });
    expect(onGestureTail(r.tail, { type: "keydown", key: "Enter" }).consume).toBe(false);
  });

  it("leaves other keys alone while a key tail is open", () => {
    expect(onGestureTail(afterKey("Enter"), { type: "keydown", key: "a" })).toEqual({ consume: false, tail: afterKey("Enter") });
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
