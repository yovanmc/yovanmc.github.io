/**
 * The splash's start menu, the arrow-key focus arithmetic behind it, and the
 * contact hrefs it reuses. Pure so the node vitest environment can test the
 * contract without jsdom; Landing.tsx only renders what these return.
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

/** The three contact hrefs, read from content.ts's Contact category so no
 * address is duplicated into the shell. Throws if a title is renamed. The
 * gate for that is landingRows.test.ts / landing.test.tsx under `npm test`
 * (CI runs it before the build); the throw is a render-time failure, not a
 * build-time one. Titles today: "GitHub", "Email", "LinkedIn". */
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

/** Ordered menu rows. `Continue` renders only for a visitor with saved
 * progress (defeatedBosses.length > 0). */
export function landingRows(hasProgress: boolean): LandingRow[] {
  const rows: LandingRow[] = [{ kind: "game", label: rowNewGame }];
  if (hasProgress) rows.push({ kind: "continue", label: rowContinue });
  rows.push(
    { kind: "work", label: rowWork, href: "/work/" },
    { kind: "contact", label: rowContact, href: contactLinks().email },
  );
  return rows;
}

/** Roving-focus arithmetic. `current` is the focused row index or null when
 * nothing (or something outside the menu) has focus. Wraps. */
export function nextRowIndex(current: number | null, key: "ArrowUp" | "ArrowDown", count: number): number {
  if (count <= 1) return 0;
  if (current === null) return key === "ArrowDown" ? 0 : count - 1;
  const step = key === "ArrowDown" ? 1 : -1;
  return (current + step + count) % count;
}
