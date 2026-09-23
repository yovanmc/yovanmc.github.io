/**
 * User-facing copy for the /build/ page: every string this page adds lives
 * here.
 *
 * Punctuation rule: no em dash, no en dash anywhere in this file, including
 * comments (shellPunctuation.test.ts). No semicolon in any string value
 * (buildPage.test.tsx).
 */

/** BuildPage's <h1> and the /build/ shell's <title> prefix. */
export const title = "How this site is built";

/** Intro line above the numbers strip. */
export const numbersIntro = "A few numbers about this repository, computed fresh every time it is built.";

/** Shown under the numbers strip. */
export const numbersFootnote = "Generated at build time from the test run and git, not typed by hand.";

/** Names the population the branch coverage number covers (vitest.config.ts
 * coverage.include). */
export const coveragePopulation = "Branch coverage, battle + progress + figures";

/** Keeps the coverage number from reading as a claim about the whole app. */
export const coverageScopeNote = "The App shell and its UI components are not in the measured population.";

/** Replaces the numbers strip when virtual:build-facts is null (serve mode;
 * build mode fails loudly instead). */
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

/** Shown under the pipeline figure. */
export const pipelineFootnote = "npm run verify:canon fails the moment any of this drifts.";

/** Lessons section heading. Nothing in the section links out. */
export const lessonsHeading = "Lessons";

/** Intro line above the three write-ups. */
export const lessonsIntro = "Three things this project taught me the hard way. Each one changed how everything after it got built.";

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

export const repoLinkLabel = "View the repository";

export const repoUrl = "https://github.com/yovanmc/yovanmc.github.io";

/** The build page's entry row inside /work/. */
export const buildEntryTitle = "How this site is built";
export const buildEntryMeta = "The numbers, the verification pipeline, and the source";

/** BuildPage's mouse/touch way back to the landing gate (ESC/Backspace
 * already get there through App.tsx's browse key path). */
export const backLabel = "Back to the site";
