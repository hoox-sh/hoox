/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for the monitor command.
 *
 * Stubs DbService and KvSyncService prototypes to verify
 * the monitor command logic in isolation. Uses Commander's exitOverride to
 * suppress process exits during test runs.
 *
 * Note: 'hoox monitor status' was removed in v0.7.5 — use 'hoox check health'.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { DbService } from "../../services/db/db-service.js";
import { KvSyncService } from "../../services/kv/kv-sync-service.js";

// Stub variables
let resolveDbNameMock: ReturnType<typeof mock>;
let queryMock: ReturnType<typeof mock>;
let exportMock: ReturnType<typeof mock>;
let resolveNamespaceIdMock: ReturnType<typeof mock>;
let getMock: ReturnType<typeof mock>;
let setMock: ReturnType<typeof mock>;

// Preserve originals
const origResolveDbName = DbService.prototype.resolveDbName;
const origQuery = DbService.prototype.query;
const origExport = DbService.prototype.export;
const origResolveNs = KvSyncService.prototype.resolveNamespaceId;
const origGet = KvSyncService.prototype.get;
const origSet = KvSyncService.prototype.set;

beforeEach(() => {
  mock.restore();
  process.exitCode = 0;

  // Restore originals
  (DbService.prototype as unknown as Record<string, unknown>).resolveDbName =
    origResolveDbName;
  (DbService.prototype as unknown as Record<string, unknown>).query = origQuery;
  (DbService.prototype as unknown as Record<string, unknown>).export =
    origExport;
  (
    KvSyncService.prototype as unknown as Record<string, unknown>
  ).resolveNamespaceId = origResolveNs;
  (KvSyncService.prototype as unknown as Record<string, unknown>).get = origGet;
  (KvSyncService.prototype as unknown as Record<string, unknown>).set = origSet;

  // Fresh mocks
  resolveDbNameMock = mock(async () => "trade-data-db");
  queryMock = mock(
    async (_dbName: string, _sql: string, _remote: boolean) =>
      "[mock query result]"
  );
  exportMock = mock(async (_dbName: string) => "backup-2026-05-13.sql");
  resolveNamespaceIdMock = mock(async () => "ns-id-123");
  getMock = mock(async (_nsId: string, _key: string) => "false");
  setMock = mock(async (_nsId: string, _key: string, _value: string) => {});

  // Install mocks on prototypes
  (DbService.prototype as unknown as Record<string, unknown>).resolveDbName =
    resolveDbNameMock;
  (DbService.prototype as unknown as Record<string, unknown>).query = queryMock;
  (DbService.prototype as unknown as Record<string, unknown>).export =
    exportMock;
  (
    KvSyncService.prototype as unknown as Record<string, unknown>
  ).resolveNamespaceId = resolveNamespaceIdMock;
  (KvSyncService.prototype as unknown as Record<string, unknown>).get = getMock;
  (KvSyncService.prototype as unknown as Record<string, unknown>).set = setMock;
});

afterEach(() => {
  mock.restore();
  (DbService.prototype as unknown as Record<string, unknown>).resolveDbName =
    origResolveDbName;
  (DbService.prototype as unknown as Record<string, unknown>).query = origQuery;
  (DbService.prototype as unknown as Record<string, unknown>).export =
    origExport;
  (
    KvSyncService.prototype as unknown as Record<string, unknown>
  ).resolveNamespaceId = origResolveNs;
  (KvSyncService.prototype as unknown as Record<string, unknown>).get = origGet;
  (KvSyncService.prototype as unknown as Record<string, unknown>).set = origSet;
});

async function importMonitorCommand(): Promise<{
  registerMonitorCommand: typeof import("./monitor-command.js").registerMonitorCommand;
}> {
  return import("./monitor-command.js");
}

async function createProgram(): Promise<Command> {
  const { registerMonitorCommand } = await importMonitorCommand();
  const program = new Command().name("hoox-test").exitOverride(() => {});
  registerMonitorCommand(program);
  return program;
}

describe("registerMonitorCommand", () => {
  // -- Command registration -------------------------------------------------

  it("registers 'monitor' as a command on the program", async () => {
    const program = await createProgram();
    const cmd = program.commands.find((c) => c.name() === "monitor");
    expect(cmd).toBeDefined();
  });

  it("does NOT register 'monitor status' (use 'hoox check health' instead)", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const statusCmd = monitorCmd.commands.find((c) => c.name() === "status");
    expect(statusCmd).toBeUndefined();
  });

  it("registers 'monitor trades' subcommand with argument", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const tradesCmd = monitorCmd.commands.find((c) => c.name() === "trades");
    expect(tradesCmd).toBeDefined();
    const args = tradesCmd!.registeredArguments;
    expect(args.some((a) => a.name() === "limit")).toBe(true);
  });

  it("registers 'monitor logs' subcommand with optional argument", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const logsCmd = monitorCmd.commands.find((c) => c.name() === "logs");
    expect(logsCmd).toBeDefined();
  });

  it("registers 'monitor kill-switch' with show/on/off subcommands", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const ksCmd = monitorCmd.commands.find((c) => c.name() === "kill-switch");
    expect(ksCmd).toBeDefined();
    expect(ksCmd!.commands.find((c) => c.name() === "show")).toBeDefined();
    expect(ksCmd!.commands.find((c) => c.name() === "on")).toBeDefined();
    expect(ksCmd!.commands.find((c) => c.name() === "off")).toBeDefined();
  });

  it("registers 'monitor queue-depth' subcommand", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const qCmd = monitorCmd.commands.find((c) => c.name() === "queue-depth");
    expect(qCmd).toBeDefined();
  });

  it("registers 'monitor backup' subcommand", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const backupCmd = monitorCmd.commands.find((c) => c.name() === "backup");
    expect(backupCmd).toBeDefined();
  });

  // -- monitor trades -------------------------------------------------------

  describe("monitor trades", () => {
    it("calls db.query with trades table", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "trades"], { from: "user" });
      expect(resolveDbNameMock).toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalled();
      const sql = queryMock.mock.calls[0]?.[1] as string;
      expect(sql).toContain("trades");
      expect(sql).toContain("ORDER BY timestamp DESC");
    });

    it("accepts custom limit", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "trades", "25"], { from: "user" });
      const sql = queryMock.mock.calls[0]?.[1] as string;
      expect(sql).toContain("LIMIT 25");
    });
  });

  // -- monitor kill-switch --------------------------------------------------

  describe("monitor kill-switch", () => {
    it("shows kill switch status", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "show"], {
        from: "user",
      });
      expect(getMock).toHaveBeenCalledWith("ns-id-123", "trade:kill_switch");
      expect(getMock).toHaveBeenCalledWith("ns-id-123", "global:kill_switch");
    });

    it("turns kill switch on", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "on"], {
        from: "user",
      });
      expect(setMock).toHaveBeenCalledWith(
        "ns-id-123",
        "trade:kill_switch",
        "true"
      );
      expect(setMock).toHaveBeenCalledWith(
        "ns-id-123",
        "global:kill_switch",
        "true"
      );
    });

    it("turns kill switch off", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "off"], {
        from: "user",
      });
      expect(setMock).toHaveBeenCalledWith(
        "ns-id-123",
        "trade:kill_switch",
        "false"
      );
      expect(setMock).toHaveBeenCalledWith(
        "ns-id-123",
        "global:kill_switch",
        "false"
      );
    });
  });

  // -- monitor backup -------------------------------------------------------

  describe("monitor backup", () => {
    it("calls db.export", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "backup"], { from: "user" });
      expect(exportMock).toHaveBeenCalled();
    });

    it("sets exitCode when export fails", async () => {
      exportMock = mock(async () => {
        throw new Error("export failed");
      });
      (DbService.prototype as unknown as Record<string, unknown>).export =
        exportMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "backup"], { from: "user" });
      expect(process.exitCode).toBe(1);
    });
  });

  // -- monitor logs ---------------------------------------------------------

  describe("monitor logs", () => {
    it("queries system_logs without worker filter", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "logs"], { from: "user" });
      const sql = queryMock.mock.calls[0]?.[1] as string;
      expect(sql).toContain("system_logs");
      expect(sql).not.toContain("WHERE worker");
    });

    it("filters by valid worker name", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "logs", "hoox"], { from: "user" });
      const sql = queryMock.mock.calls[0]?.[1] as string;
      expect(sql).toContain("WHERE worker = 'hoox'");
    });

    it("rejects invalid worker name", async () => {
      process.exitCode = 0;
      const program = await createProgram();
      await program.parseAsync(["monitor", "logs", "bad;drop"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
      expect(queryMock).not.toHaveBeenCalled();
    });

    it("escapes single quotes in worker name", async () => {
      // Valid charset only allows [a-zA-Z0-9_-] — quotes fail validation.
      // Ensure the validation path is hit for other invalid chars.
      process.exitCode = 0;
      const program = await createProgram();
      await program.parseAsync(["monitor", "logs", "worker name"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
    });
  });

  // -- monitor trades error path --------------------------------------------

  describe("monitor trades errors", () => {
    it("rejects limit above max", async () => {
      process.exitCode = 0;
      const program = await createProgram();
      await program.parseAsync(["monitor", "trades", "999"], { from: "user" });
      expect(process.exitCode).toBe(1);
    });

    it("sets exitCode when query throws", async () => {
      queryMock = mock(async () => {
        throw new Error("db down");
      });
      (DbService.prototype as unknown as Record<string, unknown>).query =
        queryMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "trades"], { from: "user" });
      expect(process.exitCode).toBe(1);
    });
  });

  // -- monitor kill-switch variants -----------------------------------------

  describe("monitor kill-switch status variants", () => {
    it("reports ON when value is true", async () => {
      getMock = mock(async () => "true");
      (KvSyncService.prototype as unknown as Record<string, unknown>).get =
        getMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "show"], {
        from: "user",
      });
      expect(getMock).toHaveBeenCalled();
    });

    it("reports unset when value is null", async () => {
      getMock = mock(async () => null);
      (KvSyncService.prototype as unknown as Record<string, unknown>).get =
        getMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "show"], {
        from: "user",
      });
      expect(getMock).toHaveBeenCalled();
    });

    it("sets exitCode when kv fails", async () => {
      getMock = mock(async () => {
        throw new Error("kv error");
      });
      (KvSyncService.prototype as unknown as Record<string, unknown>).get =
        getMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "show"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
    });
  });

  // -- monitor analytics ----------------------------------------------------

  describe("monitor analytics", () => {
    it("registers analytics summary and errors subcommands", async () => {
      const program = await createProgram();
      const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
      const analytics = monitorCmd.commands.find(
        (c) => c.name() === "analytics"
      );
      expect(analytics).toBeDefined();
      expect(
        analytics!.commands.find((c) => c.name() === "summary")
      ).toBeDefined();
      expect(
        analytics!.commands.find((c) => c.name() === "errors")
      ).toBeDefined();
    });

    it("summary queries system_logs and formats table", async () => {
      queryMock = mock(async () =>
        JSON.stringify([
          {
            results: [
              {
                total_events: 10,
                earliest: 1,
                latest: 2,
              },
            ],
          },
        ])
      );
      (DbService.prototype as unknown as Record<string, unknown>).query =
        queryMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "analytics", "summary"], {
        from: "user",
      });
      expect(queryMock).toHaveBeenCalled();
      const sql = queryMock.mock.calls[0]?.[1] as string;
      expect(sql).toContain("total_events");
    });

    it("summary handles empty results", async () => {
      queryMock = mock(async () => JSON.stringify([{ results: [] }]));
      (DbService.prototype as unknown as Record<string, unknown>).query =
        queryMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "analytics", "summary"], {
        from: "user",
      });
      expect(queryMock).toHaveBeenCalled();
    });

    it("summary outputs raw JSON when --json is set", async () => {
      queryMock = mock(async () =>
        JSON.stringify([{ results: [{ total_events: 1 }] }])
      );
      (DbService.prototype as unknown as Record<string, unknown>).query =
        queryMock;
      const program = await createProgram();
      // Commander needs global --json on the root program
      program.option("--json");
      const writes: string[] = [];
      const orig = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        writes.push(
          typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
        );
        return true;
      }) as typeof process.stdout.write;
      try {
        await program.parseAsync(
          ["--json", "monitor", "analytics", "summary"],
          { from: "user" }
        );
        expect(writes.join("")).toContain("total_events");
      } finally {
        process.stdout.write = orig;
      }
    });

    it("errors queries with hours option", async () => {
      queryMock = mock(async () =>
        JSON.stringify([
          {
            results: [
              { level: "error", count: 3 },
              { level: "warn", count: 1 },
            ],
          },
        ])
      );
      (DbService.prototype as unknown as Record<string, unknown>).query =
        queryMock;
      const program = await createProgram();
      await program.parseAsync(
        ["monitor", "analytics", "errors", "--hours", "12"],
        { from: "user" }
      );
      const sql = queryMock.mock.calls[0]?.[1] as string;
      expect(sql).toContain("-12 hours");
      expect(sql).toContain("error");
    });

    it("errors handles empty results", async () => {
      queryMock = mock(async () => JSON.stringify([{ results: [] }]));
      (DbService.prototype as unknown as Record<string, unknown>).query =
        queryMock;
      const program = await createProgram();
      await program.parseAsync(["monitor", "analytics", "errors"], {
        from: "user",
      });
      expect(queryMock).toHaveBeenCalled();
    });

    it("errors rejects invalid hours", async () => {
      process.exitCode = 0;
      const program = await createProgram();
      await program.parseAsync(
        ["monitor", "analytics", "errors", "--hours", "-1"],
        { from: "user" }
      );
      // parseInt("-1") || 24 → 24 (falsy? -1 is truthy so hours=-1)
      // assertSafeInteger(-1, ...) throws
      expect(process.exitCode).toBe(1);
    });
  });

  // -- monitor queue-depth --------------------------------------------------

  describe("monitor queue-depth", () => {
    const realSpawn = Bun.spawn;

    afterEach(() => {
      (Bun as unknown as Record<string, unknown>).spawn = realSpawn;
    });

    it("prints wrangler stdout on success", async () => {
      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob(["queue table output"]),
        stderr: new Blob([]),
        exited: Promise.resolve(0),
      }));
      const program = await createProgram();
      await program.parseAsync(["monitor", "queue-depth"], { from: "user" });
      expect(process.exitCode).toBe(0);
    });

    it("sets exitCode when wrangler fails", async () => {
      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([]),
        stderr: new Blob(["auth failed"]),
        exited: Promise.resolve(1),
      }));
      const program = await createProgram();
      await program.parseAsync(["monitor", "queue-depth"], { from: "user" });
      expect(process.exitCode).toBe(1);
    });

    it("emits JSON queues when --json is set", async () => {
      const table = `
│ id                               │ name            │ created │ modified │ producers │ consumers │
│ c5fa5eb90a624821a0e600e1e9e063a5 │ trade-execution │ x       │ y        │ 1         │ 2         │
`;
      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([table]),
        stderr: new Blob([]),
        exited: Promise.resolve(0),
      }));
      const program = await createProgram();
      program.option("--json");
      const writes: string[] = [];
      const orig = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        writes.push(
          typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
        );
        return true;
      }) as typeof process.stdout.write;
      try {
        await program.parseAsync(["--json", "monitor", "queue-depth"], {
          from: "user",
        });
        const out = writes.join("");
        expect(out).toContain("queues");
        expect(out).toContain("trade-execution");
      } finally {
        process.stdout.write = orig;
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Pure helpers (queue table / JSON parsing)
// ---------------------------------------------------------------------------

describe("parseWranglerQueuesTable / parseWranglerQueuesJson", () => {
  it("parses wrangler queues list ASCII table", async () => {
    const { parseWranglerQueuesTable } = await import("./monitor-command.js");
    const table = `
There is a newer version of Wrangler available
┌──────────────────────────────────┬─────────────────────┬───────────┐
│ id                               │ name                │ producers │
├──────────────────────────────────┼─────────────────────┼───────────┤
│ c5fa5eb90a624821a0e600e1e9e063a5 │ trade-execution     │ 1         │
├──────────────────────────────────┼─────────────────────┼───────────┤
│ 0e2c2e84eac3498092081765be74d679 │ trade-execution-dlq │ 0         │
└──────────────────────────────────┴─────────────────────┴───────────┘
`;
    const queues = parseWranglerQueuesTable(table);
    expect(queues.length).toBe(2);
    expect(queues[0]?.queue_name).toBe("trade-execution");
    expect(queues[0]?.queue_id).toBe("c5fa5eb90a624821a0e600e1e9e063a5");
    expect(queues[1]?.queue_name).toBe("trade-execution-dlq");
  });

  it("parses full-width table with producers/consumers columns", async () => {
    const { parseWranglerQueuesTable } = await import("./monitor-command.js");
    const table = `
│ id                               │ name            │ created_on │ modified_on │ producers │ consumers │
│ c5fa5eb90a624821a0e600e1e9e063a5 │ trade-execution │ 2024       │ 2025        │ 1         │ 2         │
`;
    const queues = parseWranglerQueuesTable(table);
    expect(queues[0]?.producers_total_count).toBe(1);
    expect(queues[0]?.consumers_total_count).toBe(2);
  });

  it("parses JSON with wrangler banner prefix", async () => {
    const { parseWranglerQueuesJson } = await import("./monitor-command.js");
    const raw =
      "There is a newer version of Wrangler available\n" +
      JSON.stringify([
        { queue_id: "abc", queue_name: "trade-execution" },
        { queue_id: "def", queue_name: "other" },
      ]);
    const queues = parseWranglerQueuesJson(raw);
    expect(queues.length).toBe(2);
    expect(queues[0]?.queue_name).toBe("trade-execution");
  });

  it("parses { result: [...] } envelope", async () => {
    const { parseWranglerQueuesJson } = await import("./monitor-command.js");
    const raw = JSON.stringify({
      result: [{ queue_id: "1", queue_name: "q1" }],
    });
    const queues = parseWranglerQueuesJson(raw);
    expect(queues).toHaveLength(1);
    expect(queues[0]?.queue_name).toBe("q1");
  });

  it("returns empty for blank / non-array JSON", async () => {
    const { parseWranglerQueuesJson } = await import("./monitor-command.js");
    expect(parseWranglerQueuesJson("")).toEqual([]);
    expect(parseWranglerQueuesJson("   ")).toEqual([]);
    expect(parseWranglerQueuesJson(JSON.stringify({ foo: 1 }))).toEqual([]);
  });
});
