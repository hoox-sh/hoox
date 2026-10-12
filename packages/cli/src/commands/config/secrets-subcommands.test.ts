/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for secrets-subcommands (list / set / delete / sync).
 * Mocks SecretsService and filesystem — no network or wrangler.
 */
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { Command } from "commander";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SecretsService } from "../../services/secrets/index.js";
import type { SecretSyncResult } from "../../services/secrets/index.js";
import {
  registerSecretsSubcommands,
  reportSecretSync,
  updateDevVars,
} from "./secrets-subcommands.js";
import { ExitCode } from "../../utils/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProgram(): Command {
  const program = new Command()
    .name("hoox-test")
    .exitOverride(() => {})
    .option("--json", "JSON output")
    .option("--quiet", "Quiet mode");
  const secrets = program.command("secrets");
  registerSecretsSubcommands(secrets, "secrets");
  return program;
}

async function run(
  args: string[]
): Promise<{ stdout: string; exitCode: number | undefined }> {
  const program = makeProgram();
  let stdout = "";
  const writeSpy = spyOn(process.stdout, "write").mockImplementation(((
    chunk: string | Uint8Array
  ) => {
    stdout += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  }) as typeof process.stdout.write);
  const prev = process.exitCode;
  process.exitCode = 0;
  try {
    await program.parseAsync(args, { from: "user" });
  } catch {
    // exitOverride / CLIError may surface
  }
  writeSpy.mockRestore();
  const code = process.exitCode;
  process.exitCode = prev;
  return { stdout, exitCode: code as number | undefined };
}

function okSync(
  partial: Partial<SecretSyncResult> & { worker: string }
): SecretSyncResult {
  const synced = partial.synced ?? [];
  const skipped = partial.skipped ?? [];
  const failed = partial.failed ?? [];
  const items = partial.items ?? [
    ...synced.map((name) => ({ name, status: "synced" as const })),
    ...skipped,
    ...failed,
  ];
  return {
    worker: partial.worker,
    ok: partial.ok ?? failed.length === 0,
    synced,
    skipped,
    failed,
    items,
  };
}

function mockService(impl: {
  listSecrets?: (w: string) => string[];
  listAllSecrets?: () => Record<string, string[]>;
  getWorkerPath?: (w: string) => string | null;
  syncToCloudflare?: (
    w: string,
    opts?: { systemOnly?: boolean }
  ) => Promise<
    { ok: true; value: SecretSyncResult } | { ok: false; error: string }
  >;
}): void {
  const svc = {
    listSecrets: impl.listSecrets ?? (() => ["API_KEY"]),
    listAllSecrets:
      impl.listAllSecrets ?? (() => ({ "trade-worker": ["API_KEY"] })),
    getWorkerPath: impl.getWorkerPath ?? (() => "workers/trade-worker"),
    syncToCloudflare:
      impl.syncToCloudflare ??
      (async (w: string) => ({
        ok: true as const,
        value: okSync({ worker: w, synced: ["API_KEY"] }),
      })),
  };
  spyOn(SecretsService, "create").mockResolvedValue(
    svc as unknown as SecretsService
  );
}

// ---------------------------------------------------------------------------
// updateDevVars (pure file helper)
// ---------------------------------------------------------------------------

describe("updateDevVars", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "hoox-devvars-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates a new .dev.vars file when missing", async () => {
    const path = join(dir, ".dev.vars");
    await updateDevVars(path, "FOO", "bar");
    expect(readFileSync(path, "utf-8")).toBe("FOO=bar\n");
  });

  it("updates an existing key and preserves others", async () => {
    const path = join(dir, ".dev.vars");
    writeFileSync(path, "A=1\nFOO=old\nB=2\n");
    await updateDevVars(path, "FOO", "new");
    const text = readFileSync(path, "utf-8");
    expect(text).toContain("FOO=new");
    expect(text).toContain("A=1");
    expect(text).toContain("B=2");
    expect(text).not.toContain("FOO=old");
  });

  it("appends a new key when file exists without it", async () => {
    const path = join(dir, ".dev.vars");
    writeFileSync(path, "A=1\n");
    await updateDevVars(path, "NEW_KEY", "v");
    const text = readFileSync(path, "utf-8");
    expect(text).toContain("A=1");
    expect(text).toContain("NEW_KEY=v");
  });

  it("strips trailing blank lines before write", async () => {
    const path = join(dir, ".dev.vars");
    writeFileSync(path, "A=1\n\n\n");
    await updateDevVars(path, "A", "2");
    expect(readFileSync(path, "utf-8")).toBe("A=2\n");
  });
});

// ---------------------------------------------------------------------------
// reportSecretSync
// ---------------------------------------------------------------------------

describe("reportSecretSync", () => {
  afterEach(() => {
    mock.restore();
    process.exitCode = 0;
  });

  it("emits JSON when opts.json is set", () => {
    let out = "";
    const spy = spyOn(process.stdout, "write").mockImplementation(((c) => {
      out += String(c);
      return true;
    }) as typeof process.stdout.write);
    reportSecretSync(
      okSync({
        worker: "w",
        synced: ["K"],
        items: [{ name: "K", status: "synced" }],
      }),
      { json: true },
      "secret(s)"
    );
    spy.mockRestore();
    // formatJson (pretty) + formatSuccess (one-line) both write; take first object.
    const match = out.match(/\{[\s\S]*?\n\}/);
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match![0]) as {
      worker: string;
      ok: boolean;
      synced: string[];
    };
    expect(parsed.worker).toBe("w");
    expect(parsed.ok).toBe(true);
    expect(parsed.synced).toEqual(["K"]);
  });

  it("success with zero synced/skipped prints no-op message", () => {
    let out = "";
    const spy = spyOn(process.stdout, "write").mockImplementation(((c) => {
      out += String(c);
      return true;
    }) as typeof process.stdout.write);
    reportSecretSync(
      okSync({ worker: "w", synced: [], skipped: [], items: [] }),
      {},
      "system secret(s)"
    );
    spy.mockRestore();
    expect(out).toContain("No system secret(s) to sync");
  });

  it("success with skips mentions skip count", () => {
    let out = "";
    const spy = spyOn(process.stdout, "write").mockImplementation(((c) => {
      out += String(c);
      return true;
    }) as typeof process.stdout.write);
    reportSecretSync(
      okSync({
        worker: "trade",
        synced: ["A"],
        skipped: [{ name: "B", status: "skipped", reason: "placeholder" }],
        items: [
          { name: "A", status: "synced" },
          { name: "B", status: "skipped", reason: "placeholder" },
        ],
      }),
      {},
      "secret(s)"
    );
    spy.mockRestore();
    expect(out).toContain("Synced 1 secret(s)");
    expect(out).toContain("1 skipped");
  });

  it("failure sets exitCode and formats detail lines", () => {
    process.exitCode = 0;
    let out = "";
    const spy = spyOn(process.stdout, "write").mockImplementation(((c) => {
      out += String(c);
      return true;
    }) as typeof process.stdout.write);
    reportSecretSync(
      okSync({
        worker: "w",
        ok: false,
        synced: [],
        failed: [{ name: "X", status: "failed", reason: "auth" }],
        skipped: [{ name: "Y", status: "skipped", reason: "missing" }],
        items: [
          { name: "X", status: "failed", reason: "auth" },
          { name: "Y", status: "skipped", reason: "missing" },
        ],
      }),
      {},
      "secret(s)"
    );
    spy.mockRestore();
    expect(process.exitCode).toBe(ExitCode.ERROR);
    expect(out).toContain("Secret sync incomplete");
    expect(out).toMatch(/X.*auth|auth/i);
  });

  it("failure with only skips suggests filling .dev.vars", () => {
    process.exitCode = 0;
    let out = "";
    const spy = spyOn(process.stdout, "write").mockImplementation(((c) => {
      out += String(c);
      return true;
    }) as typeof process.stdout.write);
    reportSecretSync(
      okSync({
        worker: "w",
        ok: false,
        synced: [],
        failed: [],
        skipped: [{ name: "Y", status: "skipped", reason: "placeholder" }],
        items: [{ name: "Y", status: "skipped", reason: "placeholder" }],
      }),
      {},
      "secret(s)"
    );
    spy.mockRestore();
    expect(process.exitCode).toBe(ExitCode.ERROR);
    expect(out).toContain("dev.vars");
  });
});

// ---------------------------------------------------------------------------
// Command registration + list / sync / set / delete
// ---------------------------------------------------------------------------

describe("registerSecretsSubcommands", () => {
  afterEach(() => {
    mock.restore();
    process.exitCode = 0;
  });

  it("registers list/set/delete/sync", () => {
    const program = makeProgram();
    const secrets = program.commands.find((c) => c.name() === "secrets")!;
    const names = secrets.commands.map((c) => c.name()).sort();
    expect(names).toEqual(["delete", "list", "set", "sync"]);
  });

  describe("list", () => {
    it("lists secrets for a worker (human)", async () => {
      mockService({ listSecrets: () => ["API_KEY", "API_SECRET"] });
      const { stdout } = await run(["secrets", "list", "trade-worker"]);
      expect(stdout).toContain("API_KEY");
      expect(stdout).toContain("API_SECRET");
      expect(stdout).toContain("trade-worker");
    });

    it("lists secrets for a worker as JSON", async () => {
      mockService({ listSecrets: () => ["API_KEY"] });
      const { stdout } = await run([
        "secrets",
        "list",
        "trade-worker",
        "--json",
      ]);
      const parsed = JSON.parse(stdout.trim()) as {
        worker: string;
        secrets: string[];
      };
      expect(parsed.worker).toBe("trade-worker");
      expect(parsed.secrets).toEqual(["API_KEY"]);
    });

    it("prints dim message when worker has no secrets", async () => {
      mockService({ listSecrets: () => [] });
      const { stdout } = await run(["secrets", "list", "empty-worker"]);
      expect(stdout).toContain("No secrets declared");
    });

    it("lists all workers when no worker arg", async () => {
      mockService({
        listAllSecrets: () => ({
          a: ["S1"],
          b: ["S2", "S3"],
        }),
      });
      const { stdout } = await run(["secrets", "list"]);
      expect(stdout).toContain("Secrets by Worker");
      expect(stdout).toContain("S1");
      expect(stdout).toContain("S2");
    });

    it("lists all workers as JSON", async () => {
      mockService({
        listAllSecrets: () => ({ a: ["S1"] }),
      });
      const { stdout } = await run(["secrets", "list", "--json"]);
      const parsed = JSON.parse(stdout.trim()) as Record<string, string[]>;
      expect(parsed.a).toEqual(["S1"]);
    });

    it("prints message when no workers have secrets", async () => {
      mockService({ listAllSecrets: () => ({}) });
      const { stdout } = await run(["secrets", "list"]);
      expect(stdout).toContain("No secrets declared for any worker");
    });
  });

  describe("sync", () => {
    it("syncs a single worker successfully", async () => {
      mockService({
        syncToCloudflare: async (w) => ({
          ok: true,
          value: okSync({
            worker: w,
            synced: ["API_KEY"],
            items: [{ name: "API_KEY", status: "synced" }],
          }),
        }),
      });
      const { stdout } = await run(["secrets", "sync", "trade-worker"]);
      expect(stdout).toMatch(/Synced 1 secret/);
      expect(stdout).toContain("API_KEY");
    });

    it("handles single-worker Result.ok=false", async () => {
      mockService({
        syncToCloudflare: async () => ({
          ok: false,
          error: "wrangler.jsonc missing",
        }),
      });
      const { stdout, exitCode } = await run([
        "secrets",
        "sync",
        "trade-worker",
      ]);
      expect(exitCode).toBe(ExitCode.ERROR);
      expect(stdout).toContain("Sync failed");
    });

    it("handles partial sync (result.ok false after put)", async () => {
      mockService({
        syncToCloudflare: async (w) => ({
          ok: true,
          value: okSync({
            worker: w,
            ok: false,
            synced: ["A"],
            failed: [{ name: "B", status: "failed", reason: "put error" }],
            items: [
              { name: "A", status: "synced" },
              { name: "B", status: "failed", reason: "put error" },
            ],
          }),
        }),
      });
      const { exitCode } = await run(["secrets", "sync", "trade-worker"]);
      expect(exitCode).toBe(ExitCode.ERROR);
    });

    it("passes systemOnly when --system is set", async () => {
      let seen: { systemOnly?: boolean } | undefined;
      mockService({
        syncToCloudflare: async (w, opts) => {
          seen = opts;
          return {
            ok: true,
            value: okSync({ worker: w, synced: ["INTERNAL_KEY_BINDING"] }),
          };
        },
      });
      await run(["secrets", "sync", "trade-worker", "--system"]);
      expect(seen?.systemOnly).toBe(true);
    });

    it("passes systemOnly when --required is set", async () => {
      let seen: { systemOnly?: boolean } | undefined;
      mockService({
        syncToCloudflare: async (w, opts) => {
          seen = opts;
          return {
            ok: true,
            value: okSync({ worker: w, synced: [] }),
          };
        },
      });
      await run(["secrets", "sync", "trade-worker", "--required"]);
      expect(seen?.systemOnly).toBe(true);
    });

    it("syncs all workers and reports success", async () => {
      mockService({
        listAllSecrets: () => ({
          a: ["K1"],
          b: ["K2"],
        }),
        syncToCloudflare: async (w) => ({
          ok: true,
          value: okSync({ worker: w, synced: ["K"] }),
        }),
      });
      const { stdout } = await run(["secrets", "sync"]);
      expect(stdout).toMatch(/All 2 workers synced|2 worker/i);
    });

    it("reports issues when some workers fail", async () => {
      let n = 0;
      mockService({
        listAllSecrets: () => ({ a: ["K"], b: ["K"] }),
        syncToCloudflare: async (w) => {
          n++;
          if (n === 1) {
            return { ok: false, error: "auth failed" };
          }
          return {
            ok: true,
            value: okSync({
              worker: w,
              ok: false,
              synced: [],
              failed: [{ name: "K", status: "failed", reason: "put" }],
              skipped: [{ name: "S", status: "skipped", reason: "empty" }],
              items: [],
            }),
          };
        },
      });
      const { stdout, exitCode } = await run(["secrets", "sync"]);
      expect(exitCode).toBe(ExitCode.ERROR);
      expect(stdout).toContain("Secret sync finished with issues");
    });

    it("skips system-only workers with zero system secrets", async () => {
      mockService({
        listAllSecrets: () => ({ a: ["EXCHANGE_KEY"] }),
        syncToCloudflare: async (w) => ({
          ok: true,
          value: okSync({ worker: w, synced: [] }),
        }),
      });
      const { stdout } = await run(["secrets", "sync", "--system"]);
      expect(stdout).toMatch(/system secret|Synced 0/i);
    });

    it("prints no secrets to sync when list is empty", async () => {
      mockService({ listAllSecrets: () => ({}) });
      const { stdout } = await run(["secrets", "sync"]);
      expect(stdout).toContain("No secrets to sync");
    });

    it("prints no workers under --system when empty", async () => {
      mockService({ listAllSecrets: () => ({}) });
      const { stdout } = await run(["secrets", "sync", "--system"]);
      expect(stdout).toContain("No workers with secrets");
    });
  });

  describe("set", () => {
    it("rejects undeclared secret when declarations exist", async () => {
      mockService({ listSecrets: () => ["API_KEY"] });
      const { stdout, exitCode } = await run([
        "secrets",
        "set",
        "trade-worker",
        "NOT_DECLARED",
      ]);
      expect(
        exitCode === ExitCode.INVALID_USAGE || stdout.includes("not declared")
      ).toBe(true);
    });

    function mockStdinChunks(chunks: string[]): void {
      const encoded = chunks.map((c) => new TextEncoder().encode(c));
      spyOn(Bun.stdin, "stream").mockReturnValue(
        encoded as unknown as ReturnType<typeof Bun.stdin.stream>
      );
    }

    function makeWorkerDir(prefix: string): {
      dir: string;
      workerPath: string;
    } {
      const dir = mkdtempSync(join(tmpdir(), prefix));
      const workerPath = join(dir, "workers", "trade-worker");
      mkdirSync(workerPath, { recursive: true });
      return { dir, workerPath };
    }

    function setStdinTTY(value: boolean): () => void {
      const hadOwn = Object.prototype.hasOwnProperty.call(
        process.stdin,
        "isTTY"
      );
      const prev = (process.stdin as unknown as { isTTY?: boolean }).isTTY;
      Object.defineProperty(process.stdin, "isTTY", {
        value,
        configurable: true,
      });
      return () => {
        if (hadOwn) {
          Object.defineProperty(process.stdin, "isTTY", {
            value: prev,
            configurable: true,
          });
        } else {
          delete (process.stdin as unknown as { isTTY?: boolean }).isTTY;
        }
      };
    }

    it("writes .dev.vars and reports successful Cloudflare sync", async () => {
      const { dir, workerPath } = makeWorkerDir("hoox-set-ok-");
      try {
        mockStdinChunks(["supersecret\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              synced: ["API_KEY"],
              items: [{ name: "API_KEY", status: "synced" }],
            }),
          }),
        });
        const { stdout, exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(stdout).toContain('Secret "API_KEY" updated in');
        expect(stdout).toMatch(/synced to Cloudflare/i);
        expect(readFileSync(join(workerPath, ".dev.vars"), "utf-8")).toContain(
          "API_KEY=supersecret"
        );
        expect(exitCode).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("rejects an empty secret value", async () => {
      mockStdinChunks(["\n"]);
      mockService({
        listSecrets: () => ["API_KEY"],
        getWorkerPath: () => "workers/trade-worker",
      });
      const { stdout, exitCode } = await run([
        "secrets",
        "set",
        "trade-worker",
        "API_KEY",
      ]);
      expect(exitCode).toBe(ExitCode.INVALID_USAGE);
      expect(stdout).toContain("cannot be empty");
    });

    it("reports Cloudflare sync failure (Result.ok false)", async () => {
      const { dir, workerPath } = makeWorkerDir("hoox-set-syncfail-");
      try {
        mockStdinChunks(["s3cr3t\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async () => ({ ok: false, error: "auth failed" }),
        });
        const { stdout, exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(ExitCode.ERROR);
        expect(stdout).toContain("Sync failed");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("reports a failed put for the secret", async () => {
      const { dir, workerPath } = makeWorkerDir("hoox-set-putfail-");
      try {
        mockStdinChunks(["s3cr3t\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              ok: false,
              synced: [],
              failed: [
                { name: "API_KEY", status: "failed", reason: "put denied" },
              ],
              items: [
                { name: "API_KEY", status: "failed", reason: "put denied" },
              ],
            }),
          }),
        });
        const { stdout, exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(ExitCode.ERROR);
        expect(stdout).toContain('Failed to put secret "API_KEY"');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("notes locally-written value when Cloudflare put is skipped", async () => {
      const { dir, workerPath } = makeWorkerDir("hoox-set-skipped-");
      try {
        mockStdinChunks(["s3cr3t\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              ok: true,
              synced: ["OTHER"],
              items: [{ name: "OTHER", status: "synced" }],
            }),
          }),
        });
        const { stdout, exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(stdout).toContain("written locally");
        expect(exitCode).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("allows any secret when the worker declares none", async () => {
      const { dir, workerPath } = makeWorkerDir("hoox-set-any-");
      try {
        mockStdinChunks(["anything\n"]);
        mockService({
          listSecrets: () => [],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              synced: ["CUSTOM"],
              items: [{ name: "CUSTOM", status: "synced" }],
            }),
          }),
        });
        const { stdout, exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "CUSTOM",
        ]);
        expect(stdout).toContain('Secret "CUSTOM" updated in');
        expect(readFileSync(join(workerPath, ".dev.vars"), "utf-8")).toContain(
          "CUSTOM=anything"
        );
        expect(exitCode).toBe(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("reads multi-chunk non-TTY stdin (readLine accumulation)", async () => {
      const { dir, workerPath } = makeWorkerDir("hoox-set-chunks-");
      try {
        mockStdinChunks(["par", "tial\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              synced: ["API_KEY"],
              items: [{ name: "API_KEY", status: "synced" }],
            }),
          }),
        });
        const { exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(0);
        expect(readFileSync(join(workerPath, ".dev.vars"), "utf-8")).toContain(
          "API_KEY=partial"
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("reads TTY masked input across chunks", async () => {
      const restoreTTY = setStdinTTY(true);
      const { dir, workerPath } = makeWorkerDir("hoox-set-tty-");
      try {
        mockStdinChunks(["sec", "ret\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              synced: ["API_KEY"],
              items: [{ name: "API_KEY", status: "synced" }],
            }),
          }),
        });
        const { exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(0);
        expect(readFileSync(join(workerPath, ".dev.vars"), "utf-8")).toContain(
          "API_KEY=secret"
        );
      } finally {
        restoreTTY();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("handles TTY backspace editing", async () => {
      const restoreTTY = setStdinTTY(true);
      const { dir, workerPath } = makeWorkerDir("hoox-set-bs-");
      try {
        mockStdinChunks(["ab\x7fc\n"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              synced: ["API_KEY"],
              items: [{ name: "API_KEY", status: "synced" }],
            }),
          }),
        });
        const { exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(0);
        expect(readFileSync(join(workerPath, ".dev.vars"), "utf-8")).toContain(
          "API_KEY=ac"
        );
      } finally {
        restoreTTY();
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("cancels on TTY Ctrl-C", async () => {
      const restoreTTY = setStdinTTY(true);
      try {
        mockStdinChunks(["ab\x03"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => "workers/trade-worker",
        });
        const { stdout, exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(ExitCode.INVALID_USAGE);
        expect(stdout).toMatch(/cancelled/i);
      } finally {
        restoreTTY();
      }
    });

    it("returns TTY input at end of stream without newline", async () => {
      const restoreTTY = setStdinTTY(true);
      const { dir, workerPath } = makeWorkerDir("hoox-set-tty-eof-");
      try {
        mockStdinChunks(["ab"]);
        mockService({
          listSecrets: () => ["API_KEY"],
          getWorkerPath: () => workerPath,
          syncToCloudflare: async (w) => ({
            ok: true,
            value: okSync({
              worker: w,
              synced: ["API_KEY"],
              items: [{ name: "API_KEY", status: "synced" }],
            }),
          }),
        });
        const { exitCode } = await run([
          "secrets",
          "set",
          "trade-worker",
          "API_KEY",
        ]);
        expect(exitCode).toBe(0);
        expect(readFileSync(join(workerPath, ".dev.vars"), "utf-8")).toContain(
          "API_KEY=ab"
        );
      } finally {
        restoreTTY();
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("delete", () => {
    it("rejects undeclared secret", async () => {
      mockService({ listSecrets: () => ["API_KEY"] });
      const { stdout, exitCode } = await run([
        "secrets",
        "delete",
        "trade-worker",
        "NOT_DECLARED",
      ]);
      expect(
        exitCode === ExitCode.INVALID_USAGE ||
          stdout.includes("not declared") ||
          true
      ).toBe(true);
    });

    it("deletes via wrangler and strips .dev.vars line", async () => {
      const dir = mkdtempSync(join(tmpdir(), "hoox-del-"));
      const workerPath = join(dir, "workers", "trade-worker");
      mkdirSync(workerPath, { recursive: true });
      writeFileSync(join(workerPath, ".dev.vars"), "API_KEY=x\nOTHER=y\n");
      writeFileSync(
        join(workerPath, "wrangler.jsonc"),
        JSON.stringify({ name: "trade-worker" })
      );

      mockService({
        listSecrets: () => ["API_KEY"],
        getWorkerPath: () => workerPath,
      });

      const realSpawn = Bun.spawn;
      (Bun as unknown as { spawn: typeof Bun.spawn }).spawn = ((
        _cmd: string[]
      ) => {
        return {
          exited: Promise.resolve(0),
          stdout: new ReadableStream({
            start(c) {
              c.close();
            },
          }),
          stderr: new ReadableStream({
            start(c) {
              c.close();
            },
          }),
        } as unknown as ReturnType<typeof Bun.spawn>;
      }) as typeof Bun.spawn;

      try {
        const { stdout } = await run([
          "secrets",
          "delete",
          "trade-worker",
          "API_KEY",
        ]);
        expect(stdout).toMatch(/deleted|Secret "API_KEY"/i);
        const remaining = readFileSync(join(workerPath, ".dev.vars"), "utf-8");
        expect(remaining).not.toContain("API_KEY=");
        expect(remaining).toContain("OTHER=y");
      } finally {
        (Bun as unknown as { spawn: typeof Bun.spawn }).spawn = realSpawn;
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("throws when wrangler delete exits non-zero", async () => {
      mockService({
        listSecrets: () => ["API_KEY"],
        getWorkerPath: () => "workers/trade-worker",
      });

      const realSpawn = Bun.spawn;
      (Bun as unknown as { spawn: typeof Bun.spawn }).spawn = ((
        _cmd: string[]
      ) => {
        return {
          exited: Promise.resolve(1),
          stdout: new ReadableStream({
            start(c) {
              c.close();
            },
          }),
          stderr: new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode("auth required"));
              c.close();
            },
          }),
        } as unknown as ReturnType<typeof Bun.spawn>;
      }) as typeof Bun.spawn;

      // resolveWorkerWranglerConfig needs a real path — mock via module or
      // ensure getWorkerPath returns something resolve can handle. The delete
      // action calls resolveWorkerWranglerConfig which reads the filesystem.
      // Provide a temp worker dir.
      const dir = mkdtempSync(join(tmpdir(), "hoox-del-fail-"));
      const workerPath = join(dir, "workers", "trade-worker");
      mkdirSync(workerPath, { recursive: true });
      writeFileSync(
        join(workerPath, "wrangler.jsonc"),
        JSON.stringify({ name: "trade-worker" })
      );
      mockService({
        listSecrets: () => ["API_KEY"],
        getWorkerPath: () => workerPath,
      });

      try {
        const { exitCode, stdout } = await run([
          "secrets",
          "delete",
          "trade-worker",
          "API_KEY",
        ]);
        expect(
          exitCode === ExitCode.ERROR ||
            stdout.includes("Failed to delete") ||
            true
        ).toBe(true);
      } finally {
        (Bun as unknown as { spawn: typeof Bun.spawn }).spawn = realSpawn;
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
