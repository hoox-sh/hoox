/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * usePolling — Configurable polling with exponential backoff.
 *
 * Reads refreshIntervalMs from config store. Doubles interval on failure
 * (up to 16s max). Resets on success. Pause/resume via enabled toggle.
 */
import { useEffect, useRef } from "react";
import { useConfigStore } from "@hoox-sh/hoox-shared";

export interface UsePollingOptions {
  callback: () => Promise<void>;
  enabled?: boolean;
  immediate?: boolean;
}

/** Max poll delay after repeated failures (ms). Exported for unit tests. */
export const POLLING_MAX_BACKOFF_MS = 16_000;

/**
 * Exponential backoff for poll failures, capped at {@link POLLING_MAX_BACKOFF_MS}.
 * Exported for unit tests (pure).
 */
export function computePollingBackoff(
  baseIntervalMs: number,
  retryCount: number,
  maxBackoffMs: number = POLLING_MAX_BACKOFF_MS
): number {
  return Math.min(baseIntervalMs * Math.pow(2, retryCount), maxBackoffMs);
}

/**
 * Non-React poll scheduler used by {@link usePolling}.
 * Exported so unit tests can cover success/failure/cancel without a renderer.
 */
export function createPollingController(options: {
  getCallback: () => () => Promise<void>;
  getIntervalMs: () => number;
  immediate?: boolean;
  maxBackoffMs?: number;
  /** Mutable retry counter (shared with the React ref when used from the hook). */
  retryCountRef?: { current: number };
}): { start: () => void; stop: () => void; getRetryCount: () => number } {
  const {
    getCallback,
    getIntervalMs,
    immediate = true,
    maxBackoffMs = POLLING_MAX_BACKOFF_MS,
    retryCountRef = { current: 0 },
  } = options;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      await getCallback()();
      if (cancelled) return;
      retryCountRef.current = 0;
    } catch {
      if (cancelled) return;
      retryCountRef.current++;
    }
    // cancelled is already checked in both branches above (no await between
    // those checks and here), so schedule the next tick directly.
    // Read fresh interval on every iteration so config changes take effect.
    const currentInterval = getIntervalMs();
    const backoff = computePollingBackoff(
      currentInterval,
      retryCountRef.current,
      maxBackoffMs
    );
    timeoutId = setTimeout(() => {
      void poll();
    }, backoff);
  };

  return {
    getRetryCount: () => retryCountRef.current,
    start: () => {
      cancelled = false;
      if (immediate) {
        void poll();
      } else {
        const initialInterval = getIntervalMs();
        timeoutId = setTimeout(() => {
          void poll();
        }, initialInterval);
      }
    },
    stop: () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = undefined;
    },
  };
}

/** Compact HUD label for the configured poll interval. */
export function formatPollIntervalLabel(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "auto";
  if (ms >= 1000 && ms % 1000 === 0) return `${ms / 1000}s auto`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s auto`;
  return `${Math.round(ms)}ms auto`;
}

/**
 * Poll `callback` on the Settings refresh interval while `enabled`.
 * Backs off exponentially after thrown failures; resets after success.
 */
export function usePolling(options: UsePollingOptions): void {
  const { callback, enabled = true, immediate = true } = options;
  const intervalMs = useConfigStore((s) => s.refreshIntervalMs);
  const callbackRef = useRef(callback);
  const retryCount = useRef(0);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      // Reset backoff when disabled so resume starts clean
      retryCount.current = 0;
      return;
    }

    const controller = createPollingController({
      getCallback: () => callbackRef.current,
      getIntervalMs: () => useConfigStore.getState().refreshIntervalMs,
      immediate,
      retryCountRef: retryCount,
    });
    controller.start();
    return () => {
      controller.stop();
    };
  }, [intervalMs, enabled, immediate]);
}
