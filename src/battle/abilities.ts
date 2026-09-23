// Kit-driven command data: the menu derives from `deriveKit(defeatedBosses)`.
import type { AbilityId } from "./engine";

export interface AbilityCommand {
  id: AbilityId;
  label: string;
  mp: number;
  needsTarget: boolean;
  desc: string;
}

/** Fixed menu order; `commandsForKit` filters it to the kit. commandMenu.test.ts
 * asserts SKILLS_IDS, SPELLS_IDS and "attack" partition it. */
export const ABILITY_ORDER: readonly AbilityId[] = ["attack", "ct", "pt", "debug", "fo", "rb", "rc", "conv"];

const ABILITY_DEFS: Record<AbilityId, AbilityCommand> = {
  attack: { id: "attack", label: "Attack", mp: 0, needsTarget: true, desc: "12 dmg · +1 MP on hit" },
  ct: { id: "ct", label: "Critical Thinking", mp: 2, needsTarget: false, desc: "3 turns · +50% dealt · −25% taken · screams linger" },
  pt: { id: "pt", label: "Power Through", mp: 3, needsTarget: true, desc: "28 dmg" },
  debug: { id: "debug", label: "Debug", mp: 2, needsTarget: true, desc: "6 dmg · 4×3 DoT · marks the target" },
  fo: { id: "fo", label: "Fan Out", mp: 3, needsTarget: false, desc: "8 dmg to all · one reshuffle" },
  // Cleanses the hero-side mark and DoT from the Imposter's mirrored Debug.
  rb: { id: "rb", label: "Rollback", mp: 3, needsTarget: false, desc: "30 heal · cleanses mark + DoT" },
  // Against the Imposter it also rips a VANISH phase back early.
  rc: { id: "rc", label: "Root Cause", mp: 4, needsTarget: true, desc: "22 dmg · 33 vs marked · ignores stealth" },
  // The low-HP rescue cast, gated separately on top of being in the kit.
  conv: { id: "conv", label: "Conviction", mp: 5, needsTarget: false, desc: "doubles every other ability · lasts the fight" },
};

/** Ordered command list for a derived kit. */
export function commandsForKit(kit: AbilityId[]): AbilityCommand[] {
  return ABILITY_ORDER.filter((id) => kit.includes(id)).map((id) => ABILITY_DEFS[id]);
}
