// Progress store test suite (M4 task A2). Drives readProgress/writeProgress/
// clearProgress through a plain in-memory fake implementing ProgressStore —
// no jsdom, no real localStorage. See D3 (versioned envelope), D4 (every
// storage touch wrapped, never throws to caller), D2 (implemented-boss cap,
// via an injected BossRoster so the real 4-entry RUSH_ORDER/IMPLEMENTED_BOSSES
// never has to be mutated to exercise it).
import { describe, expect, it } from "vitest";
import { IMPLEMENTED_BOSSES, RUSH_ORDER } from "../battle/rushOrder";
import {
  clearProgress,
  PROGRESS_KEY,
  PROGRESS_VERSION,
  readProgress,
  writeProgress,
  type BossRoster,
  type ProgressStore,
} from "./store";

/** Plain in-memory ProgressStore fake. */
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

  it("returns [] when v is missing", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ defeated: ["alert-storm"] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when v is non-numeric", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: "1", defeated: ["alert-storm"] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when v is a number other than 1", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 2, defeated: ["alert-storm"] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when defeated is missing", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1 }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when defeated is not an array", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: "alert-storm" }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when defeated contains a non-string element", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["alert-storm", 3] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when defeated contains ids not in RUSH_ORDER", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["not-a-real-boss"] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns [] when defeated is a valid id set but out of rush order (D1)", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["cascade", "alert-storm"] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("dedupes duplicate ids to a valid prefix and accepts it", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: ["alert-storm", "alert-storm"] }));
    expect(readProgress(store)).toEqual(["alert-storm"]);
  });

  it("returns [] for a fresh empty progress value", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: [] }));
    expect(readProgress(store)).toEqual([]);
  });

  it("returns the full rush-order prefix for a full valid value", () => {
    const store = new FakeStore();
    store.setItem(PROGRESS_KEY, JSON.stringify({ v: 1, defeated: FULL_RUSH }));
    expect(readProgress(store)).toEqual(FULL_RUSH);
  });

  it("(D2) truncates to roster.implemented.length when the valid prefix is longer than what's implemented", () => {
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

describe("IMPLEMENTED_BOSSES sanity (guards the default-roster cap test's premise)", () => {
  it("today's IMPLEMENTED_BOSSES matches RUSH_ORDER's length, so the default-roster cap is a no-op (see D2 note)", () => {
    expect(IMPLEMENTED_BOSSES.length).toBe(RUSH_ORDER.length);
  });
});
