/**
 * True when `el` is something the browser already knows how to activate on
 * its own (Enter/Space/click) - a real link,
 * button, form control, or a role=button element that has actually been
 * opted into the tab order (tabindex="0"). App's global keydown handler
 * checks ONLY document.activeElement against this, never an ancestor: a
 * tabindex="-1" descendant under a focusable role=button root must NOT
 * match through the root, which is exactly the shape of the play
 * command-menu rows (state-driven divs, deliberately never anchored or
 * given tabindex - see App.tsx's command-menu rows).
 *
 * Structural type instead of `Element`, and tag/attribute checks instead of
 * `el.matches(...)`, on purpose: this repo's vitest config runs a node
 * environment with no jsdom, so the predicate must be
 * unit-testable without a real DOM. A real DOM Element satisfies this
 * interface natively (tagName/hasAttribute/getAttribute), so no cast is
 * needed at the browser call site.
 */
export interface ActivationElement {
  tagName: string;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
}

const NATIVE_TAGS = new Set(["BUTTON", "INPUT", "TEXTAREA", "SELECT"]);

export function isNativeActivationTarget(el: ActivationElement | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "A") return el.hasAttribute("href");
  if (NATIVE_TAGS.has(tag)) return true;
  return el.getAttribute("role") === "button" && el.getAttribute("tabindex") === "0";
}
