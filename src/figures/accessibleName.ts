/**
 * Derives a figure's accessible name from its project's title, rather than a
 * hand-written per-figure caption (owner ruling: captions are gone from the
 * figure system entirely). Kept as a pure function so it is testable without
 * a DOM environment.
 */
export function accessibleNameFor(projectTitle: string): string {
  return `Diagram: ${projectTitle}`;
}
