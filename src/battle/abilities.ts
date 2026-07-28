// Kit-driven command data (M6 plan §Cross-boss architecture / PR-1a task 6).
// Replaces BattleScene.tsx's old static `COMMANDS` literal: the command menu
// now derives from `deriveKit(defeatedBosses)` (src/battle/engine.ts) so a
// rematch with Alert Storm defeated shows the Fan Out row and a fresh first
// fight doesn't. Labels/mp/desc for attack/ct/pt/debug are copied verbatim
// from the pre-M6 COMMANDS literal (unchanged text, already punctuation-clean
// — the M6 plan requires no rewrite of existing strings).
import type { AbilityId } from "./engine";

export interface AbilityCommand {
  id: AbilityId;
  label: string;
  mp: number;
  needsTarget: boolean;
  desc: string;
}

/** Fixed menu order; `commandsForKit` filters this down to the kit. */
const ABILITY_ORDER: readonly AbilityId[] = ["attack", "ct", "pt", "debug", "fo"];

const ABILITY_DEFS: Record<AbilityId, AbilityCommand> = {
  attack: { id: "attack", label: "Attack", mp: 0, needsTarget: true, desc: "12 dmg · +1 MP on hit" },
  ct: { id: "ct", label: "Critical Thinking", mp: 2, needsTarget: false, desc: "3 turns · +50% dealt · −25% taken · screams linger" },
  pt: { id: "pt", label: "Power Through", mp: 3, needsTarget: true, desc: "28 dmg" },
  debug: { id: "debug", label: "Debug", mp: 2, needsTarget: true, desc: "6 dmg · 4×3 DoT · marks the target" },
  // Fan Out — signed Cascade resolution (base 8, dissect F1); an AoE cast
  // like CT: no target step, commits straight from the menu.
  fo: { id: "fo", label: "Fan Out", mp: 3, needsTarget: false, desc: "8 dmg to all · one reshuffle" },
};

/** Ordered command list for a derived kit (src/battle/engine.ts's `deriveKit`). */
export function commandsForKit(kit: AbilityId[]): AbilityCommand[] {
  return ABILITY_ORDER.filter((id) => kit.includes(id)).map((id) => ABILITY_DEFS[id]);
}
