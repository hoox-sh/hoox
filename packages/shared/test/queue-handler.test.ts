/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "bun:test";
import { createQueueHandler } from "../src/queue-handler";

function mockMessage(
  body: unknown,
  opts: { attempts?: number; id?: string } = {}
) {
  return {
    id: opts.id ?? "msg-id",
    body,
    attempts: opts.attempts ?? 1,
    retry: vi.fn(),
    ack: vi.fn(),
  };
}

describe("createQueueHandler", () => {
  it("should create a queue handler function", () => {
    const handler = createQueueHandler({
      maxRetries: 3,
      backoffDelays: [0, 30, 60],
      onMessage: vi.fn().mockResolvedValue({ success: true }),
      onRetry: vi.fn(),
      onDLQ: vi.fn(),
    });

    expect(typeof handler).toBe("function");
  });

  it("should execute successful messages without retry", async () => {
    const onMessage = vi.fn().mockResolvedValue({ success: true });
    const onRetry = vi.fn();
    const onDLQ = vi.fn();

    const handler = createQueueHandler({
      maxRetries: 3,
      backoffDelays: [0, 30, 60],
      onMessage,
      onRetry,
      onDLQ,
    });

    const mockMsg = mockMessage({ requestId: "123", action: "buy" });

    await handler({
      messages: [mockMsg as any],
      metadata: {} as any,
    } as any);

    expect(onMessage).toHaveBeenCalledWith(mockMsg.body, 0);
    expect(onRetry).not.toHaveBeenCalled();
    expect(onDLQ).not.toHaveBeenCalled();
    expect(mockMsg.ack).toHaveBeenCalledTimes(1);
    expect(mockMsg.retry).not.toHaveBeenCalled();
  });

  it("should retry failed messages with exponential backoff", async () => {
    const onMessage = vi.fn().mockRejectedValue(new Error("Trade failed"));
    const onRetry = vi.fn();
    const onDLQ = vi.fn();

    const handler = createQueueHandler({
      maxRetries: 3,
      backoffDelays: [0, 30, 60],
      onMessage,
      onRetry,
      onDLQ,
    });

    const mockMsg = mockMessage({ requestId: "123", action: "buy" });

    await handler({
      messages: [mockMsg as any],
      metadata: {} as any,
    } as any);

    expect(onRetry).toHaveBeenCalledWith(
      mockMsg.body,
      0,
      "Trade failed",
      0 // backoff delay
    );
    expect(mockMsg.retry).toHaveBeenCalledWith({ delaySeconds: 0 });
    expect(mockMsg.ack).not.toHaveBeenCalled();
    expect(onDLQ).not.toHaveBeenCalled();
  });

  it("should move messages to DLQ after max retries", async () => {
    const onMessage = vi.fn().mockRejectedValue(new Error("Trade failed"));
    const onRetry = vi.fn();
    const onDLQ = vi.fn();

    const handler = createQueueHandler({
      maxRetries: 3,
      backoffDelays: [0, 30, 60],
      onMessage,
      onRetry,
      onDLQ,
    });

    const mockMsg = mockMessage(
      { requestId: "123", action: "buy" },
      { attempts: 4 }
    );

    await handler({
      messages: [mockMsg as any],
      metadata: {} as any,
    } as any);

    expect(onDLQ).toHaveBeenCalledWith(mockMsg.body, 3, "Trade failed");
    expect(mockMsg.retry).not.toHaveBeenCalled();
    expect(mockMsg.ack).toHaveBeenCalledTimes(1);
  });

  it("should handle multiple messages in batch", async () => {
    const onMessage = vi.fn().mockResolvedValue({ success: true });
    const onRetry = vi.fn();
    const onDLQ = vi.fn();

    const handler = createQueueHandler({
      maxRetries: 3,
      backoffDelays: [0, 30, 60],
      onMessage,
      onRetry,
      onDLQ,
    });

    const mockMsgs = [
      mockMessage({ requestId: "1", action: "buy" }, { id: "1" }),
      mockMessage({ requestId: "2", action: "sell" }, { id: "2" }),
    ];

    await handler({
      messages: mockMsgs as any,
      metadata: {} as any,
    } as any);

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, mockMsgs[0]!.body, 0);
    expect(onMessage).toHaveBeenNthCalledWith(2, mockMsgs[1]!.body, 0);
  });

  describe("concurrency", () => {
    it("concurrency=1 processes messages serially (default behavior)", async () => {
      const order: string[] = [];
      let inFlight = 0;
      let maxInFlight = 0;

      const handler = createQueueHandler({
        maxRetries: 3,
        backoffDelays: [0, 30, 60],
        concurrency: 1,
        onMessage: async (msg: { id: string }) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          order.push(`start:${msg.id}`);
          await new Promise((r) => setTimeout(r, 20));
          order.push(`end:${msg.id}`);
          inFlight--;
        },
      });

      const mockMsgs = [
        mockMessage({ id: "a" }, { id: "a" }),
        mockMessage({ id: "b" }, { id: "b" }),
        mockMessage({ id: "c" }, { id: "c" }),
      ];

      await handler({
        messages: mockMsgs as any,
        metadata: {} as any,
      } as any);

      expect(maxInFlight).toBe(1);
      expect(order).toEqual([
        "start:a",
        "end:a",
        "start:b",
        "end:b",
        "start:c",
        "end:c",
      ]);
    });

    it("concurrency=2 processes up to 2 messages in parallel", async () => {
      const order: string[] = [];
      let inFlight = 0;
      let maxInFlight = 0;

      const handler = createQueueHandler({
        maxRetries: 3,
        backoffDelays: [0, 30, 60],
        concurrency: 2,
        onMessage: async (msg: { id: string }) => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          order.push(`start:${msg.id}`);
          await new Promise((r) => setTimeout(r, 40));
          order.push(`end:${msg.id}`);
          inFlight--;
        },
      });

      const mockMsgs = [
        mockMessage({ id: "a" }, { id: "a" }),
        mockMessage({ id: "b" }, { id: "b" }),
        mockMessage({ id: "c" }, { id: "c" }),
      ];

      await handler({
        messages: mockMsgs as any,
        metadata: {} as any,
      } as any);

      expect(maxInFlight).toBe(2);
      // a and b should both start before either ends
      const startA = order.indexOf("start:a");
      const startB = order.indexOf("start:b");
      const endA = order.indexOf("end:a");
      const endB = order.indexOf("end:b");
      expect(startA).toBeGreaterThanOrEqual(0);
      expect(startB).toBeGreaterThanOrEqual(0);
      expect(Math.min(endA, endB)).toBeGreaterThan(Math.max(startA, startB));
      // all three processed
      expect(order.filter((e) => e.startsWith("start:"))).toHaveLength(3);
      expect(order.filter((e) => e.startsWith("end:"))).toHaveLength(3);
    });

    it("preserves per-message retry/DLQ under concurrency > 1", async () => {
      const onRetry = vi.fn();
      const onDLQ = vi.fn();

      const handler = createQueueHandler({
        maxRetries: 2,
        backoffDelays: [10, 20],
        concurrency: 2,
        onMessage: async (msg: { id: string }) => {
          if (msg.id === "fail-retry") {
            throw new Error("retry-me");
          }
          if (msg.id === "fail-dlq") {
            throw new Error("dlq-me");
          }
          // success
        },
        onRetry,
        onDLQ,
      });

      const ok = mockMessage({ id: "ok" }, { id: "ok", attempts: 0 });
      const failRetry = mockMessage(
        { id: "fail-retry" },
        { id: "fail-retry", attempts: 0 }
      );
      const failDlq = mockMessage(
        { id: "fail-dlq" },
        { id: "fail-dlq", attempts: 3 }
      );

      await handler({
        messages: [ok, failRetry, failDlq] as any,
        metadata: {} as any,
      } as any);

      expect(ok.retry).not.toHaveBeenCalled();
      expect(ok.ack).toHaveBeenCalledTimes(1);
      expect(failRetry.retry).toHaveBeenCalledWith({ delaySeconds: 10 });
      expect(failRetry.ack).not.toHaveBeenCalled();
      expect(onRetry).toHaveBeenCalledWith(failRetry.body, 0, "retry-me", 10);
      expect(failDlq.retry).not.toHaveBeenCalled();
      expect(failDlq.ack).toHaveBeenCalledTimes(1);
      expect(onDLQ).toHaveBeenCalledWith(failDlq.body, 2, "dlq-me");
    });

    it("acks after onDLQ even when the hook throws (does not fail the batch)", async () => {
      const ok = mockMessage({ id: "ok" }, { id: "ok", attempts: 1 });
      const fail = mockMessage({ id: "fail" }, { id: "fail", attempts: 1 });
      const onOk = vi.fn();
      const mixed = createQueueHandler({
        maxRetries: 0,
        backoffDelays: [0],
        onMessage: async (msg: { id: string }) => {
          if (msg.id === "fail") throw new Error("boom");
          onOk();
        },
        onDLQ: async () => {
          throw new Error("dlq-hook-failed");
        },
      });

      await mixed({
        messages: [ok, fail] as any,
        metadata: {} as any,
      } as any);

      expect(onOk).toHaveBeenCalled();
      expect(ok.ack).toHaveBeenCalledTimes(1);
      expect(fail.ack).toHaveBeenCalledTimes(1);
      expect(fail.retry).not.toHaveBeenCalled();
    });

    it("treats invalid concurrency as serial (1)", async () => {
      let inFlight = 0;
      let maxInFlight = 0;

      const handler = createQueueHandler({
        maxRetries: 1,
        backoffDelays: [0],
        concurrency: 0 as unknown as number,
        onMessage: async () => {
          inFlight++;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await new Promise((r) => setTimeout(r, 15));
          inFlight--;
        },
      });

      await handler({
        messages: [
          mockMessage({ id: "1" }, { id: "1" }),
          mockMessage({ id: "2" }, { id: "2" }),
        ] as any,
        metadata: {} as any,
      } as any);

      expect(maxInFlight).toBe(1);
    });
  });
});
