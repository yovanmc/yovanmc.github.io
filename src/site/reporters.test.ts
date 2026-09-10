// The build-facts virtual module reads its numbers from
// coverage/vitest-report.json (numTotalTests) and
// coverage/coverage-summary.json
// (total.branches.pct). Both files only exist when vitest is invoked with the
// json and json-summary reporters. This test makes the wiring mechanically
// checkable instead of relying on someone remembering to keep the reporter
// flags in place.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("test reporters produce build-facts inputs", () => {
  it("package.json scripts.test writes the vitest json report", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.test).toContain("--reporter=json");
    expect(pkg.scripts.test).toContain("--outputFile=coverage/vitest-report.json");
  });

  it("package.json scripts.test keeps the default reporter for human output", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.test).toContain("--reporter=default");
  });

  it("vitest.config.ts coverage reporters include json-summary", () => {
    expect(read("vitest.config.ts")).toContain("json-summary");
  });

  it("vitest.config.ts coverage reporters keep text and html for humans", () => {
    const config = read("vitest.config.ts");
    expect(config).toContain(`"text"`);
    expect(config).toContain(`"html"`);
  });
});
