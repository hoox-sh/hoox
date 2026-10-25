/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hook unit tests — renderer ref and polling helpers.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import {
  setRendererRef,
  getRendererRef,
  computePollingBackoff,
  createPollingController,
  formatPollIntervalLabel,
  POLLING_MAX_BACKOFF_MS,
} from "./index";

describe("renderer-ref", () => {
  afterEach(() => {
    setRendererRef(null);
  });

  it("stores and returns the renderer singleton", () => {
    const fake = {
      id: "renderer",
    } as unknown as import("@opentui/core").CliRenderer;
    setRendererRef(fake);
    expect(getRendererRef()).toBe(fake);
  });

  it("clears when set to null", () => {
    setRendererRef({} as import("@opentui/core").CliRenderer);
    setRendererRef(null);
    expect(getRendererRef()).toBeNull();
  });
});

describe("computePollingBackoff", () => {
  it("caps exponential backoff at 16s", () => {
    const base = 1000;
    for (let retry = 0; retry < 10; retry++) {
      const backoff = computePollingBackoff(base, retry);
      expect(backoff).toBeLessThanOrEqual(POLLING_MAX_BACKOFF_MS);
    }
    expect(computePollingBackoff(base, 10)).toBe(POLLING_MAX_BACKOFF_MS);
  });

  it("doubles per retry until cap", () => {
    expect(computePollingBackoff(500, 0)).toBe(500);
    expect(computePollingBackoff(500, 1)).toBe(1000);
    expect(computePollingBackoff(500, 2)).toBe(2000);
    expect(computePollingBackoff(500, 3)).toBe(4000);
  });

  it("respects custom max backoff", () => {
    expect(computePollingBackoff(1000, 5, 3000)).toBe(3000);
  });
});

describe("formatPollIntervalLabel", () => {
  it("formats whole seconds, fractional seconds, and milliseconds", () => {
    expect(formatPollIntervalLabel(5_000)).toBe("5s auto");
    expect(formatPollIntervalLabel(1500)).toBe("1.5s auto");
    expect(formatPollIntervalLabel(500)).toBe("500ms auto");
  });
});

describe("createPollingController", () => {
  /** Flush microtasks after advancing fake timers (Bun has no advanceTimersByTimeAsync). */
  async function advance(ms: number): Promise<void> {
    jest.advanceTimersByTime(ms);
    // Drain promise chains scheduled by timer callbacks
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("invokes callback immediately when immediate=true", async () => {
    let calls = 0;
    const ctrl = createPollingController({
      getCallback: () => async () => {
        calls++;
      },
      getIntervalMs: () => 1000,
      immediate: true,
    });
    ctrl.start();
    // Let the microtask from the immediate poll resolve
    await Promise.resolve();
    expect(calls).toBe(1);
    ctrl.stop();
  });

  it("defers first poll when immediate=false", async () => {
    let calls = 0;
    const ctrl = createPollingController({
      getCallback: () => async () => {
        calls++;
      },
      getIntervalMs: () => 500,
      immediate: false,
    });
    ctrl.start();
    await Promise.resolve();
    expect(calls).toBe(0);
    await advance(500);
    expect(calls).toBe(1);
    ctrl.stop();
  });

  it("increments retry count on failure and resets on success", async () => {
    let shouldFail = true;
    const ctrl = createPollingController({
      getCallback: () => async () => {
        if (shouldFail) throw new Error("boom");
      },
      getIntervalMs: () => 100,
      immediate: true,
    });
    ctrl.start();
    await Promise.resolve();
    expect(ctrl.getRetryCount()).toBe(1);

    // Next scheduled poll after backoff 100 * 2^1 = 200
    shouldFail = false;
    await advance(200);
    expect(ctrl.getRetryCount()).toBe(0);
    ctrl.stop();
  });

  it("stop prevents further polls after pending timeout", async () => {
    let calls = 0;
    const ctrl = createPollingController({
      getCallback: () => async () => {
        calls++;
      },
      getIntervalMs: () => 1000,
      immediate: true,
    });
    ctrl.start();
    await Promise.resolve();
    expect(calls).toBe(1);
    ctrl.stop();
    await advance(10_000);
    expect(calls).toBe(1);
  });

  it("reads fresh interval on each iteration", async () => {
    let interval = 100;
    let calls = 0;
    const ctrl = createPollingController({
      getCallback: () => async () => {
        calls++;
      },
      getIntervalMs: () => interval,
      immediate: true,
    });
    ctrl.start();
    await Promise.resolve();
    expect(calls).toBe(1);
    interval = 250;
    // Next poll was scheduled at previous interval (100); after it runs,
    // subsequent delay uses the new interval.
    await advance(100);
    expect(calls).toBe(2);
    await advance(249);
    expect(calls).toBe(2);
    await advance(1);
    expect(calls).toBe(3);
    ctrl.stop();
  });

  it("stop during in-flight callback does not schedule next poll", async () => {
    let resolveCb!: () => void;
    let calls = 0;
    const ctrl = createPollingController({
      getCallback: () => () =>
        new Promise<void>((resolve) => {
          calls++;
          resolveCb = resolve;
        }),
      getIntervalMs: () => 100,
      immediate: true,
    });
    ctrl.start();
    await Promise.resolve();
    expect(calls).toBe(1);
    ctrl.stop();
    resolveCb();
    await Promise.resolve();
    await advance(1000);
    expect(calls).toBe(1);
  });
});
