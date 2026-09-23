/**
 * The splash's start menu, its arrow-key focus arithmetic and contact hrefs.
 * Pure, so it tests without jsdom; Landing.tsx only renders the results.
 */
import { CATS } from "../content";
import { rowContact, rowContinue, rowNewGame, rowWork } from "../landingCopy";

export type RowKind = "game" | "continue" | "work" | "contact";

export interface LandingRow {
  kind: RowKind;
  label: string;
  /** present on anchor rows only; button rows (game, continue) have none */
  href?: string;
}

export interface ContactLinks {
  github: string;
  linkedin: string;
  email: string;
}

/** Contact hrefs read from content.ts's Contact category, so no address is
 * duplicated. Throws at render time if a title ("GitHub", "Email",
 * "LinkedIn") is renamed; landingRows.test.ts and landing.test.tsx catch
 * that in CI before the build. */
export function contactLinks(): ContactLinks {
  const cat = CATS.find((c) => c.key === "contact");
  if (!cat) throw new Error("content.ts has no contact category");
  const link = (title: string): string => {
    const it = cat.items.find((i) => i.title === title);
    if (!it || !it.link) throw new Error(`content.ts contact item missing: ${title}`);
    return it.link;
  };
  return { github: link("GitHub"), linkedin: link("LinkedIn"), email: link("Email") };
}

/** `Continue` renders only for a visitor with saved progress. */
export function landingRows(hasProgress: boolean): LandingRow[] {
  const rows: LandingRow[] = [{ kind: "game", label: rowNewGame }];
  if (hasProgress) rows.push({ kind: "continue", label: rowContinue });
  rows.push(
    { kind: "work", label: rowWork, href: "/work/" },
    { kind: "contact", label: rowContact, href: contactLinks().email },
  );
  return rows;
}

/** Roving focus with wrap. `current` is null when nothing in the menu has
 * focus. */
export function nextRowIndex(current: number | null, key: "ArrowUp" | "ArrowDown", count: number): number {
  if (count <= 1) return 0;
  if (current === null) return key === "ArrowDown" ? 0 : count - 1;
  const step = key === "ArrowDown" ? 1 : -1;
  return (current + step + count) % count;
}
