// Pins the on-disk shape with raw strings as they sit in localStorage, not
// strings built by writeProgress (round-tripping the serializer proves
// nothing about what is persisted).
//
// CHANGING THESE LITERALS IS A BREAKING STORAGE CHANGE: bump
// PROGRESS_VERSION and add a migration in readProgress instead. Visitors'
// browsers hold v1 data.
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

  it("V1_EXTRA_FIELD drops the unknown top-level field and still reads the known ones", () => {
    expect(readProgress(new FakeStore(V1_EXTRA_FIELD))).toEqual(["alert-storm"]);
  });
});
