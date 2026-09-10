// Progression persistence core. Pure and side-effect-free apart from the
// injected ProgressStore, so it tests under the node environment with no
// jsdom. Console-free, matching bootParams.ts's precedent.
//
// Versioned envelope, single key. Key: "yrpg.progress". Value:
// {"v":1,"defeated":[...]}. A v that is absent, non-numeric, or !== 1 is
// treated as absent (fresh progress), never partially read. Unknown extra
// top-level fields are dropped on read and never round-tripped on write.
//
// Every storage touch is wrapped. localStorage access can throw in some
// privacy configurations, and setItem can throw on quota. Read failures
// degrade to empty progress, write failures degrade to a no-op. Neither ever
// throws to the caller.
//
// One shared validator: boss-id validation reuses coerceRushPrefix from
// bootParams.ts rather than re-implementing dedupe+prefix logic here.
//
// The read path caps the validated prefix at roster.implemented.length, not
// just roster.rushOrder.length, so a stored value referencing a boss
// RUSH_ORDER knows about but no module implements yet can never route to a
// nonexistent scene. See the BossRoster seam note below.
//
// Deliberately importing only leaf/pure modules: ../battle/rushOrder and
// ../battle/bootParams. Do NOT import from ../battle/engine: it drags the
// battle engine's runtime into whatever imports this module (this module is
// imported eagerly from App.tsx), the exact landing-bundle regression
// rushOrder.ts was split out to prevent (+4.95 kB, measured).
import { coerceRushPrefix } from "../battle/bootParams";
import { IMPLEMENTED_BOSSES, RUSH_ORDER } from "../battle/rushOrder";

export const PROGRESS_KEY = "yrpg.progress";
export const PROGRESS_VERSION = 1;

/** Minimal shape of the Web Storage API this module uses. Injected so the
 * module stays pure and testable under the node environment, with no jsdom. */
export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Seam required so the implemented-boss cap is testable: coerceRushPrefix
 * rejects anything that isn't an exact RUSH_ORDER prefix before any cap can
 * run, and today RUSH_ORDER and IMPLEMENTED_BOSSES hold the same 4 ids, so
 * no over-long value can ever reach the cap through the real constants. */
export interface BossRoster {
  rushOrder: readonly string[];
  implemented: readonly string[];
}

/** Real constants. The parameter exists so the cap above is testable without
 * mutating RUSH_ORDER/IMPLEMENTED_BOSSES themselves. */
export const REAL_ROSTER: BossRoster = { rushOrder: RUSH_ORDER, implemented: IMPLEMENTED_BOSSES };

/** Reads and validates stored progress. Never throws, never logs; any
 * malformed, stale, or out-of-order value degrades to `[]` (fresh
 * progress) rather than partially trusting it. */
export function readProgress(store: ProgressStore | null, roster: BossRoster = REAL_ROSTER): string[] {
  if (store === null) return [];

  let raw: string | null;
  try {
    raw = store.getItem(PROGRESS_KEY);
  } catch {
    // Storage access itself threw (SecurityError in some privacy modes).
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
  const obj = parsed as Record<string, unknown>;

  if (typeof obj.v !== "number" || obj.v !== PROGRESS_VERSION) return [];

  if (!Array.isArray(obj.defeated) || obj.defeated.some((id) => typeof id !== "string")) return [];

  const result = coerceRushPrefix(obj.defeated as string[], roster.rushOrder);
  if (result.rejected) return [];

  // Cap at what's actually implemented, not just what RUSH_ORDER knows.
  return result.value.slice(0, roster.implemented.length);
}

/** Validates and persists `defeated`. Refuses to write anything that does
 * not itself pass coerceRushPrefix, so a caller bug can't corrupt the
 * store. Swallows a throwing setItem (e.g. quota exceeded) as a silent
 * no-op. */
export function writeProgress(
  store: ProgressStore | null,
  defeated: string[],
  roster: BossRoster = REAL_ROSTER,
): void {
  if (store === null) return;

  const result = coerceRushPrefix(defeated, roster.rushOrder);
  if (result.rejected) return;

  const payload = JSON.stringify({ v: PROGRESS_VERSION, defeated: result.value });
  try {
    store.setItem(PROGRESS_KEY, payload);
  } catch {
    // Quota exceeded or storage unavailable: silent no-op.
  }
}

/** Wipes stored progress. Never throws. */
export function clearProgress(store: ProgressStore | null): void {
  if (store === null) return;
  try {
    store.removeItem(PROGRESS_KEY);
  } catch {
    // Storage unavailable: silent no-op.
  }
}
