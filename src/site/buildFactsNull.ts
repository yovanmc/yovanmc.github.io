// vitest.config.ts aliases virtual:build-facts to this module, for the
// .test.tsx files that import BuildPage without mocking, so the import always
// resolves. Component tests that need populated numbers use
// vi.mock("virtual:build-facts") instead of relying on this default.
import type { BuildFacts } from "../buildFacts";

const facts: BuildFacts | null = null;
export default facts;
