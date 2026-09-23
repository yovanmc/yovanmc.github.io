/**
 * True when the browser already activates `el` itself on Enter/Space/click:
 * a link, button, form control, or role=button with tabindex="0". App's
 * keydown handler checks only document.activeElement, never an ancestor, so
 * a tabindex="-1" child under a focusable role=button root does not match
 * (the shape of the play command-menu rows).
 *
 * A structural type with tag/attribute checks instead of `el.matches()`, so
 * it tests without jsdom; a real Element satisfies it natively.
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
