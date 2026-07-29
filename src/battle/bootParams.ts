// Boot-param parsing/validation for the dev capture-key grammar
// (`?phase=battle&boss=&defeated=&seed=&attempt=&actions=`). Pure and
// side-effect-free (no console, no DOM) so it falls under the widened
// coverage gate (M6 PR-1a task 1) and is unit-testable without a DOM
// harness — App.tsx's `decideBoot` calls these and owns the dev-only
// console.warn on rejection.
// docs/superpowers/specs/2026-07-28-m6-bosses-2-4-plan.md, PR-1a task 5.

import type { BattleAction } from "./engine";
// Deliberately NOT importing from "./engine" or "./bosses/alertStorm" here
// for these three constants: both modules have a circular value dependency
// on each other (engine.ts <-> bosses/alertStorm.ts) that defeats Rollup's
// tree-shaking, and this file is imported eagerly by App.tsx — pulling in
// battleReduce/initBattle/spawnAlertStorm etc. would leak the whole battle
// engine into the landing bundle. ./rushOrder is a leaf module with no other
// imports, so it tree-shakes cleanly. (Measured: +4.95 kB landing bundle
// growth importing from "./engine" directly, vs. 0 kB from "./rushOrder".)
import { ALERT_STORM_ID, IMPLEMENTED_BOSSES, RUSH_ORDER } from "./rushOrder";

/** `boss=` capture key: whitelist = IMPLEMENTED_BOSSES, default alert-storm.
 * A boss ahead of its own PR (or garbage) silently falls back — never a
 * crash path on the auto-deploy site (pass-2 G1). */
export function parseBoss(raw: string | null): string {
  if (raw && IMPLEMENTED_BOSSES.includes(raw)) return raw;
  return ALERT_STORM_ID;
}

export interface DefeatedParseResult {
  value: string[];
  /** true when raw was present but did not validate as a rush-order prefix.
   * This module stays console-free (pure, vitest-friendly); the dev-guarded
   * caller decides whether/how to warn. */
  rejected: boolean;
}

/** `defeated=` capture key: validates as a RUSH_ORDER PREFIX (order-sensitive,
 * per the literal meaning of "prefix") after dedupe (dissect F8 — id-set
 * validation would let rider count and kit derivation disagree, e.g.
 * `defeated=silent-failure` implying 110/12 stats with Root Cause but no Fan
 * Out, a state unreachable in play). Anything that isn't an exact prefix
 * rejects to `[]`. */
export function parseDefeatedBosses(raw: string | null): DefeatedParseResult {
  if (raw === null) return { value: [], rejected: false };
  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const deduped = Array.from(new Set(tokens));
  const prefix = RUSH_ORDER.slice(0, deduped.length);
  const isValid = deduped.length === prefix.length && deduped.every((id, i) => id === prefix[i]);
  return isValid ? { value: prefix, rejected: false } : { value: [], rejected: true };
}

/** `actions=` capture key: `ct,debug:3,pt:0,fo` -> engine actions (targets
 * are bat ids). Unrecognized tokens are silently dropped (today's path) —
 * out-of-kit tokens that DO parse (e.g. `fo` before alert-storm is beaten)
 * still reach the reducer and come back as an `invalid` event, same as any
 * other illegal action. */
export function parseActions(raw: string | null): BattleAction[] | undefined {
  if (!raw) return undefined;
  const out: BattleAction[] = [];
  for (const tok of raw.split(",")) {
    const [name, tgt] = tok.split(":");
    if (name === "ct") out.push({ type: "ct" });
    else if (name === "fo") out.push({ type: "fo" });
    else if (name === "rb") out.push({ type: "rb" });
    else if (name === "attack" || name === "pt" || name === "debug") {
      const target = tgt !== undefined ? parseInt(tgt, 10) : NaN;
      if (!Number.isNaN(target)) out.push({ type: name, target });
    }
  }
  return out.length ? out : undefined;
}
