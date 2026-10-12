// A plain left click on a row's <a href> is handled in-app; a modifier click
// (ctrl/cmd/shift) or middle click falls through to the browser.
import { describe, expect, it } from "vitest";
import { shouldRouteInApp } from "./linkClick";

const plain = { metaKey: false, ctrlKey: false, shiftKey: false, button: 0 };

describe("shouldRouteInApp", () => {
  it("a plain left click routes in-app", () => {
    expect(shouldRouteInApp(plain)).toBe(true);
  });

  it.each([
    { name: "cmd/meta-click", event: { ...plain, metaKey: true } },
    { name: "ctrl-click", event: { ...plain, ctrlKey: true } },
    { name: "shift-click", event: { ...plain, shiftKey: true } },
    { name: "middle click (button !== 0)", event: { ...plain, button: 1 } },
    { name: "right click (button 2)", event: { ...plain, button: 2 } },
  ])("$name does not route in-app", ({ event }) => {
    expect(shouldRouteInApp(event)).toBe(false);
  });
});
