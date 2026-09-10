// Kit-driven command data. The command menu derives from
// `deriveKit(defeatedBosses)` (src/battle/engine.ts), so a rematch with Alert
// Storm defeated shows the Fan Out row and a fresh first fight does not.
import type { AbilityId } from "./engine";

export interface AbilityCommand {
  id: AbilityId;
  label: string;
  mp: number;
  needsTarget: boolean;
  desc: string;
}

/** Fixed menu order. `commandsForKit` filters this down to the kit. Exported
 * so commandMenu.test.ts can assert that SKILLS_IDS, SPELLS_IDS and "attack"
 * partition every id listed here, which bounds the menu row count. */
export const ABILITY_ORDER: readonly AbilityId[] = ["attack", "ct", "pt", "debug", "fo", "rb", "rc", "conv"];

const ABILITY_DEFS: Record<AbilityId, AbilityCommand> = {
  attack: { id: "attack", label: "Attack", mp: 0, needsTarget: true, desc: "12 dmg · +1 MP on hit" },
  ct: { id: "ct", label: "Critical Thinking", mp: 2, needsTarget: false, desc: "3 turns · +50% dealt · −25% taken · screams linger" },
  pt: { id: "pt", label: "Power Through", mp: 3, needsTarget: true, desc: "28 dmg" },
  debug: { id: "debug", label: "Debug", mp: 2, needsTarget: true, desc: "6 dmg · 4×3 DoT · marks the target" },
  // Fan Out: an AoE cast like CT, base 8 damage, no target step, commits
  // straight from the menu.
  fo: { id: "fo", label: "Fan Out", mp: 3, needsTarget: false, desc: "8 dmg to all · one reshuffle" },
  // Rollback: an untargeted heal like CT/Fan Out. Real cleanse for the
  // hero-side mark + DoT from the Imposter's mirrored Debug.
  rb: { id: "rb", label: "Rollback", mp: 3, needsTarget: false, desc: "30 heal · cleanses mark + DoT" },
  // Root Cause: unlocked on defeating the Silent Failure. 22 dmg generally;
  // against the Imposter it also ignores stealth and rips a VANISH phase
  // back early.
  rc: { id: "rc", label: "Root Cause", mp: 4, needsTarget: true, desc: "22 dmg · 33 vs marked · ignores stealth" },
  // Conviction: untargeted like CT/Fan Out/Rollback, the low-HP rescue
  // cast, gated separately (see the command menu's gate check) on top of
  // appearing in the derived kit.
  conv: { id: "conv", label: "Conviction", mp: 5, needsTarget: false, desc: "doubles every other ability · lasts the fight" },
};

/** Ordered command list for a derived kit (src/battle/engine.ts's `deriveKit`). */
export function commandsForKit(kit: AbilityId[]): AbilityCommand[] {
  return ABILITY_ORDER.filter((id) => kit.includes(id)).map((id) => ABILITY_DEFS[id]);
}
