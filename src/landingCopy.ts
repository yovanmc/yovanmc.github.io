/**
 * User-facing copy for the site shell. This file is the single home for
 * every user-facing string this area adds.
 *
 * Punctuation rule: no em dash, no en dash, no semicolon (src/site/shellPunctuation.test.ts).
 * New copy should append to this file rather than introducing a second copy home.
 */

/** OG/meta description for the root shell (vite.config.ts share-shells plugin). */
export const ogRootDescription = "Yovan Collins, backend engineer. Platforms, developer tooling, infrastructure, testing, and automation. A living document of my work, and a small game.";

/** OG/meta description for the /work/ shell (vite.config.ts share-shells plugin). */
export const ogBrowseDescription = "Browse the portfolio directly, case studies, experience, contact.";

/** Visually-hidden skip-link text (App.tsx root, first child). */
export const skipToContent = "Skip to content";

/** Forfeit control label everywhere the battle can be left (pause overlay, defeat overlay). Forfeit lands in the play menu, not the gate. */
export const skipToWork = "Skip to the work";

/** The name, used wherever a surface needs an accessible page title and has no better one of its own (BrowseIndex's hidden h1). */
export const nameLine = "Yovan Collins";

/** Role line under the name. */
export const roleLine = "Backend Software Engineer";

/** Landing bio. */
export const bioLine =
  "I'm an engineer who loves to work on platforms, developer tooling, infrastructure, testing, and automation of all kinds. This site is a passion project: a living document of my experiences, and my first ever game.";

/** Landing start-menu row labels. One line each. */
export const rowNewGame = "New game";
export const rowContinue = "Continue";
export const rowWork = "My work";
export const rowContact = "Contact";

/** Landing footer link labels. Hrefs come from content.ts's Contact
 * items via src/site/landingRows.ts contactLinks(), never from here. */
export const footerGithub = "GITHUB";
export const footerLinkedin = "LINKEDIN";
export const footerEmail = "EMAIL";

/** Shown under the start menu on phone: the game is playable there but is not the intended experience. */
export const phoneNote = "Best played on a desktop";

/** Sealed-panel body copy, used everywhere a locked item's detail is shown,
 * with the guarding boss's display name interpolated. The null branch is a
 * type-safety fallback only - every
 * gateable slug currently has a mapped boss (progress/unlocks.ts
 * guardingBoss), so it should not be reachable through the UI today. */
export function sealedLine(boss: string | null): string {
  return boss
    ? `Sealed until you defeat ${boss}.`
    : "Sealed until you defeat the boss guarding it.";
}

/** Locked-page call to action that lets a visitor see the real content
 * anyway. Adds the slug to App's session-only `revealed` set; nothing
 * persists across a reload. */
export const readAnyway = "Read it anyway";

/** Shown on the reduced-motion dive: an opt-in, per-visit control that
 * runs the full cinematic instead of the 2.5 second cross-fade. Never
 * persisted. */
export const playFullIntro = "Play the full intro";

/** Battle screen exit control: leaves the fight for the landing page. */
export const battleExit = "Exit";
