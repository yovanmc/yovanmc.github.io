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

/** Fixed menu order. `commandsForKit` filters this down to the kit. Exported
 * for commandMenu.test.ts's partition-completeness guard (M12 plan PR-A Task
 * A1 rule 5's row-cap upper bound has no coverage check of its own, this lets
 * that test assert SKILLS_IDS/SPELLS_IDS/"attack" partition every id here). */
export const ABILITY_ORDER: readonly AbilityId[] = ["attack", "ct", "pt", "debug", "fo", "rb", "rc", "conv"];

const ABILITY_DEFS: Record<AbilityId, AbilityCommand> = {
  attack: { id: "attack", label: "Attack", mp: 0, needsTarget: true, desc: "12 dmg · +1 MP on hit" },
  ct: { id: "ct", label: "Critical Thinking", mp: 2, needsTarget: false, desc: "3 turns · +50% dealt · −25% taken · screams linger" },
  pt: { id: "pt", label: "Power Through", mp: 3, needsTarget: true, desc: "28 dmg" },
  debug: { id: "debug", label: "Debug", mp: 2, needsTarget: true, desc: "6 dmg · 4×3 DoT · marks the target" },
  // Fan Out — signed Cascade resolution (base 8, dissect F1); an AoE cast
  // like CT: no target step, commits straight from the menu.
  fo: { id: "fo", label: "Fan Out", mp: 3, needsTarget: false, desc: "8 dmg to all · one reshuffle" },
  // Rollback — M6 PR-2 task 4; an untargeted heal like CT/Fan Out. Real
  // cleanse since M6 PR-3 task 4 (hero-side mark + DoT from the Imposter's
  // mirrored Debug).
  rb: { id: "rb", label: "Rollback", mp: 3, needsTarget: false, desc: "30 heal · cleanses mark + DoT" },
  // Root Cause — M6 PR-3 task 4, unlocked on defeating the Silent Failure.
  // 22 dmg generally; against the Imposter it also ignores stealth and rips
  // a VANISH phase back early.
  rc: { id: "rc", label: "Root Cause", mp: 4, needsTarget: true, desc: "22 dmg · 33 vs marked · ignores stealth" },
  // Conviction — M6 PR-3 task 4. Untargeted like CT/Fan Out/Rollback; the
  // low-HP rescue cast, gated separately (see the command menu's gate check,
  // task 6) on top of appearing in the derived kit.
  conv: { id: "conv", label: "Conviction", mp: 5, needsTarget: false, desc: "doubles every other ability · lasts the fight" },
};

/** Ordered command list for a derived kit (src/battle/engine.ts's `deriveKit`). */
export function commandsForKit(kit: AbilityId[]): AbilityCommand[] {
  return ABILITY_ORDER.filter((id) => kit.includes(id)).map((id) => ABILITY_DEFS[id]);
}
