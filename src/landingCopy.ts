/**
 * User-facing copy for the site shell. New shell copy goes here, not in a
 * second copy home.
 *
 * Punctuation rule: no em dash, no en dash, no semicolon (src/site/shellPunctuation.test.ts).
 */

/** OG/meta description for the root shell (vite.config.ts share-shells plugin). */
export const ogRootDescription = "Yovan Collins, backend engineer. Platforms, developer tooling, infrastructure, testing, and automation. A living document of my work, and a small game.";

/** OG/meta description for the /work/ shell (vite.config.ts share-shells plugin). */
export const ogBrowseDescription = "Browse the portfolio directly, case studies, experience, contact.";

/** Visually-hidden skip-link text (App.tsx root, first child). */
export const skipToContent = "Skip to content";

/** Forfeit control label (pause and defeat overlays). Forfeit lands in the play menu, not the gate. */
export const skipToWork = "Skip to the work";

/** Accessible page title for surfaces with no better one (BrowseIndex's hidden h1). */
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

/** Sealed-panel body with the guarding boss's name. The null branch is a
 * type-safety fallback: every gateable slug has a guarding boss
 * (progress/unlocks.ts). */
export function sealedLine(boss: string | null): string {
  return boss
    ? `Sealed until you defeat ${boss}.`
    : "Sealed until you defeat the boss guarding it.";
}

/** Lets a visitor read a locked page anyway, for this session only. */
export const readAnyway = "Read it anyway";

/** Reduced-motion dive: opt-in per visit to the full cinematic. */
export const playFullIntro = "Play the full intro";

/** Battle screen exit control: leaves the fight for the landing page. */
export const battleExit = "Exit";
