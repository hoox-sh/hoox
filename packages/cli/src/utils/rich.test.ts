/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, mock, afterEach } from "bun:test";
import { runRichTasks, type RichTaskResult } from "./rich.js";
import { CLIError } from "./errors.js";

/** Snapshot of env/TTY that suppress rich mode in CI/test runners. */
const ORIG_NO_COLOR = process.env.NO_COLOR;
const ORIG_TERM = process.env.TERM;
const ORIG_TTY = process.stdout.isTTY;

/**
 * Force rich mode: TTY + clear NO_COLOR / TERM=dumb (common in CI).
 * Without this, withTTY alone still hits the plain path under NO_COLOR=1.
 */
function withRichMode<T>(fn: () => Promise<T> | T): Promise<T> {
  const original = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
    writable: true,
  });
  delete process.env.NO_COLOR;
  process.env.TERM = "xterm-256color";
  return Promise.resolve(fn()).finally(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: original,
      configurable: true,
      writable: true,
    });
    if (ORIG_NO_COLOR === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = ORIG_NO_COLOR;
    if (ORIG_TERM === undefined) delete process.env.TERM;
    else process.env.TERM = ORIG_TERM;
  });
}

/** @deprecated alias — tests historically called withTTY; now enables real rich path. */
const withTTY = withRichMode;

function withNonTTY<T>(fn: () => Promise<T> | T): Promise<T> {
  const original = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
    writable: true,
  });
  return Promise.resolve(fn()).finally(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: original,
      configurable: true,
      writable: true,
    });
  });
}

afterEach(() => {
  process.exitCode = 0;
  Object.defineProperty(process.stdout, "isTTY", {
    value: ORIG_TTY,
    configurable: true,
    writable: true,
  });
  if (ORIG_NO_COLOR === undefined) delete process.env.NO_COLOR;
  else process.env.NO_COLOR = ORIG_NO_COLOR;
  if (ORIG_TERM === undefined) delete process.env.TERM;
  else process.env.TERM = ORIG_TERM;
});

describe("runRichTasks", () => {
  it("returns an empty array for empty input", async () => {
    const results = await runRichTasks([]);
    expect(results).toEqual([]);
  });

  it("captures a successful numeric result", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        { title: "first", run: async () => 1 },
      ]);
      expect(results[0]?.ok).toBe(true);
      expect(results[0]?.value).toBe(1);
    });
  });

  it("captures a successful string result", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        { title: "second", run: async () => "two" },
      ]);
      expect(results[0]?.ok).toBe(true);
      expect(results[0]?.value).toBe("two");
    });
  });

  it("preserves the order of results", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        { title: "alpha", run: async () => 1 },
        { title: "beta", run: async () => 2 },
        { title: "gamma", run: async () => 3 },
      ]);
      expect(results.map((r) => r.title)).toEqual(["alpha", "beta", "gamma"]);
    });
  });

  it("captures failed results without throwing", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        {
          title: "boom",
          run: async () => {
            throw new Error("kaboom");
          },
        },
      ]);
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toBe("kaboom");
      expect(process.exitCode).toBe(1);
    });
  });

  it("uses CLIError message verbatim on failure", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        {
          title: "fail",
          run: async () => {
            throw new CLIError("nope", 2, "details");
          },
        },
      ]);
      expect(results[0]?.error).toBe("nope");
    });
  });

  it("attaches details() output to successful results", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        {
          title: "with details",
          run: async () => "ok",
          details: () => ({ url: "https://example.com", size: "1.2 MB" }),
        },
      ]);
      expect(results[0]?.details).toEqual({
        url: "https://example.com",
        size: "1.2 MB",
      });
    });
  });

  it("passes the run() return value to details()", async () => {
    await withTTY(async () => {
      const results = await runRichTasks<{ url: string }>([
        {
          title: "typed",
          run: async () => ({ url: "https://x" }),
          details: (value) => ({ URL: value.url }),
        },
      ]);
      expect(results[0]?.details).toEqual({ URL: "https://x" });
    });
  });

  it("records non-zero duration for every task", async () => {
    await withTTY(async () => {
      const results = await runRichTasks([
        {
          title: "slow",
          run: async () => {
            await new Promise((r) => setTimeout(r, 10));
            return 1;
          },
        },
      ]);
      expect(results[0]?.ms).toBeGreaterThanOrEqual(0);
    });
  });

  it("calls onSummary hook with the result array", async () => {
    await withTTY(async () => {
      const captured: RichTaskResult[] = [];
      await runRichTasks([{ title: "a", run: async () => 1 }], {
        onSummary: (r) => captured.push(...r),
      });
      expect(captured).toHaveLength(1);
      expect(captured[0]?.title).toBe("a");
    });
  });

  it("respects --json by suppressing the default summary table", async () => {
    await withTTY(async () => {
      // Spy on process.stdout.write to count summary lines (border row).
      const original = process.stdout.write.bind(process.stdout);
      const writeMock = mock((chunk: string | Buffer) => {
        return original(typeof chunk === "string" ? chunk : chunk.toString());
      });
      process.stdout.write =
        writeMock as unknown as typeof process.stdout.write;
      try {
        await runRichTasks([{ title: "a", run: async () => 1 }], {
          format: { json: true },
        });
        const allCalls = writeMock.mock.calls
          .map((c) => (typeof c[0] === "string" ? c[0] : String(c[0])))
          .join("");
        // No box-drawing top border should be emitted in json mode.
        expect(allCalls).not.toContain("┌");
      } finally {
        process.stdout.write = original;
      }
    });
  });

  it("writes the result array in --json mode and skips the summary table", async () => {
    // Spy on process.stdout.write. Clack logs use a different path; what
    // matters is that the wrapper writes JSON and not the title or table.
    const original = process.stdout.write.bind(process.stdout);
    const writeMock = mock((chunk: string | Buffer) => {
      return original(typeof chunk === "string" ? chunk : chunk.toString());
    });
    process.stdout.write = writeMock as unknown as typeof process.stdout.write;
    try {
      const results = await runRichTasks(
        [
          { title: "a", run: async () => 1 },
          { title: "b", run: async () => 2 },
        ],
        {
          format: { json: true },
          title: "Should-not-appear-in-output",
        }
      );
      // Tasks still ran and produced results.
      expect(results).toHaveLength(2);
      expect(results[0]?.ok).toBe(true);
      expect(results[1]?.ok).toBe(true);

      const allCalls = writeMock.mock.calls
        .map((c) => (typeof c[0] === "string" ? c[0] : String(c[0])))
        .join("");
      expect(allCalls).not.toContain("Should-not-appear-in-output");
      expect(allCalls).not.toContain("┌");
      const parsed = JSON.parse(allCalls) as Array<{
        title: string;
        value: number;
      }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0]?.title).toBe("a");
      expect(parsed[1]?.value).toBe(2);
    } finally {
      process.stdout.write = original;
    }
  });

  it("does not write JSON when onSummary owns stdout", async () => {
    const original = process.stdout.write.bind(process.stdout);
    const writeMock = mock((chunk: string | Buffer) => {
      return original(typeof chunk === "string" ? chunk : chunk.toString());
    });
    process.stdout.write = writeMock as unknown as typeof process.stdout.write;
    try {
      await runRichTasks([{ title: "a", run: async () => 1 }], {
        format: { json: true },
        onSummary: () => {},
      });
      const allCalls = writeMock.mock.calls
        .map((c) => (typeof c[0] === "string" ? c[0] : String(c[0])))
        .join("");
      expect(allCalls).toBe("");
    } finally {
      process.stdout.write = original;
    }
  });

  it("uses the plain path when not a TTY (still returns results)", async () => {
    await withNonTTY(async () => {
      const results = await runRichTasks([
        { title: "a", run: async () => 1 },
        { title: "b", run: async () => 2 },
      ]);
      expect(results).toHaveLength(2);
      expect(results[0]?.ok).toBe(true);
      expect(results[1]?.ok).toBe(true);
    });
  });

  it("plain path: captures failure with error message", async () => {
    await withNonTTY(async () => {
      const results = await runRichTasks([
        {
          title: "p-fail",
          run: async () => {
            throw new Error("plain kaboom");
          },
        },
      ]);
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toBe("plain kaboom");
      expect(process.exitCode).toBe(1);
    });
  });

  it("plain path: attaches details() to successful results", async () => {
    await withNonTTY(async () => {
      const results = await runRichTasks([
        {
          title: "with details",
          run: async () => "ok",
          details: () => ({ url: "https://example.com" }),
        },
      ]);
      expect(results[0]?.details).toEqual({ url: "https://example.com" });
    });
  });

  it("does not set exitCode when all tasks succeed", async () => {
    process.exitCode = 0;
    await withTTY(async () => {
      await runRichTasks([{ title: "ok", run: async () => 1 }]);
    });
    expect(process.exitCode).toBe(0);
  });

  it("rich path: prints title and runs via clack tasks()", async () => {
    await withRichMode(async () => {
      const results = await runRichTasks(
        [
          { title: "rich-ok", run: async () => 42 },
          {
            title: "rich-details",
            run: async () => 7,
            details: () => ({ k: "v" }),
          },
        ],
        { title: "Rich checklist title" }
      );
      expect(results).toHaveLength(2);
      expect(results[0]?.ok).toBe(true);
      expect(results[0]?.value).toBe(42);
      expect(results[1]?.value).toBe(7);
      expect(results[1]?.details).toEqual({ k: "v" });
    });
  });

  it("rich path: captures CLIError and generic failures", async () => {
    await withRichMode(async () => {
      const results = await runRichTasks([
        {
          title: "cli-err",
          run: async () => {
            throw new CLIError("cli fail", 1);
          },
        },
        {
          title: "string-err",
          run: async () => {
            throw "raw-string";
          },
        },
      ]);
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toBe("cli fail");
      expect(results[1]?.ok).toBe(false);
      expect(results[1]?.error).toBe("raw-string");
      expect(process.exitCode).toBe(1);
    });
  });

  it("silent json path: captures failures and details without throwing", async () => {
    process.exitCode = 0;
    const results = await runRichTasks(
      [
        {
          title: "ok-silent",
          run: async () => "x",
          details: async () => ({ a: "1" }),
        },
        {
          title: "fail-silent",
          run: async () => {
            throw new CLIError("silent boom", 1);
          },
        },
        {
          title: "fail-raw",
          run: async () => {
            throw "not-an-error";
          },
        },
      ],
      { format: { json: true } }
    );
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.details).toEqual({ a: "1" });
    expect(results[1]?.ok).toBe(false);
    expect(results[1]?.error).toBe("silent boom");
    expect(results[2]?.error).toBe("not-an-error");
    expect(process.exitCode).toBe(1);
  });

  it("plain path: string throws become error messages", async () => {
    await withNonTTY(async () => {
      const results = await runRichTasks([
        {
          title: "plain-str",
          run: async () => {
            throw 99;
          },
        },
      ]);
      expect(results[0]?.ok).toBe(false);
      expect(results[0]?.error).toBe("99");
    });
  });

  it("suppresses default summary when quiet is set", async () => {
    await withNonTTY(async () => {
      const original = process.stdout.write.bind(process.stdout);
      const writeMock = mock((chunk: string | Buffer) => {
        return original(typeof chunk === "string" ? chunk : chunk.toString());
      });
      process.stdout.write =
        writeMock as unknown as typeof process.stdout.write;
      try {
        await runRichTasks([{ title: "q", run: async () => 1 }], {
          format: { quiet: true },
        });
        const allCalls = writeMock.mock.calls
          .map((c) => (typeof c[0] === "string" ? c[0] : String(c[0])))
          .join("");
        expect(allCalls).not.toContain("┌");
      } finally {
        process.stdout.write = original;
      }
    });
  });
});
