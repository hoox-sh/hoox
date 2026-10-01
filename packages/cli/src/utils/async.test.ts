/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "bun:test";
import { mapPool } from "./async.js";

describe("mapPool", () => {
  it("returns [] for empty input without calling fn", async () => {
    let calls = 0;
    const out = await mapPool([], 4, async () => {
      calls++;
      return 1;
    });
    expect(out).toEqual([]);
    expect(calls).toBe(0);
  });

  it("preserves input order under concurrency", async () => {
    const out = await mapPool([1, 2, 3, 4, 5], 2, async (x) => {
      await new Promise((r) => setTimeout(r, (6 - x) * 5));
      return x * 10;
    });
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it("bounds in-flight work", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapPool([1, 2, 3, 4, 5, 6], 3, async (x) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return x;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("propagates rejections", async () => {
    await expect(
      mapPool([1, 2, 3], 2, async (x) => {
        if (x === 2) throw new Error("boom");
        return x;
      })
    ).rejects.toThrow("boom");
  });
});
