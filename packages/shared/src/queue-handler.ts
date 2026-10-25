/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MessageBatch, Message } from "@cloudflare/workers-types";

export interface QueueHandlerOptions<T> {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Array of delay times in seconds for exponential backoff */
  backoffDelays: number[];
  /** Handler function called for each message */
  onMessage: (message: T, attemptNumber: number) => Promise<unknown> | unknown;
  /** Called when a message fails and will be retried */
  onRetry?: (
    message: T,
    attemptNumber: number,
    error: string,
    delaySeconds: number
  ) => void | Promise<void>;
  /** Called when message is moved to DLQ (max retries exceeded) */
  onDLQ?: (
    message: T,
    attemptNumber: number,
    error: string
  ) => void | Promise<void>;
  /** Logger function for debugging */
  logger?: {
    info(msg: string, data?: unknown): void;
    error(msg: string, data?: unknown): void;
  };
  /**
   * Max number of messages to process concurrently within a batch.
   * Defaults to 1 (serial) for back-compat. Values < 1 are treated as 1.
   */
  concurrency?: number;
}

/**
 * Process items with a bounded worker pool. Preserves per-item error isolation
 * when `fn` catches internally; failures in `fn` reject the returned promise.
 */
async function mapPool<T>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  const limit = Math.min(Math.max(1, concurrency), items.length);
  if (limit === 1) {
    for (const item of items) {
      await fn(item);
    }
    return;
  }

  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      await fn(items[i]!);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
}

/**
 * Creates a reusable queue handler with retry + exponential backoff logic.
 *
 * Usage:
 * ```typescript
 * const handler = createQueueHandler({
 *   maxRetries: 5,
 *   backoffDelays: [0, 30, 60, 300, 900],
 *   concurrency: 4, // optional; default 1 (serial)
 *   onMessage: async (msg) => {
 *     await executeTask(msg);
 *   },
 *   onDLQ: async (msg, attempts, error) => {
 *     await logFailedTask(msg, error);
 *   }
 * });
 *
 * export default {
 *   async queue(batch, env, ctx) {
 *     return await handler(batch);
 *   }
 * };
 * ```
 */
export function createQueueHandler<T>(options: QueueHandlerOptions<T>) {
  const {
    maxRetries,
    backoffDelays,
    onMessage,
    onRetry,
    onDLQ,
    logger,
    concurrency: concurrencyOpt,
  } = options;

  const concurrency =
    typeof concurrencyOpt === "number" &&
    Number.isFinite(concurrencyOpt) &&
    concurrencyOpt >= 1
      ? Math.floor(concurrencyOpt)
      : 1;

  async function processMessage(msg: Message<T>): Promise<void> {
    // Cloudflare Queues: first delivery is attempts = 1. Treat 0 as 1 so
    // older mocks still index backoffDelays[0] on the first failure.
    const delivery = Math.max(
      1,
      typeof msg.attempts === "number" && Number.isFinite(msg.attempts)
        ? msg.attempts
        : 1
    );
    const retryIndex = delivery - 1;
    const logId = `[${msg.id}]`;

    try {
      logger?.info(`${logId} Processing message (attempt ${delivery})`);
      await onMessage(msg.body, retryIndex);
      logger?.info(`${logId} Message processed successfully`);
      msg.ack();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (retryIndex < maxRetries) {
        const delaySeconds =
          backoffDelays[retryIndex] ??
          backoffDelays[backoffDelays.length - 1] ??
          0;

        logger?.info(
          `${logId} Retrying in ${delaySeconds}s (attempt ${delivery + 1}/${maxRetries + 1})`
        );

        try {
          await onRetry?.(msg.body, retryIndex, errorMsg, delaySeconds);
        } catch (hookError: unknown) {
          logger?.error(
            `${logId} onRetry failed: ${hookError instanceof Error ? hookError.message : String(hookError)}`
          );
        }
        msg.retry({ delaySeconds });
      } else {
        logger?.error(
          `${logId} Max retries exceeded (${maxRetries + 1} attempts), moving to DLQ`
        );

        try {
          await onDLQ?.(msg.body, retryIndex, errorMsg);
        } catch (hookError: unknown) {
          logger?.error(
            `${logId} onDLQ failed: ${hookError instanceof Error ? hookError.message : String(hookError)}`
          );
        }
        // Consume after the local DLQ hook so the platform does not
        // redeliver, and so a hook throw cannot retry the whole batch.
        msg.ack();
      }
    }
  }

  return async (batch: MessageBatch<T>): Promise<void> => {
    await mapPool(batch.messages, concurrency, processMessage);
  };
}
