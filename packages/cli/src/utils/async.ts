/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Bounded-concurrency async helpers.
 */

/**
 * Map items through an async function with at most `concurrency` operations
 * in flight. Results keep input order. The first rejection propagates after
 * in-flight work settles (like `Promise.all`).
 *
 * Use for fan-out over subprocess spawns (e.g. per-worker `wrangler`
 * invocations) where unbounded `Promise.all` would hammer the API and
 * sequential `for` loops leave latency on the table.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];
  const results = new Array<R>(n);
  let next = 0;
  const workers = Math.min(Math.max(1, Math.floor(concurrency)), n);

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= n) return;
      results[i] = await fn(items[i] as T, i);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
