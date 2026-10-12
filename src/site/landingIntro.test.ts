import { describe, expect, it } from "vitest";
import { introStart, onIntroInput, type IntroInput } from "./landingIntro";

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
