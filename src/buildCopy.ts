/**
 * User-facing copy for the /build/ page, same convention as
 * src/landingCopy.ts. This file is the single home for every user-facing
 * string this page adds.
 *
 * Punctuation rule: no em dash, no en dash anywhere in this file, including
 * comments, enforced by src/site/shellPunctuation.test.ts's dash gate. No
 * semicolon in any string value (src/site/buildPage.test.tsx's own regex,
 * matching src/battle/scenes/punctuation.test.ts's pattern).
 */

/** BuildPage's <h1> and the /build/ shell's <title> prefix. */
export const title = "How this site is built";

/** Intro line above the numbers strip. */
export const numbersIntro = "A few numbers about this repository, computed fresh every time it is built.";

/** Shown under the numbers strip - the whole point of computing these at
 * build time instead of typing them by hand. */
export const numbersFootnote = "Generated at build time from the test run and git, not typed by hand.";

/** Names the population the branch coverage number covers (vitest.config.ts
 * coverage.include: battle, progress, figures). */
export const coveragePopulation = "Branch coverage, battle + progress + figures";

/** Clarifies what is deliberately outside that population, so the number
 * never reads as a claim about the whole app. */
export const coverageScopeNote = "The App shell and its UI components are not in the measured population.";

/** Shown in place of the numbers strip when virtual:build-facts resolves to
 * null (dev/serve mode - build mode fails loudly instead). */
export const serveModeLine = "Run npm test locally to populate these numbers. They only exist after a real test run.";

/** One-line labels for each numbers-strip tile. */
export const numberLabels = {
  tests: "Tests",
  testFiles: "Test files",
  branchesPct: "Branch coverage",
  branchFloor: "Branch floor",
  shareShells: "Share shells",
  runtimeDeps: "Runtime deps",
} as const;

/** Intro line above the verification-pipeline figure. */
export const pipelineIntro = "How a screenshot of this site becomes a passing or failing test.";

/** Shown under the pipeline figure - the actual enforcement mechanism, not
 * just a description of intent. */
export const pipelineFootnote = "npm run verify:canon fails the moment any of this drifts.";

/** Lessons section heading. The section is self-contained: nothing on the
 * page links out of it. */
export const lessonsHeading = "Lessons";

/** Intro line above the three write-ups. */
export const lessonsIntro = "Three things this project taught me the hard way. Each one changed how everything after it got built.";

/** Three self-contained write-ups. No links, nothing pointing outside the
 * page. */
export const lessons = [
  {
    title: "Measure the thing you think you are measuring",
    body: "A screenshot check kept passing because it was measuring the wrong part of the screen. The number it reported was real, it just was not the number I thought it was. Now every check has to prove it fails when the thing it guards is actually broken.",
  },
  {
    title: "Correct on paper is not the same as reachable",
    body: "A battle outcome was mathematically right and fully tested, and no player could ever reach it in a real playthrough. The math checked out and none of that mattered. Being right and being reachable are different checks and I now run both.",
  },
  {
    title: "A coverage number can lie",
    body: "A one line comment excluding code from coverage quietly hid a branch that was never tested, and the report still read one hundred percent. Now I occasionally disable a test on purpose just to watch the number drop. If it does not drop, the number is lying.",
  },
] as const;

/** Intro line above the repo link. */
export const repoIntro = "The repository this site is built from, including this page's own numbers plugin.";

/** Label for the outbound link to the repo. */
export const repoLinkLabel = "View the repository";

/** The public repo's own URL. */
export const repoUrl = "https://github.com/yovanmc/yovanmc.github.io";

/** The build page's full entry row inside /work/, the way in to the page. */
export const buildEntryTitle = "How this site is built";
export const buildEntryMeta = "The numbers, the verification pipeline, and the source";

/** BuildPage's own way back to the landing gate (mouse/touch affordance -
 * ESC/Backspace already reach the same place through App.tsx's existing
 * browse key path). */
export const backLabel = "Back to the site";
