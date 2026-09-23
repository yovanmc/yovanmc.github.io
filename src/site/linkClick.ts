/**
 * True when a click on a row's `<a href>` should be handled in-app. False for
 * any modifier or non-primary click, so ctrl/cmd, shift and middle click
 * behave like a normal link. Shared by App.tsx and BrowseIndex.tsx so they
 * agree.
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
