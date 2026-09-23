// Parsing and validation for the dev capture keys
// (`?phase=battle&boss=&defeated=&seed=&attempt=&actions=`). Pure and
// console-free so it is unit-testable and under the coverage gate; App.tsx's
// `decideBoot` owns the dev-only warning on rejection.

import type { BattleAction } from "./engine";
// Not imported from "./engine" or "./bosses/alertStorm": their circular
// dependency defeats Rollup's tree-shaking, and this file loads eagerly from
// App.tsx, so it would pull the battle engine into the landing bundle.
// ./rushOrder is a leaf module.
import { ALERT_STORM_ID, IMPLEMENTED_BOSSES, RUSH_ORDER } from "./rushOrder";

/** `boss=` capture key, whitelisted to IMPLEMENTED_BOSSES. Anything else falls
 * back to alert-storm rather than becoming a crash path. */
export function parseBoss(raw: string | null): string {
  if (raw && IMPLEMENTED_BOSSES.includes(raw)) return raw;
  return ALERT_STORM_ID;
}

export interface DefeatedParseResult {
  value: string[];
  /** True when raw was present but not a rush-order prefix. The caller decides
   * whether to warn. */
  rejected: boolean;
}

/** Dedupes `tokens` (first-seen order), then requires an exact prefix of
 * `rushOrder`, else `[]`. An id-set check would let rider count and kit
 * disagree (e.g. `silent-failure` alone: 110/12 with Root Cause but no Fan
 * Out, unreachable in play). The `rushOrder` parameter makes
 * src/progress's implemented-boss cap testable. */
export function coerceRushPrefix(
  tokens: string[],
  rushOrder: readonly string[] = RUSH_ORDER,
): DefeatedParseResult {
  const deduped = Array.from(new Set(tokens));
  const prefix = rushOrder.slice(0, deduped.length);
  const isValid = deduped.length === prefix.length && deduped.every((id, i) => id === prefix[i]);
  return isValid ? { value: prefix, rejected: false } : { value: [], rejected: true };
}

/** `defeated=` capture key: a RUSH_ORDER prefix after dedupe. */
export function parseDefeatedBosses(raw: string | null): DefeatedParseResult {
  if (raw === null) return { value: [], rejected: false };
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return coerceRushPrefix(tokens);
}

/** `actions=` capture key: `ct,debug:3,pt:0,fo` -> engine actions (targets
 * are bat ids). Unrecognized tokens are dropped. Out-of-kit tokens that parse
 * still reach the reducer and come back `invalid`. */
export function parseActions(raw: string | null): BattleAction[] | undefined {
  if (!raw) return undefined;
  const out: BattleAction[] = [];
  for (const tok of raw.split(",")) {
    const [name, tgt] = tok.split(":");
    if (name === "ct") out.push({ type: "ct" });
    else if (name === "fo") out.push({ type: "fo" });
    else if (name === "rb") out.push({ type: "rb" });
    else if (name === "conv") out.push({ type: "conv" });
    else if (name === "attack" || name === "pt" || name === "debug" || name === "rc") {
      const target = tgt !== undefined ? parseInt(tgt, 10) : NaN;
      if (!Number.isNaN(target)) out.push({ type: name, target });
    }
  }
  return out.length ? out : undefined;
}
