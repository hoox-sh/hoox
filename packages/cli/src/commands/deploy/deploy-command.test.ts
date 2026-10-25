/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for the deploy command.
 *
 * Stubs ConfigService and CloudflareService prototypes to verify the deploy
 * command logic in isolation. Uses Commander's exitOverride to suppress
 * process exits during test runs.
 *
 * Subcommand actions are async — we use parseAsync() and then inspect mocks
 * to confirm correct service calls.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { ConfigService } from "../../services/config/config-service.js";
import { CloudflareService } from "../../services/cloudflare/cloudflare-service.js";

// We import at the top level — the deploy command module also imports
// @clack/prompts, which outputs to stdout during tests (fine).

// ---------------------------------------------------------------------------
// Stub variables — reassigned in beforeEach
// ---------------------------------------------------------------------------

let deployMock: ReturnType<typeof mock>;
let loadMock: ReturnType<typeof mock>;
let listEnabledWorkersMock: ReturnType<typeof mock>;
let getWorkerMock: ReturnType<typeof mock>;

// Preserve originals so we can restore them after tests
const origLoad = ConfigService.prototype
  .load as typeof ConfigService.prototype.load;
const origListEnabled = ConfigService.prototype
  .listEnabledWorkers as typeof ConfigService.prototype.listEnabledWorkers;
const origGetWorker = ConfigService.prototype
  .getWorker as typeof ConfigService.prototype.getWorker;
const origDeploy = CloudflareService.prototype
  .deploy as typeof CloudflareService.prototype.deploy;

beforeEach(() => {
  mock.restore();

  // Reset process.exitCode between tests
  process.exitCode = 0;

  // Reset prototypes to originals (in case a previous test didn't restore)
  (ConfigService.prototype as unknown as Record<string, unknown>).load =
    origLoad;
  (
    ConfigService.prototype as unknown as Record<string, unknown>
  ).listEnabledWorkers = origListEnabled;
  (ConfigService.prototype as unknown as Record<string, unknown>).getWorker =
    origGetWorker;
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    origDeploy;

  // Fresh mocks
  deployMock = mock(async (_path: string, _env?: string) => ({
    ok: true as const,
    value: { url: "https://test-worker.cryptolinx.workers.dev", rawOutput: "" },
  }));

  loadMock = mock(async () => ({}));
  listEnabledWorkersMock = mock(() => ["d1-worker", "hoox", "trade-worker"]);
  getWorkerMock = mock((_name: string) => ({
    enabled: true,
    path: "workers/test-worker",
  }));

  // Install mocks on prototypes
  (ConfigService.prototype as unknown as Record<string, unknown>).load =
    loadMock;
  (
    ConfigService.prototype as unknown as Record<string, unknown>
  ).listEnabledWorkers = listEnabledWorkersMock;
  (ConfigService.prototype as unknown as Record<string, unknown>).getWorker =
    getWorkerMock;
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    deployMock;
});

afterEach(() => {
  mock.restore();

  // Restore originals
  (ConfigService.prototype as unknown as Record<string, unknown>).load =
    origLoad;
  (
    ConfigService.prototype as unknown as Record<string, unknown>
  ).listEnabledWorkers = origListEnabled;
  (ConfigService.prototype as unknown as Record<string, unknown>).getWorker =
    origGetWorker;
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    origDeploy;
});

// ---------------------------------------------------------------------------
// Dynamic import — load the deploy command after stubs are in place
// ---------------------------------------------------------------------------

async function importDeployCommand(): Promise<{
  registerDeployCommand: typeof import("./deploy-command.js").registerDeployCommand;
}> {
  return import("./deploy-command.js");
}

/**
 * Create a fresh Commander program with the deploy command registered.
 */
async function createProgram(): Promise<Command> {
  const { registerDeployCommand } = await importDeployCommand();
  const program = new Command().name("hoox-test").exitOverride(() => {
    // Suppress Commander's own exit during tests
  });
  registerDeployCommand(program);
  return program;
}

/** Make deployMock return a failure for all subsequent calls. */
function makeDeployFail(error: string): void {
  deployMock = mock(async () => ({ ok: false as const, error }));
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    deployMock;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerDeployCommand", () => {
  // -- Command registration -------------------------------------------------

  it("registers 'deploy' as a command on the program", async () => {
    const program = await createProgram();
    const deployCmd = program.commands.find((c) => c.name() === "deploy");
    expect(deployCmd).toBeDefined();
  });

  it("registers 'deploy all' subcommand", async () => {
    const program = await createProgram();
    const deployCmd = program.commands.find((c) => c.name() === "deploy")!;
    const allCmd = deployCmd.commands.find((c) => c.name() === "all");
    expect(allCmd).toBeDefined();
    expect(allCmd!.description()).toContain("Deploy all enabled workers");
  });

  it("registers 'deploy workers' subcommand", async () => {
    const program = await createProgram();
    const deployCmd = program.commands.find((c) => c.name() === "deploy")!;
    const workersCmd = deployCmd.commands.find((c) => c.name() === "workers");
    expect(workersCmd).toBeDefined();
    expect(workersCmd!.description()).toContain("Deploy all enabled workers");
  });

  it("registers 'deploy worker <name>' subcommand with argument", async () => {
    const program = await createProgram();
    const deployCmd = program.commands.find((c) => c.name() === "deploy")!;
    const workerCmd = deployCmd.commands.find((c) => c.name() === "worker");
    expect(workerCmd).toBeDefined();
    const args = workerCmd!.registeredArguments;
    expect(args.some((a) => a.name() === "name")).toBe(true);
  });

  it("registers 'deploy dashboard' subcommand", async () => {
    const program = await createProgram();
    const deployCmd = program.commands.find((c) => c.name() === "deploy")!;
    const dashboardCmd = deployCmd.commands.find(
      (c) => c.name() === "dashboard"
    );
    expect(dashboardCmd).toBeDefined();
    expect(dashboardCmd!.description()).toContain("dashboard");
  });

  // -- deploy workers -------------------------------------------------------

  describe("deploy workers", () => {
    it("calls listEnabledWorkers and deploys each", async () => {
      listEnabledWorkersMock = mock(() => [
        "d1-worker",
        "hoox",
        "trade-worker",
      ]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "workers"], { from: "user" });

      expect(listEnabledWorkersMock).toHaveBeenCalled();
      expect(deployMock).toHaveBeenCalledTimes(3);
    });

    it("handles no enabled workers gracefully", async () => {
      listEnabledWorkersMock = mock(() => []);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "workers"], { from: "user" });

      expect(deployMock).toHaveBeenCalledTimes(0);
    });

    it("continues deploying remaining workers on partial failure", async () => {
      listEnabledWorkersMock = mock(() => ["a", "b", "c"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      let calls = 0;
      deployMock = mock(async () => {
        calls++;
        if (calls === 2) {
          return { ok: false as const, error: "deploy error" };
        }
        return {
          ok: true as const,
          value: { url: "https://x.workers.dev", rawOutput: "" },
        };
      });
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).deploy = deployMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "workers"], { from: "user" });

      expect(deployMock).toHaveBeenCalledTimes(3);
      expect(calls).toBe(3);
    });

    it("passes --env to deploy", async () => {
      listEnabledWorkersMock = mock(() => ["single-worker"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "workers", "--env", "staging"], {
        from: "user",
      });

      expect(deployMock).toHaveBeenCalledTimes(1);
      const calls = (
        deployMock as unknown as { mock: { calls: Array<unknown[]> } }
      ).mock.calls;
      expect(calls[0]?.[1]).toBe("staging");
    });
  });

  // -- deploy worker <name> -------------------------------------------------

  describe("deploy worker <name>", () => {
    it("deploys the specified worker successfully", async () => {
      const program = await createProgram();
      await program.parseAsync(["deploy", "worker", "hoox"], { from: "user" });

      expect(deployMock).toHaveBeenCalledTimes(1);
      const calls = (
        deployMock as unknown as { mock: { calls: Array<unknown[]> } }
      ).mock.calls;
      expect(calls[0]?.[0]).toContain("test-worker");
    });

    it("passes --env to deploy", async () => {
      const program = await createProgram();
      await program.parseAsync(
        ["deploy", "worker", "hoox", "--env", "production"],
        { from: "user" }
      );

      const calls = (
        deployMock as unknown as { mock: { calls: Array<unknown[]> } }
      ).mock.calls;
      expect(calls[0]?.[1]).toBe("production");
    });

    it("handles deploy failure (sets exitCode to 1)", async () => {
      makeDeployFail("authentication error");
      getWorkerMock = mock(() => ({
        enabled: true,
        path: "workers/hoox-worker",
      }));
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getWorker = getWorkerMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "worker", "hoox"], { from: "user" });

      expect(process.exitCode).toBe(1);
    });

    it("handles unknown worker name without calling deploy", async () => {
      getWorkerMock = mock(() => undefined);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getWorker = getWorkerMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "worker", "nonexistent"], {
        from: "user",
      });

      expect(deployMock).toHaveBeenCalledTimes(0);
      expect(process.exitCode).toBe(1);
    });
  });

  // -- config loading errors ------------------------------------------------

  it("handles config load failure gracefully", async () => {
    loadMock = mock(async () => {
      throw new Error("Config file not found");
    });
    (ConfigService.prototype as unknown as Record<string, unknown>).load =
      loadMock;

    const program = await createProgram();
    await program.parseAsync(["deploy", "workers"], { from: "user" });

    expect(process.exitCode).toBe(1);
  });

  // -- additional subcommand registration -----------------------------------

  it("registers history, rollback, telegram-webhook, update-internal-urls, kv-config", async () => {
    const program = await createProgram();
    const deployCmd = program.commands.find((c) => c.name() === "deploy")!;
    const names = deployCmd.commands.map((c) => c.name());
    for (const n of [
      "history",
      "rollback",
      "telegram-webhook",
      "update-internal-urls",
      "kv-config",
      "all",
    ]) {
      expect(names).toContain(n);
    }
  });

  // -- deploy all --dry-run -------------------------------------------------

  describe("deploy all --dry-run", () => {
    it("prints deployment plan without calling deploy", async () => {
      listEnabledWorkersMock = mock(() => [
        "d1-worker",
        "trade-worker",
        "custom-worker",
      ]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        const program = await createProgram();
        await program.parseAsync(["deploy", "all", "--dry-run"], {
          from: "user",
        });
      } finally {
        process.stdout.write = origWrite;
      }

      expect(stdout).toContain("Deployment Plan");
      expect(stdout).toContain("d1-worker");
      expect(stdout).toContain("trade-worker");
      expect(stdout).toContain("custom-worker");
      expect(stdout).toContain("Dashboard");
      expect(deployMock).toHaveBeenCalledTimes(0);
    });
  });

  // -- deploy history -------------------------------------------------------

  describe("deploy history", () => {
    const origVersionsList = CloudflareService.prototype
      .versionsList as typeof CloudflareService.prototype.versionsList;

    afterEach(() => {
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsList = origVersionsList;
    });

    it("prints version table on success", async () => {
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsList = mock(async () => ({
        ok: true as const,
        value: [
          {
            id: "abc12345-version",
            number: 3,
            created_on: "2026-01-01T00:00:00Z",
            author: "ci",
            source: "api",
          },
        ],
      }));

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        const program = await createProgram();
        await program.parseAsync(["deploy", "history", "trade-worker"], {
          from: "user",
        });
      } finally {
        process.stdout.write = origWrite;
      }

      expect(stdout).toContain("abc12345-version");
      expect(stdout).toMatch(/version/i);
    });

    it("sets exitCode when versionsList fails", async () => {
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsList = mock(async () => ({
        ok: false as const,
        error: "auth failed",
      }));

      const program = await createProgram();
      await program.parseAsync(["deploy", "history", "trade-worker"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
    });

    it("handles empty version history", async () => {
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsList = mock(async () => ({
        ok: true as const,
        value: [],
      }));

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        const program = await createProgram();
        await program.parseAsync(["deploy", "history", "trade-worker"], {
          from: "user",
        });
      } finally {
        process.stdout.write = origWrite;
      }

      expect(stdout).toMatch(/No deployment history|0 version/i);
    });
  });

  // -- deploy rollback ------------------------------------------------------

  describe("deploy rollback", () => {
    const origVersionsList = CloudflareService.prototype
      .versionsList as typeof CloudflareService.prototype.versionsList;
    const origRollback = CloudflareService.prototype
      .versionsRollback as typeof CloudflareService.prototype.versionsRollback;

    afterEach(() => {
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsList = origVersionsList;
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsRollback = origRollback;
    });

    it("rolls back with --yes and explicit version", async () => {
      const rollbackMock = mock(async () => ({
        ok: true as const,
        value: "Rolled back successfully\n",
      }));
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsRollback = rollbackMock;

      const program = await createProgram();
      await program.parseAsync(
        ["deploy", "rollback", "trade-worker", "ver-abc-12345678", "--yes"],
        { from: "user" }
      );

      expect(rollbackMock).toHaveBeenCalledTimes(1);
      const calls = (
        rollbackMock as unknown as { mock: { calls: Array<unknown[]> } }
      ).mock.calls;
      expect(calls[0]?.[0]).toBe("trade-worker");
      expect(calls[0]?.[1]).toBe("ver-abc-12345678");
    });

    it("sets exitCode when rollback fails", async () => {
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsRollback = mock(async () => ({
        ok: false as const,
        error: "version not found",
      }));

      const program = await createProgram();
      await program.parseAsync(
        ["deploy", "rollback", "trade-worker", "bad-ver", "--yes"],
        { from: "user" }
      );
      expect(process.exitCode).toBe(1);
    });
  });

  // -- deploy telegram-webhook ----------------------------------------------

  describe("deploy telegram-webhook", () => {
    it("errors when bot token is missing", async () => {
      // Ensure no TG_BOT_TOKEN_BINDING from env load path — EnvService may
      // fail to load .env.local in test cwd; token flag omitted.
      const program = await createProgram();
      await program.parseAsync(["deploy", "telegram-webhook"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
    });

    it("errors when secret token is missing but bot token provided", async () => {
      const program = await createProgram();
      await program.parseAsync(
        ["deploy", "telegram-webhook", "--token", "123:ABC"],
        { from: "user" }
      );
      expect(process.exitCode).toBe(1);
    });

    it("sets webhook when tokens provided", async () => {
      const { TelegramService } = await import("./telegram-service.js");
      const origInfo = TelegramService.prototype.getWebhookInfo;
      const origSet = TelegramService.prototype.setWebhook;
      (
        TelegramService.prototype as unknown as Record<string, unknown>
      ).getWebhookInfo = mock(async () => ({
        ok: true,
        url: "https://old.example/webhook",
        pending_update_count: 0,
      }));
      (
        TelegramService.prototype as unknown as Record<string, unknown>
      ).setWebhook = mock(async () => ({
        ok: true,
        description: "Webhook was set",
      }));

      // Avoid ConfigService path for subdomain
      const origGetGlobal = ConfigService.prototype.getGlobal;
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getGlobal = mock(() => ({ subdomain_prefix: "hoox" }));

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        const program = await createProgram();
        await program.parseAsync(
          [
            "deploy",
            "telegram-webhook",
            "--token",
            "123:ABC",
            "--secret-token",
            "sec",
            "--subdomain",
            "myapp",
          ],
          { from: "user" }
        );
      } finally {
        process.stdout.write = origWrite;
        (
          TelegramService.prototype as unknown as Record<string, unknown>
        ).getWebhookInfo = origInfo;
        (
          TelegramService.prototype as unknown as Record<string, unknown>
        ).setWebhook = origSet;
        (
          ConfigService.prototype as unknown as Record<string, unknown>
        ).getGlobal = origGetGlobal;
      }

      expect(stdout).toMatch(/webhook|successfully/i);
    });
  });

  // -- deploy update-internal-urls ------------------------------------------

  describe("deploy update-internal-urls", () => {
    it("errors when dashboard wrangler.jsonc is missing", async () => {
      const origGetGlobal = ConfigService.prototype.getGlobal;
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getGlobal = mock(() => ({ subdomain_prefix: "hoox" }));
      listEnabledWorkersMock = mock(() => ["trade-worker"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      const program = await createProgram();
      // Run from a temp-like cwd without workers/dashboard — use process.cwd()
      // which typically has the monorepo; if dashboard exists, skip assertion
      // by forcing path check via chdir to tmp.
      const { mkdtempSync, rmSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const dir = mkdtempSync(join(tmpdir(), "hoox-deploy-urls-"));
      const prev = process.cwd();
      try {
        process.chdir(dir);
        await program.parseAsync(["deploy", "update-internal-urls"], {
          from: "user",
        });
        expect(process.exitCode).toBe(1);
      } finally {
        process.chdir(prev);
        rmSync(dir, { recursive: true, force: true });
        (
          ConfigService.prototype as unknown as Record<string, unknown>
        ).getGlobal = origGetGlobal;
      }
    });

    it("updates vars when dashboard wrangler.jsonc exists", async () => {
      const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } =
        await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const dir = mkdtempSync(join(tmpdir(), "hoox-deploy-urls-ok-"));
      mkdirSync(join(dir, "workers", "dashboard"), { recursive: true });
      writeFileSync(
        join(dir, "workers", "dashboard", "wrangler.jsonc"),
        JSON.stringify({
          name: "dashboard",
          vars: { TRADE_WORKER_URL: "https://old.example" },
        })
      );

      const origGetGlobal = ConfigService.prototype.getGlobal;
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getGlobal = mock(() => ({ subdomain_prefix: "myprefix" }));
      listEnabledWorkersMock = mock(() => ["trade-worker", "hoox"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      const prev = process.cwd();
      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        process.chdir(dir);
        const program = await createProgram();
        await program.parseAsync(["deploy", "update-internal-urls"], {
          from: "user",
        });
        const content = readFileSync(
          join(dir, "workers", "dashboard", "wrangler.jsonc"),
          "utf-8"
        );
        expect(content).toContain("https://trade-worker.myprefix.workers.dev");
        expect(content).toContain("https://hoox.myprefix.workers.dev");
        expect(stdout).toMatch(/Updated|up to date/i);
      } finally {
        process.stdout.write = origWrite;
        process.chdir(prev);
        rmSync(dir, { recursive: true, force: true });
        (
          ConfigService.prototype as unknown as Record<string, unknown>
        ).getGlobal = origGetGlobal;
      }
    });
  });

  // -- deploy kv-config -----------------------------------------------------

  describe("deploy kv-config", () => {
    it("sets exitCode when resolveNamespaceId throws", async () => {
      const { KvSyncService } =
        await import("../../services/kv/kv-sync-service.js");
      const origResolve = KvSyncService.prototype.resolveNamespaceId;
      KvSyncService.prototype.resolveNamespaceId = mock(async () => {
        throw new Error("no namespace");
      }) as typeof origResolve;

      try {
        const program = await createProgram();
        await program.parseAsync(["deploy", "kv-config"], { from: "user" });
        expect(process.exitCode).toBe(1);
      } finally {
        KvSyncService.prototype.resolveNamespaceId = origResolve;
      }
    });
  });

  // -- getDashboardBuildInfo ------------------------------------------------

  describe("getDashboardBuildInfo", () => {
    it("returns exists=false when worker.js is missing", async () => {
      const { getDashboardBuildInfo } = await import("./deploy-command.js");
      const { mkdtempSync, rmSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const dir = mkdtempSync(join(tmpdir(), "hoox-dash-build-"));
      try {
        const info = getDashboardBuildInfo(dir);
        expect(info.exists).toBe(false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("returns age string when worker.js exists", async () => {
      const { getDashboardBuildInfo } = await import("./deploy-command.js");
      const { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } =
        await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const dir = mkdtempSync(join(tmpdir(), "hoox-dash-build-"));
      const workerDir = join(dir, ".open-next");
      mkdirSync(workerDir, { recursive: true });
      const workerPath = join(workerDir, "worker.js");
      writeFileSync(workerPath, "// stub\n");
      // 2 hours ago
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000);
      utimesSync(workerPath, past, past);
      try {
        const info = getDashboardBuildInfo(dir);
        expect(info.exists).toBe(true);
        expect(info.age).toMatch(/hour|minute|just now|day/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("formats multi-day age", async () => {
      const { getDashboardBuildInfo } = await import("./deploy-command.js");
      const { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } =
        await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const dir = mkdtempSync(join(tmpdir(), "hoox-dash-build-"));
      const workerDir = join(dir, ".open-next");
      mkdirSync(workerDir, { recursive: true });
      const workerPath = join(workerDir, "worker.js");
      writeFileSync(workerPath, "// stub\n");
      const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      utimesSync(workerPath, past, past);
      try {
        const info = getDashboardBuildInfo(dir);
        expect(info.age).toMatch(/3 days ago/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("formats just-now and minute ages", async () => {
      const { getDashboardBuildInfo } = await import("./deploy-command.js");
      const { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } =
        await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const dir = mkdtempSync(join(tmpdir(), "hoox-dash-build-"));
      const workerDir = join(dir, ".open-next");
      mkdirSync(workerDir, { recursive: true });
      const workerPath = join(workerDir, "worker.js");
      writeFileSync(workerPath, "// stub\n");
      try {
        // Fresh file → just now
        const infoNow = getDashboardBuildInfo(dir);
        expect(infoNow.age).toMatch(/just now|minute/);

        // ~5 minutes ago
        const past = new Date(Date.now() - 5 * 60 * 1000);
        utimesSync(workerPath, past, past);
        const infoMin = getDashboardBuildInfo(dir);
        expect(infoMin.age).toMatch(/5 minutes ago|just now|minute/);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // -- deploy workers ordering + rawOutput path -----------------------------

  describe("deploy workers details", () => {
    it("orders workers by DEPLOY_ORDER and appends unknown", async () => {
      listEnabledWorkersMock = mock(() => [
        "trade-worker",
        "d1-worker",
        "zzz-custom",
      ]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      getWorkerMock = mock((name: string) => ({
        enabled: true,
        path: `workers/${name}`,
      }));
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getWorker = getWorkerMock;

      const order: string[] = [];
      deployMock = mock(async (path: string) => {
        order.push(path);
        return {
          ok: true as const,
          value: {
            url: "https://x.workers.dev",
            rawOutput: "Deployed version id 123",
            size: "1.2 MiB",
            startupTime: "10 ms",
            versionId: "abcdef0123456789",
          },
        };
      });
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).deploy = deployMock;

      const program = await createProgram();
      await program.parseAsync(["deploy", "workers"], { from: "user" });

      expect(order.length).toBe(3);
      // d1 before trade
      expect(order[0]).toContain("d1-worker");
      expect(order[1]).toContain("trade-worker");
      expect(order[2]).toContain("zzz-custom");
    });

    it("surfaces rawOutput when metrics are absent", async () => {
      listEnabledWorkersMock = mock(() => ["only"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;
      getWorkerMock = mock(() => ({ enabled: true, path: "workers/only" }));
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getWorker = getWorkerMock;

      deployMock = mock(async () => ({
        ok: true as const,
        value: {
          url: undefined,
          rawOutput: "Uploaded worker successfully\nmore",
        },
      }));
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).deploy = deployMock;

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        const program = await createProgram();
        await program.parseAsync(["deploy", "workers"], { from: "user" });
      } finally {
        process.stdout.write = origWrite;
      }

      expect(stdout).toMatch(/Output:|Uploaded worker/);
    });
  });

  // -- deploy dashboard (mocked Bun.spawn) ----------------------------------

  describe("deploy dashboard", () => {
    const origSpawn = Bun.spawn;

    afterEach(() => {
      (Bun as unknown as Record<string, unknown>).spawn = origSpawn;
    });

    it("rebuilds and deploys with --rebuild", async () => {
      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([
          "Total Upload: 2.0 MiB\nWorker Startup Time: 12 ms\nhttps://dashboard.hoox.workers.dev\n",
        ]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        killed: false,
        kill: mock(() => {}),
      }));

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        const program = await createProgram();
        await program.parseAsync(["deploy", "dashboard", "--rebuild"], {
          from: "user",
        });
      } finally {
        process.stdout.write = origWrite;
      }

      expect(stdout).toMatch(/dashboard|Deploying|deployed/i);
      expect(process.exitCode).not.toBe(1);
    });

    it("sets exitCode when dashboard build fails", async () => {
      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([""]),
        stderr: new Blob(["build exploded\n"]),
        exited: Promise.resolve(2),
        killed: false,
        kill: mock(() => {}),
      }));

      const program = await createProgram();
      await program.parseAsync(["deploy", "dashboard", "--rebuild"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
    });

    it("deploys existing build when user chooses deploy", async () => {
      const { mkdtempSync, mkdirSync, writeFileSync, rmSync } =
        await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { join } = await import("node:path");
      const clack = await import("@clack/prompts");
      const { spyOn } = await import("bun:test");
      spyOn(clack, "select").mockImplementation(async () => "deploy" as any);
      spyOn(clack, "spinner").mockImplementation(
        () =>
          ({
            start: mock(() => {}),
            stop: mock(() => {}),
          }) as any
      );

      const dir = mkdtempSync(join(tmpdir(), "hoox-dash-exist-"));
      mkdirSync(join(dir, "workers", "dashboard", ".open-next"), {
        recursive: true,
      });
      writeFileSync(
        join(dir, "workers", "dashboard", ".open-next", "worker.js"),
        "// build\n"
      );

      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob(["https://dashboard.hoox.workers.dev\n"]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        killed: false,
        kill: mock(() => {}),
      }));

      const prev = process.cwd();
      try {
        process.chdir(dir);
        process.exitCode = 0;
        const program = await createProgram();
        await program.parseAsync(["deploy", "dashboard"], { from: "user" });
        const spawnCalls = (
          Bun.spawn as unknown as { mock: { calls: Array<unknown[]> } }
        ).mock.calls;
        const cmd = (spawnCalls[0]?.[0] as string[]) ?? [];
        expect(cmd.join(" ")).toContain("opennext:deploy");
      } finally {
        process.chdir(prev);
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  // -- deploy all (non dry-run) ---------------------------------------------

  describe("deploy all", () => {
    const origSpawn = Bun.spawn;

    afterEach(() => {
      (Bun as unknown as Record<string, unknown>).spawn = origSpawn;
    });

    it("deploys workers and dashboard with --auto --rebuild", async () => {
      listEnabledWorkersMock = mock(() => ["d1-worker"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;
      getWorkerMock = mock(() => ({
        enabled: true,
        path: "workers/d1-worker",
      }));
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getWorker = getWorkerMock;

      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([
          "Total Upload: 1 KiB\nhttps://dashboard.hoox.workers.dev\n",
        ]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        killed: false,
        kill: mock(() => {}),
      }));

      process.exitCode = 0;
      const program = await createProgram();
      program.option("--json").option("--quiet");
      await program.parseAsync(
        ["deploy", "all", "--auto", "--rebuild", "--quiet"],
        { from: "user" }
      );

      // worker deploy + dashboard
      expect(deployMock).toHaveBeenCalled();
    });

    it("prints task results for deploy all --json", async () => {
      listEnabledWorkersMock = mock(() => ["d1-worker"]);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;
      getWorkerMock = mock(() => ({
        enabled: true,
        path: "workers/d1-worker",
      }));
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).getWorker = getWorkerMock;

      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([
          "Total Upload: 1 KiB\nhttps://dashboard.hoox.workers.dev\n",
        ]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        killed: false,
        kill: mock(() => {}),
      }));

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        process.exitCode = 0;
        const program = await createProgram();
        program.option("--json");
        await program.parseAsync(["deploy", "all", "--auto", "--json"], {
          from: "user",
        });
        const start = stdout.indexOf('[{"title"');
        expect(start).toBeGreaterThanOrEqual(0);
        const parsed = JSON.parse(stdout.slice(start)) as Array<{
          title?: string;
        }>;
        expect(parsed.some((row) => row.title === "d1-worker")).toBe(true);
      } finally {
        process.stdout.write = origWrite;
      }
    });

    it("still deploys dashboard when no workers are enabled", async () => {
      listEnabledWorkersMock = mock(() => []);
      (
        ConfigService.prototype as unknown as Record<string, unknown>
      ).listEnabledWorkers = listEnabledWorkersMock;

      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob(["https://dashboard.example.workers.dev\n"]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        killed: false,
        kill: mock(() => {}),
      }));

      process.exitCode = 0;
      const program = await createProgram();
      await program.parseAsync(["deploy", "all", "--auto", "--rebuild"], {
        from: "user",
      });
      // dashboard path uses Bun.spawn, not deployMock
      expect(
        (Bun.spawn as unknown as { mock?: { calls: unknown[] } }).mock?.calls
          .length ?? 1
      ).toBeGreaterThan(0);
    });
  });

  // -- deploy kv-config success path ----------------------------------------

  describe("deploy kv-config success", () => {
    it("sets keys from manifest defaults", async () => {
      const { KvSyncService } =
        await import("../../services/kv/kv-sync-service.js");
      const origResolve = KvSyncService.prototype.resolveNamespaceId;
      const origSet = KvSyncService.prototype.set;
      KvSyncService.prototype.resolveNamespaceId = mock(
        async () => "ns-123"
      ) as typeof origResolve;
      KvSyncService.prototype.set = mock(
        async () => undefined
      ) as typeof origSet;

      let stdout = "";
      const origWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString();
        return true;
      }) as typeof process.stdout.write;

      try {
        process.exitCode = 0;
        const program = await createProgram();
        await program.parseAsync(["deploy", "kv-config"], { from: "user" });
        expect(stdout).toMatch(/key\(s\) set|CONFIG_KV|Resolving/i);
      } finally {
        process.stdout.write = origWrite;
        KvSyncService.prototype.resolveNamespaceId = origResolve;
        KvSyncService.prototype.set = origSet;
      }
    });
  });

  // -- telegram webhook failure from API ------------------------------------

  describe("deploy telegram-webhook API failure", () => {
    it("sets exitCode when setWebhook fails", async () => {
      const { TelegramService } = await import("./telegram-service.js");
      const origInfo = TelegramService.prototype.getWebhookInfo;
      const origSet = TelegramService.prototype.setWebhook;
      (
        TelegramService.prototype as unknown as Record<string, unknown>
      ).getWebhookInfo = mock(async () => ({
        ok: true,
        url: "",
        pending_update_count: 0,
      }));
      (
        TelegramService.prototype as unknown as Record<string, unknown>
      ).setWebhook = mock(async () => ({
        ok: false,
        error: "bad token",
      }));

      try {
        process.exitCode = 0;
        const program = await createProgram();
        await program.parseAsync(
          [
            "deploy",
            "telegram-webhook",
            "--token",
            "123:ABC",
            "--secret-token",
            "sec",
            "--subdomain",
            "myapp",
          ],
          { from: "user" }
        );
        expect(process.exitCode).toBe(1);
      } finally {
        (
          TelegramService.prototype as unknown as Record<string, unknown>
        ).getWebhookInfo = origInfo;
        (
          TelegramService.prototype as unknown as Record<string, unknown>
        ).setWebhook = origSet;
      }
    });
  });

  // -- rollback without --yes (cancel) --------------------------------------

  describe("deploy rollback cancel", () => {
    it("cancels when user declines confirmation", async () => {
      const clack = await import("@clack/prompts");
      const { spyOn } = await import("bun:test");
      spyOn(clack, "confirm").mockImplementation(async () => false);
      spyOn(clack, "isCancel").mockImplementation(
        ((_v: unknown): _v is symbol => false) as (
          value: unknown
        ) => value is symbol
      );

      const origRollback = CloudflareService.prototype.versionsRollback;
      const rollbackMock = mock(async () => ({
        ok: true as const,
        value: "ok",
      }));
      (
        CloudflareService.prototype as unknown as Record<string, unknown>
      ).versionsRollback = rollbackMock;

      try {
        const program = await createProgram();
        await program.parseAsync(
          ["deploy", "rollback", "trade-worker", "ver-abc"],
          { from: "user" }
        );
        expect(rollbackMock).not.toHaveBeenCalled();
      } finally {
        (
          CloudflareService.prototype as unknown as Record<string, unknown>
        ).versionsRollback = origRollback;
      }
    });
  });
});
