// Schema-evolution guard (M4 task A4, HIGH-tier requirement). Distinct from
// store.test.ts on purpose: this file pins the ON-DISK SHAPE by hard-coding
// raw strings exactly as they would sit in localStorage today, rather than
// building them by calling writeProgress (which would make the assertions
// tautological — round-tripping the same serializer through itself proves
// nothing about the shape actually persisted).
//
// CHANGING THESE LITERALS IS A BREAKING STORAGE CHANGE requiring a version
// bump (PROGRESS_VERSION -> 2) and a migration path in readProgress, not a
// test edit. A real visitor's browser holds v1 data; silently reinterpreting
// it is exactly what D3's version field exists to prevent.
import { describe, expect, it } from "vitest";
import { readProgress, type ProgressStore } from "./store";

class FakeStore implements ProgressStore {
  constructor(private value: string) {}
  getItem(): string | null {
    return this.value;
  }
  setItem(): void {
    /* not used by this guard */
  }
  removeItem(): void {
    /* not used by this guard */
  }
}

const V1_EMPTY = '{"v":1,"defeated":[]}';
const V1_ONE = '{"v":1,"defeated":["alert-storm"]}';
const V1_FULL = '{"v":1,"defeated":["alert-storm","cascade","silent-failure","imposter-syndrome"]}';
const V1_EXTRA_FIELD = '{"v":1,"defeated":["alert-storm"],"futureField":true}';

describe("progress schema v1 guard (pins the on-disk shape, not just behavior)", () => {
  it("V1_EMPTY reads as no progress", () => {
    expect(readProgress(new FakeStore(V1_EMPTY))).toEqual([]);
  });

  it("V1_ONE reads as a single defeated boss", () => {
    expect(readProgress(new FakeStore(V1_ONE))).toEqual(["alert-storm"]);
  });

  it("V1_FULL reads as the full four-boss rush", () => {
    expect(readProgress(new FakeStore(V1_FULL))).toEqual([
      "alert-storm",
      "cascade",
      "silent-failure",
      "imposter-syndrome",
    ]);
  });

  it("V1_EXTRA_FIELD drops the unknown top-level field and still reads the known ones (D3 forward tolerance)", () => {
    expect(readProgress(new FakeStore(V1_EXTRA_FIELD))).toEqual(["alert-storm"]);
  });
});
