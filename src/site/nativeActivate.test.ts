// The global keydown handler must step aside when a native activation target
// already has focus, so Enter/Space on a focused <a>/<button>/etc. isn't
// double-handled (once by the browser's own activation, once by App's
// arrow-key/menu logic). The predicate checks the FOCUSED ELEMENT ONLY - no
// closest()/ancestor walk - so a tabindex="-1" child sitting under a
// tabindex="0" role=button root (the play command-menu rows, which
// intentionally stay non-focusable divs) never falsely matches through its
// ancestor.
//
// Tested against plain object literals, not a real DOM Element: this repo's
// vitest config runs a node environment with no jsdom.
// isNativeActivationTarget() is written against the small structural
// ActivationElement interface (tagName/hasAttribute/getAttribute) rather than
// calling el.matches(...) directly, so it is equivalent in behavior to the
// selector `a[href],button,input,textarea,select,[role=button][tabindex='0']`
// for any real DOM Element (which satisfies this interface natively) while
// staying testable without a DOM at all.
import { describe, expect, it } from "vitest";
import { isNativeActivationTarget, type ActivationElement } from "./nativeActivate";

function el(tagName: string, attrs: Record<string, string> = {}): ActivationElement {
  return {
    tagName,
    hasAttribute: (name) => name in attrs,
    getAttribute: (name) => (name in attrs ? attrs[name] : null),
  };
}

describe("isNativeActivationTarget", () => {
  it("null is never a native activation target", () => {
    expect(isNativeActivationTarget(null)).toBe(false);
  });

  it("a real anchor with href is a native activation target", () => {
    expect(isNativeActivationTarget(el("A", { href: "/work/mia/" }))).toBe(true);
  });

  it("an anchor with no href is not a native activation target", () => {
    expect(isNativeActivationTarget(el("A"))).toBe(false);
  });

  it("a real button is a native activation target", () => {
    expect(isNativeActivationTarget(el("BUTTON"))).toBe(true);
  });

  it("input, textarea, select are native activation targets", () => {
    expect(isNativeActivationTarget(el("INPUT"))).toBe(true);
    expect(isNativeActivationTarget(el("TEXTAREA"))).toBe(true);
    expect(isNativeActivationTarget(el("SELECT"))).toBe(true);
  });

  it("role=button with tabindex=0 is a native activation target", () => {
    expect(isNativeActivationTarget(el("DIV", { role: "button", tabindex: "0" }))).toBe(true);
  });

  it("role=button with tabindex=-1 is NOT a native activation target (the play command-menu rows)", () => {
    expect(isNativeActivationTarget(el("DIV", { role: "button", tabindex: "-1" }))).toBe(false);
  });

  it("role=button with no tabindex is not a native activation target", () => {
    expect(isNativeActivationTarget(el("DIV", { role: "button" }))).toBe(false);
  });

  it("a plain div is not a native activation target", () => {
    expect(isNativeActivationTarget(el("DIV"))).toBe(false);
  });

  it("lowercase tag names (as some DOM implementations report) are handled case-insensitively", () => {
    expect(isNativeActivationTarget(el("a", { href: "/x" }))).toBe(true);
    expect(isNativeActivationTarget(el("button"))).toBe(true);
  });
});
