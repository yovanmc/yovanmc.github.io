/** Deterministic Park–Miller LCG so particle placement is stable across renders. */
export function rng(seed: number): () => number {
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
}
