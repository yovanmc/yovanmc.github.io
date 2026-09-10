/**
 * True when a click on a real `<a href>` row anchor should be
 * intercepted and driven in-app (SPA navigation / activate()) rather than
 * left to the browser's own handling of the href. False for any modifier
 * click or non-primary button, so ctrl/cmd-click, shift-click, and middle
 * click all keep working exactly like a normal link - open in a new tab,
 * open in a new window, whatever the browser/OS does with a real href.
 * Shared by App.tsx (detail panel, mobile sheet) and BrowseIndex.tsx so the
 * two surfaces can never drift on what counts as "just open it".
 */
export interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  button: number;
}

export function shouldRouteInApp(e: ClickModifiers): boolean {
  return !(e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0);
}
