// Progression persistence. Pure apart from the injected ProgressStore, so it
// tests in the node environment without jsdom.
//
// One key, "yrpg.progress", value {"v":1,"defeated":[...]}. A missing,
// non-numeric or other `v` reads as fresh progress, never partially. Unknown
// top-level fields are dropped on read and never written back.
//
// Every storage touch is wrapped: access can throw in some privacy modes and
// setItem on quota. Reads degrade to empty progress, writes to a no-op.
//
// Boss ids are validated by bootParams.ts's coerceRushPrefix. Reads cap the
// prefix at the implemented bosses, so a stored boss with no module can never
// route to a nonexistent scene.
//
// Imports only leaf modules. Do NOT import ../battle/engine: this module is
// loaded eagerly from App.tsx and would pull the engine into the landing
// bundle.
import { coerceRushPrefix } from "../battle/bootParams";
import { IMPLEMENTED_BOSSES, RUSH_ORDER } from "../battle/rushOrder";

export const PROGRESS_KEY = "yrpg.progress";
export const PROGRESS_VERSION = 1;

/** The slice of the Web Storage API used here, injected to keep the module
 * pure. */
export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Makes the implemented-boss cap testable: the real RUSH_ORDER and
 * IMPLEMENTED_BOSSES hold the same ids, so no over-long value can reach the
 * cap through them. */
export interface BossRoster {
  rushOrder: readonly string[];
  implemented: readonly string[];
}

export const REAL_ROSTER: BossRoster = { rushOrder: RUSH_ORDER, implemented: IMPLEMENTED_BOSSES };

/** Never throws or logs; any malformed, stale or out-of-order value reads as
 * `[]` rather than being partially trusted. */
export function readProgress(store: ProgressStore | null, roster: BossRoster = REAL_ROSTER): string[] {
  if (store === null) return [];

  let raw: string | null;
  try {
    raw = store.getItem(PROGRESS_KEY);
  } catch {
    // Storage access threw (SecurityError in some privacy modes).
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

/** Refuses to write a value that fails coerceRushPrefix, so a caller bug
 * cannot corrupt the store. A throwing setItem is a silent no-op. */
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
