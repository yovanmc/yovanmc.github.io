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
  it.each([
    { name: "null is never a native activation target", element: null, expected: false },
    { name: "a real anchor with href is a native activation target", element: el("A", { href: "/work/mia/" }), expected: true },
    { name: "an anchor with no href is not a native activation target", element: el("A"), expected: false },
    { name: "a real button is a native activation target", element: el("BUTTON"), expected: true },
    { name: "input is a native activation target", element: el("INPUT"), expected: true },
    { name: "textarea is a native activation target", element: el("TEXTAREA"), expected: true },
    { name: "select is a native activation target", element: el("SELECT"), expected: true },
    { name: "role=button with tabindex=0 is a native activation target", element: el("DIV", { role: "button", tabindex: "0" }), expected: true },
    {
      name: "role=button with tabindex=-1 is NOT a native activation target (the play command-menu rows)",
      element: el("DIV", { role: "button", tabindex: "-1" }),
      expected: false,
    },
    { name: "role=button with no tabindex is not a native activation target", element: el("DIV", { role: "button" }), expected: false },
    { name: "a plain div is not a native activation target", element: el("DIV"), expected: false },
    // lowercase tag names, as some DOM implementations report, are handled case-insensitively
    { name: "a lowercase anchor tag name with href is a native activation target", element: el("a", { href: "/x" }), expected: true },
    { name: "a lowercase button tag name is a native activation target", element: el("button"), expected: true },
  ])("$name", ({ element, expected }) => {
    expect(isNativeActivationTarget(element)).toBe(expected);
  });
});
