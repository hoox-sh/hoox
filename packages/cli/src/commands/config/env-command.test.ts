/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for `hoox config env` subcommands.
 * Uses temp dirs for .env.local; mocks @clack/prompts for interactive init.
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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import * as clack from "@clack/prompts";
import { registerEnvCommand } from "./env-command.js";
import { EnvService } from "../../services/env/index.js";

// ---------------------------------------------------------------------------
// Stream capture
// ---------------------------------------------------------------------------

function captureStreams(): {
  stdout: () => string;
  stderr: () => string;
  restore: () => void;
} {
  const out: string[] = [];
  const err: string[] = [];
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Buffer) => {
    out.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Buffer) => {
    err.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  }) as typeof process.stderr.write;
  return {
    stdout: () => out.join(""),
    stderr: () => err.join(""),
    restore: () => {
      process.stdout.write = origOut;
      process.stderr.write = origErr;
    },
  };
}

// ---------------------------------------------------------------------------
// Clack spies
// ---------------------------------------------------------------------------

const CANCEL = Symbol.for("clack.cancel");
let simulateCancel = false;
let confirmSequence: boolean[] = [true];
let confirmIdx = 0;
let textValue = "test-value";
let passwordValue = "secret-value";
const cancelMessages: string[] = [];
const logSteps: string[] = [];
const outroMessages: string[] = [];

function installClackSpies(): void {
  spyOn(clack, "intro").mockImplementation(() => {});
  spyOn(clack, "outro").mockImplementation((msg?: string) => {
    outroMessages.push(msg ?? "");
  });
  spyOn(clack, "cancel").mockImplementation((msg?: string) => {
    cancelMessages.push(msg ?? "");
  });
  spyOn(clack, "confirm").mockImplementation(async () => {
    if (simulateCancel) return CANCEL;
    const v =
      confirmIdx < confirmSequence.length
        ? confirmSequence[confirmIdx]
        : confirmSequence[confirmSequence.length - 1];
    confirmIdx++;
    return v ?? false;
  });
  spyOn(clack, "password").mockImplementation(async () => {
    if (simulateCancel) return CANCEL;
    return passwordValue;
  });
  spyOn(clack, "text").mockImplementation(
    async (opts: { defaultValue?: string }) => {
      if (simulateCancel) return CANCEL;
      return textValue || opts.defaultValue || "";
    }
  );
  spyOn(clack, "isCancel").mockImplementation(
    (value: unknown): value is symbol =>
      simulateCancel ||
      (typeof value === "symbol" &&
        Symbol.keyFor(value as symbol) === "clack.cancel")
  );
  spyOn(clack.log, "step").mockImplementation((msg?: string) => {
    logSteps.push(msg ?? "");
  });
  spyOn(clack.log, "info").mockImplementation(() => {});
  spyOn(clack.log, "success").mockImplementation(() => {});
  spyOn(clack.log, "warn").mockImplementation(() => {});
  spyOn(clack.log, "error").mockImplementation(() => {});
}

// ---------------------------------------------------------------------------
// Program helper
// ---------------------------------------------------------------------------

function makeProgram(): Command {
  const program = new Command();
  program.name("hoox");
  program.option("--json", "JSON output");
  program.option("--quiet", "Quiet output");
  program.exitOverride();
  const parent = program.command("config");
  registerEnvCommand(parent);
  return program;
}

async function runEnv(
  args: string[],
  program?: Command
): Promise<{ program: Command; cap: ReturnType<typeof captureStreams> }> {
  const prog = program ?? makeProgram();
  const cap = captureStreams();
  try {
    await prog.parseAsync(["node", "hoox", "config", "env", ...args], {
      from: "node",
    });
  } finally {
    // leave restore to caller so assertions can read streams
  }
  return { program: prog, cap };
}

// ---------------------------------------------------------------------------
// EnvService integration (kept for regression)
// ---------------------------------------------------------------------------

describe("env command", () => {
  describe("EnvService integration", () => {
    it("validate catches missing required vars", () => {
      const result = EnvService.validate({});
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain("CLOUDFLARE_API_TOKEN");
    });

    it("validate passes with all required vars", () => {
      const vars: Record<string, string> = {
        CLOUDFLARE_API_TOKEN: "cfut_xxx",
        CLOUDFLARE_ACCOUNT_ID: "abc123",
        SUBDOMAIN_PREFIX: "myapp",
        TRADE_INTERNAL_KEY: "trade-key",
        AGENT_INTERNAL_KEY: "agent-key",
        WEBHOOK_API_KEY_BINDING: "webhook-key",
        INTERNAL_KEY_BINDING: "inter-key",
        API_SERVICE_KEY_BINDING: "api-key",
        TELEGRAM_INTERNAL_KEY_BINDING: "tg-key",
        DASHBOARD_USER: "admin",
        DASHBOARD_PASS: "pass123",
        SESSION_SECRET: "a".repeat(32),
      };
      const result = EnvService.validate(vars);
      expect(result.missing.length).toBe(0);
    });

    it("generateEnvLocal produces valid output", () => {
      const content = EnvService.generateEnvLocal();
      expect(content).toContain("CLOUDFLARE_API_TOKEN");
      expect(content).toContain("# NEVER commit this file");
    });

    it("show redacts secrets", () => {
      const output = EnvService.show({ CLOUDFLARE_API_TOKEN: "s3kr3t" });
      expect(output).toContain("********");
      expect(output).not.toContain("s3kr3t");
    });
  });

  // -------------------------------------------------------------------------
  // Command handlers via Commander
  // -------------------------------------------------------------------------

  describe("registerEnvCommand", () => {
    const temps: string[] = [];
    let origCwd: string;
    let tmpDir: string;

    beforeEach(() => {
      origCwd = process.cwd();
      tmpDir = mkdtempSync(join(tmpdir(), "hoox-env-"));
      temps.push(tmpDir);
      process.chdir(tmpDir);
      // Bun ignores `process.exitCode = undefined` — must set 0 explicitly.
      process.exitCode = 0;
      simulateCancel = false;
      confirmSequence = [true];
      confirmIdx = 0;
      textValue = "test-value";
      passwordValue = "secret-value";
      cancelMessages.length = 0;
      logSteps.length = 0;
      outroMessages.length = 0;
      installClackSpies();
    });

    afterEach(() => {
      process.chdir(origCwd);
      process.exitCode = 0;
      mock.restore();
      for (const t of temps.splice(0)) {
        try {
          rmSync(t, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    });

    it("registers env show/validate/init/generate-dev-vars", () => {
      const program = makeProgram();
      const config = program.commands.find((c) => c.name() === "config")!;
      const env = config.commands.find((c) => c.name() === "env")!;
      const names = env.commands.map((c) => c.name());
      expect(names).toContain("init");
      expect(names).toContain("show");
      expect(names).toContain("validate");
      expect(names).toContain("generate-dev-vars");
    });

    // -- show ---------------------------------------------------------------

    it("show errors when .env.local is missing", async () => {
      const { cap } = await runEnv(["show"]);
      try {
        expect(process.exitCode).toBe(2); // INVALID_USAGE
        expect(cap.stderr() + cap.stdout()).toMatch(/\.env\.local not found/i);
      } finally {
        cap.restore();
      }
    });

    it("show prints redacted human output", async () => {
      writeFileSync(
        join(tmpDir, ".env.local"),
        'CLOUDFLARE_API_TOKEN="s3kr3t"\nSUBDOMAIN_PREFIX="app"\n'
      );
      const { cap } = await runEnv(["show"]);
      try {
        const out = cap.stdout();
        expect(out).toContain("********");
        expect(out).not.toContain("s3kr3t");
        expect(out).toContain("app");
      } finally {
        cap.restore();
      }
    });

    it("show --json emits parsed vars", async () => {
      writeFileSync(
        join(tmpDir, ".env.local"),
        'CLOUDFLARE_ACCOUNT_ID="acct-1"\n'
      );
      const program = makeProgram();
      const cap = captureStreams();
      try {
        await program.parseAsync(
          ["node", "hoox", "--json", "config", "env", "show"],
          { from: "node" }
        );
        const json = JSON.parse(cap.stdout()) as Record<string, string>;
        expect(json.CLOUDFLARE_ACCOUNT_ID).toBe("acct-1");
      } finally {
        cap.restore();
      }
    });

    // -- validate -----------------------------------------------------------

    it("validate without .env.local reports missing and exit 1", async () => {
      const { cap } = await runEnv(["validate"]);
      try {
        const out = cap.stdout();
        expect(out).toMatch(/\.env\.local not found/i);
        expect(out).toMatch(/Missing required/i);
        expect(process.exitCode).toBe(1);
      } finally {
        cap.restore();
      }
    });

    it("validate with complete env succeeds", async () => {
      const required = {
        CLOUDFLARE_API_TOKEN: "cfut_xxx",
        CLOUDFLARE_ACCOUNT_ID: "abc123",
        SUBDOMAIN_PREFIX: "myapp",
        TRADE_INTERNAL_KEY: "trade-key",
        AGENT_INTERNAL_KEY: "agent-key",
        WEBHOOK_API_KEY_BINDING: "webhook-key",
        INTERNAL_KEY_BINDING: "inter-key",
        API_SERVICE_KEY_BINDING: "api-key",
        TELEGRAM_INTERNAL_KEY_BINDING: "tg-key",
        DASHBOARD_USER: "admin",
        DASHBOARD_PASS: "pass123",
        SESSION_SECRET: "a".repeat(32),
      };
      writeFileSync(
        join(tmpDir, ".env.local"),
        Object.entries(required)
          .map(([k, v]) => `${k}="${v}"`)
          .join("\n")
      );
      const { cap } = await runEnv(["validate"]);
      try {
        expect(cap.stdout()).toMatch(/All required environment variables/i);
        expect(process.exitCode === 0 || process.exitCode == null).toBe(true);
      } finally {
        cap.restore();
      }
    });

    it("validate --json includes missing list", async () => {
      const program = makeProgram();
      const cap = captureStreams();
      try {
        await program.parseAsync(
          ["node", "hoox", "--json", "config", "env", "validate"],
          { from: "node" }
        );
        const json = JSON.parse(cap.stdout()) as {
          missing: string[];
          warnings: string[];
        };
        expect(json.missing.length).toBeGreaterThan(0);
        expect(process.exitCode).toBe(1);
      } finally {
        cap.restore();
      }
    });

    it("validate reports SESSION_SECRET warning", async () => {
      const required = {
        CLOUDFLARE_API_TOKEN: "cfut_xxx",
        CLOUDFLARE_ACCOUNT_ID: "abc123",
        SUBDOMAIN_PREFIX: "myapp",
        TRADE_INTERNAL_KEY: "trade-key",
        AGENT_INTERNAL_KEY: "agent-key",
        WEBHOOK_API_KEY_BINDING: "webhook-key",
        INTERNAL_KEY_BINDING: "inter-key",
        API_SERVICE_KEY_BINDING: "api-key",
        TELEGRAM_INTERNAL_KEY_BINDING: "tg-key",
        DASHBOARD_USER: "admin",
        DASHBOARD_PASS: "pass123",
        SESSION_SECRET: "short",
      };
      writeFileSync(
        join(tmpDir, ".env.local"),
        Object.entries(required)
          .map(([k, v]) => `${k}="${v}"`)
          .join("\n")
      );
      const { cap } = await runEnv(["validate"]);
      try {
        expect(cap.stdout()).toMatch(/Warnings/i);
        expect(cap.stdout()).toMatch(/SESSION_SECRET/i);
      } finally {
        cap.restore();
      }
    });

    // -- generate-dev-vars --------------------------------------------------

    it("generate-dev-vars errors without .env.local", async () => {
      const { cap } = await runEnv(["generate-dev-vars"]);
      try {
        expect(process.exitCode).toBe(2);
        expect(cap.stderr() + cap.stdout()).toMatch(/\.env\.local not found/i);
      } finally {
        cap.restore();
      }
    });

    it("generate-dev-vars writes worker .dev.vars files", async () => {
      writeFileSync(
        join(tmpDir, ".env.local"),
        [
          'INTERNAL_KEY_BINDING="ik"',
          'AGENT_INTERNAL_KEY="ak"',
          'WEBHOOK_API_KEY_BINDING="wk"',
          'API_SERVICE_KEY_BINDING="as"',
        ].join("\n")
      );
      // Pre-create worker dirs so writes succeed (Bun.write creates file; parent may be needed)
      for (const w of [
        "workers/hoox-worker",
        "workers/trade-worker",
        "workers/agent-worker",
      ]) {
        mkdirSync(join(tmpDir, w), { recursive: true });
      }

      const { cap } = await runEnv(["generate-dev-vars"]);
      try {
        expect(cap.stdout()).toMatch(/Generated \.dev\.vars/i);
        const agentDev = await Bun.file(
          join(tmpDir, "workers/agent-worker/.dev.vars")
        ).text();
        expect(agentDev).toContain("AGENT_INTERNAL_KEY=ak");
      } finally {
        cap.restore();
      }
    });

    // -- init ---------------------------------------------------------------

    it("init --yes overwrites existing .env.local and writes files", async () => {
      writeFileSync(join(tmpDir, ".env.local"), "OLD=1\n");
      // Pre-create common worker dirs so Bun.write can place .dev.vars
      for (const w of [
        "workers/hoox-worker",
        "workers/trade-worker",
        "workers/agent-worker",
        "workers/d1-worker",
        "workers/telegram-worker",
        "workers/web3-wallet-worker",
        "workers/email-worker",
        "workers/analytics-worker",
        "workers/pyne-worker",
        "workers/pyne-agent-worker",
        "workers/dashboard",
      ]) {
        mkdirSync(join(tmpDir, w), { recursive: true });
      }

      const { cap } = await runEnv(["init", "--yes"]);
      try {
        expect(outroMessages.some((m) => /complete/i.test(m))).toBe(true);
        expect(logSteps.some((s) => /Overwriting/i.test(s))).toBe(true);
        const env = await Bun.file(join(tmpDir, ".env.local")).text();
        expect(env).toContain("CLOUDFLARE_API_TOKEN");
        expect(env).not.toContain("OLD=1");
      } finally {
        cap.restore();
      }
    });

    it("init cancels when user declines overwrite", async () => {
      writeFileSync(join(tmpDir, ".env.local"), "KEEP=yes\n");
      confirmSequence = [false];
      const { cap } = await runEnv(["init"]);
      try {
        expect(outroMessages.some((m) => /cancelled/i.test(m))).toBe(true);
        const env = await Bun.file(join(tmpDir, ".env.local")).text();
        expect(env).toContain("KEEP=yes");
      } finally {
        cap.restore();
      }
    });

    it("init cancels when user aborts confirm with isCancel", async () => {
      writeFileSync(join(tmpDir, ".env.local"), "KEEP=yes\n");
      simulateCancel = true;
      const { cap } = await runEnv(["init"]);
      try {
        expect(cancelMessages.some((m) => /cancelled/i.test(m))).toBe(true);
      } finally {
        cap.restore();
      }
    });

    it("init aborts mid-wizard without leaving partial env", async () => {
      // First prompt returns cancel
      let call = 0;
      mock.restore();
      installClackSpies();
      spyOn(clack, "password").mockImplementation(async () => {
        call++;
        return call === 1 ? CANCEL : passwordValue;
      });
      spyOn(clack, "isCancel").mockImplementation(
        (value: unknown): value is symbol =>
          typeof value === "symbol" &&
          Symbol.keyFor(value as symbol) === "clack.cancel"
      );

      const { cap } = await runEnv(["init"]);
      try {
        expect(
          cancelMessages.some((m) => /not modified|cancelled/i.test(m))
        ).toBe(true);
      } finally {
        cap.restore();
      }
    });
  });
});
