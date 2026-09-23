// The keydown handler must step aside when a native activation target has
// focus, or Enter/Space would be handled twice. Only the focused element is
// checked, no ancestor walk, so a tabindex="-1" child under a focusable
// role=button root never matches. Tested with plain objects (no jsdom); the
// predicate is equivalent to
// `a[href],button,input,textarea,select,[role=button][tabindex='0']` for any
// real Element.
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
