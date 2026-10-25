/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, mock } from "bun:test";
import { subscribeSSE } from "../src/sse";

function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i++;
    },
  });
}

describe("subscribeSSE", () => {
  it("parses data: lines with and without a space after the colon", async () => {
    const events: Array<{ n: number }> = [];
    const fetchMock = mock((_url: string) =>
      Promise.resolve(
        new Response(sseStream(['data:{"n":1}\n', 'data: {"n":2}\n']), {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
      )
    );
    const orig = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const sub = subscribeSSE<{ n: number }>("/v1/trades/stream", (e) =>
      events.push(e)
    );
    await new Promise((r) => setTimeout(r, 30));
    sub.abort();
    globalThis.fetch = orig;
    expect(events.map((e) => e.n)).toEqual([1, 2]);
  });
});
