// A real <a href> anchor on a BrowseIndex/detail-panel/mobile-sheet row is
// intercepted (preventDefault + drive the SPA in-app) on a plain left
// click, but a modifier click (ctrl/cmd/shift) or a non-primary button
// (middle click) must fall through to the browser's own handling of the real
// href - new tab, save link, etc. shouldRouteInApp is the single guard both
// App.tsx and BrowseIndex.tsx call so the two surfaces never drift.
import { describe, expect, it } from "vitest";
import { shouldRouteInApp } from "./linkClick";

const plain = { metaKey: false, ctrlKey: false, shiftKey: false, button: 0 };

describe("shouldRouteInApp", () => {
  it("a plain left click routes in-app", () => {
    expect(shouldRouteInApp(plain)).toBe(true);
  });

  it("cmd/meta-click does not route in-app", () => {
    expect(shouldRouteInApp({ ...plain, metaKey: true })).toBe(false);
  });

  it("ctrl-click does not route in-app", () => {
    expect(shouldRouteInApp({ ...plain, ctrlKey: true })).toBe(false);
  });

  it("shift-click does not route in-app", () => {
    expect(shouldRouteInApp({ ...plain, shiftKey: true })).toBe(false);
  });

  it("middle click (button !== 0) does not route in-app", () => {
    expect(shouldRouteInApp({ ...plain, button: 1 })).toBe(false);
  });

  it("right click (button 2) does not route in-app", () => {
    expect(shouldRouteInApp({ ...plain, button: 2 })).toBe(false);
  });
});
