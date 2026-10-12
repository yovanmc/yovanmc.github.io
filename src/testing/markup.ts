// Checks over renderToStaticMarkup output, shared by the page markup tests.

/** Number of opening <h1> tags. */
export function h1Count(html: string): number {
  return (html.match(/<h1[ >]/g) ?? []).length;
}

/** Every opening <a> tag that sets target="_blank". */
export function blankTargetAnchors(html: string): string[] {
  return html.match(/<a\b[^>]*target="_blank"[^>]*>/g) ?? [];
}
