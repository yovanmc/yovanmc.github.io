// Drives the store through an in-memory ProgressStore fake (no jsdom, no real
// localStorage). The implemented-boss cap uses an injected BossRoster so the
// real constants are never mutated.
import { describe, expect, it } from "vitest";
import { RUSH_ORDER } from "../battle/rushOrder";
import {
  clearProgress,
  PROGRESS_KEY,
  PROGRESS_VERSION,
  readProgress,
  writeProgress,
  type BossRoster,
  type ProgressStore,
} from "./store";

class FakeStore implements ProgressStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Simulates a SecurityError thrown on read access (privacy mode). */
class ThrowingGetStore implements ProgressStore {
  getItem(): string | null {
    throw new Error("SecurityError: localStorage disabled");
  }
  setItem(): void {
    /* unused in these tests */
  }
  removeItem(): void {
    /* unused in these tests */
  }
}

/** Simulates a quota-exceeded write. */
class ThrowingSetStore implements ProgressStore {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(): void {
    throw new Error("QuotaExceededError");
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Simulates a throwing removeItem. */
class ThrowingRemoveStore implements ProgressStore {
  removeItem(): void {
    throw new Error("SecurityError: localStorage disabled");
  }
  getItem(): string | null {
    return null;
  }
  setItem(): void {
    /* unused in these tests */
  }
}

const FULL_RUSH = [...RUSH_ORDER];

describe("readProgress", () => {
  it("returns [] when store is null (storage unavailable at call site)", () => {
    expect(readProgress(null)).toEqual([]);
  });

  it("returns [] when getItem throws (SecurityError simulation)", () => {
    expect(readProgress(new ThrowingGetStore())).toEqual([]);
  });

  it("returns [] when the key is absent", () => {
    expect(readProgress(new FakeStore())).toEqual([]);
  });

  it.each(["{", "undefined", ""])("returns [] for invalid JSON value %j", (raw) => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, raw);
    expect(readProgress(store)).toEqual([]);
  });

  it.each(['42', "null", "[]", '"x"'])("returns [] when the value parses to a non-object (%s)", (raw) => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, raw);
    expect(readProgress(store)).toEqual([]);
  });

  it.each([
    { name: "returns [] when v is missing", value: { defeated: ["alert-storm"] } },
    { name: "returns [] when v is non-numeric", value: { v: "1", defeated: ["alert-storm"] } },
    { name: "returns [] when v is a number other than 1", value: { v: 2, defeated: ["alert-storm"] } },
    { name: "returns [] when defeated is missing", value: { v: 1 } },
    { name: "returns [] when defeated is not an array", value: { v: 1, defeated: "alert-storm" } },
    { name: "returns [] when defeated contains a non-string element", value: { v: 1, defeated: ["alert-storm", 3] } },
    { name: "returns [] when defeated contains ids not in RUSH_ORDER", value: { v: 1, defeated: ["not-a-real-boss"] } },
    { name: "returns [] when defeated is a valid id set but out of rush order", value: { v: 1, defeated: ["cascade", "alert-storm"] } },
    { name: "returns [] for a fresh empty progress value", value: { v: 1, defeated: [] } },
  ])("$name", ({ value }) => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify(value));
    expect(readProgress(store)).toEqual([]);
  });

  it("dedupes duplicate ids to a valid prefix and accepts it", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["alert-storm", "alert-storm"] }));
    expect(readProgress(store)).toEqual(["alert-storm"]);
  });

  it("returns the full rush-order prefix for a full valid value", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: FULL_RUSH }));
    expect(readProgress(store)).toEqual(FULL_RUSH);
  });

  it("truncates to roster.implemented.length when the valid prefix is longer than what's implemented", () => {
    const localRoster: BossRoster = { rushOrder: ["a", "b", "c"], implemented: ["a", "b"] };
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["a", "b", "c"] }));
    expect(readProgress(store, localRoster)).toEqual(["a", "b"]);
  });
});

describe("writeProgress", () => {
  it("refuses to write a value that does not pass coerceRushPrefix (caller bug guard)", () => {
    const store = new FakeStore();
    writeProgress(store, ["cascade", "alert-storm"]);
    expect(store.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("serializes a valid value as the versioned envelope", () => {
    const store = new FakeStore();
    writeProgress(store, ["alert-storm", "cascade"]);
    expect(store.getItem(PROGRESS_KEY)).toBe(
      JSON.stringify({ v: PROGRESS_VERSION, defeated: ["alert-storm", "cascade"] }),
    );
  });

  it("does nothing when store is null", () => {
    // No throw is the assertion; there's no store to inspect.
    expect(() => writeProgress(null, ["alert-storm"])).not.toThrow();
  });

  it("swallows a throwing setItem (quota exceeded) as a silent no-op", () => {
    expect(() => writeProgress(new ThrowingSetStore(), ["alert-storm"])).not.toThrow();
  });

  it("uses a non-default roster's rushOrder for validation, not the real RUSH_ORDER", () => {
    const localRoster: BossRoster = { rushOrder: ["a", "b", "c"], implemented: ["a", "b", "c"] };
    const store = new FakeStore();
    writeProgress(store, ["a", "b"], localRoster);
    expect(store.getItem(PROGRESS_KEY)).toBe(JSON.stringify({ v: PROGRESS_VERSION, defeated: ["a", "b"] }));
  });
});

describe("clearProgress", () => {
  it("removes the stored key", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["alert-storm"] }));
    clearProgress(store);
    expect(store.getItem(PROGRESS_KEY)).toBeNull();
  });

  it("does nothing when store is null", () => {
    expect(() => clearProgress(null)).not.toThrow();
  });

  it("swallows a throwing removeItem as a silent no-op", () => {
    expect(() => clearProgress(new ThrowingRemoveStore())).not.toThrow();
  });
});
