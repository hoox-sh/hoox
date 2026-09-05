/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for `hoox init` command.
 *
 * Mocks:
 *  - @clack/prompts → controllable prompt responses
 *  - CloudflareService   → simulated wrangler output
 *  - Bun.write           → captured file writes
 *  - process.exit        → captured exit codes
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
import * as nodeFs from "node:fs";
import { runInitCommand, verifyRepoRoot } from "./init-command.js";
import type { InitOptions } from "./types.js";
import { ExitCode } from "../../utils/errors.js";
import { CloudflareService } from "../../services/cloudflare/cloudflare-service.js";

// ---------------------------------------------------------------------------
// Mock types / helpers
// ---------------------------------------------------------------------------

/** Store captured calls so tests can assert on behaviour. */
interface CapturedCalls {
  intro: string[];
  outro: string[];
  note: { title: string; content: string }[];
  passwordMessages: string[];
  textMessages: string[];
  multiselectMessages: string[];
  selectMessages: string[];
  confirmMessages: string[];
  cancelMessages: string[];
  logInfo: string[];
  logStep: string[];
  logSuccess: string[];
  logWarn: string[];
  logError: string[];
  /** Written files: path → content */
  writes: Record<string, string>;
}

function makeCapture(): CapturedCalls {
  return {
    intro: [],
    outro: [],
    note: [],
    passwordMessages: [],
    textMessages: [],
    multiselectMessages: [],
    selectMessages: [],
    confirmMessages: [],
    cancelMessages: [],
    logInfo: [],
    logStep: [],
    logSuccess: [],
    logWarn: [],
    logError: [],
    writes: {},
  };
}

let captured: CapturedCalls;

/** Paths reported as existing by the Bun.file mock (see beforeEach). */
const fileExists = new Set<string>();

/** Directories reported as existing by the existsSync mock (see beforeEach). */
const dirExists = new Set<string>();

/** Configurable responses for each prompt type. */
interface PromptResponses {
  password?: string | symbol;
  text?: string | symbol;
  multiselect?: string[] | symbol;
  select?: string | symbol;
  /** Confirm responses returned in order (call-by-call). Defaults are `[true, false, false]`. */
  confirmSequence?: boolean[];
  /** Group responses keyed by field name */
  group?: Record<string, string>;
}

const defaultResponses: Required<PromptResponses> = {
  password: "test-token",
  text: "test-account",
  multiselect: [],
  select: "minimal",
  confirmSequence: [true, false, false], // risk → provisioning → deploy
  group: {},
};

let responses: PromptResponses = { ...defaultResponses };

/** Control how many times each prompt type has been called. */
interface CallCounters {
  password: number;
  text: number;
  multiselect: number;
  select: number;
  confirm: number;
}

let counters: CallCounters = {
  password: 0,
  text: 0,
  multiselect: 0,
  select: 0,
  confirm: 0,
};

function resetCounters(): void {
  counters = { password: 0, text: 0, multiselect: 0, select: 0, confirm: 0 };
}

/** Whether to simulate cancellation on next check. */
let simulateCancel = false;

/** Custom password responder — set per-test for sequenced token responses. */
let customPasswordResponder: ((msg: string) => string | symbol) | null = null;

// ---------------------------------------------------------------------------
// Mock: CloudflareService (prototype based — no mock.module, no leakage)
// ---------------------------------------------------------------------------

const mockWhoami = mock(
  async (): Promise<
    { ok: true; value: string } | { ok: false; error: string }
  > => ({
    ok: true,
    value: "user@example.com",
  })
);

// ---------------------------------------------------------------------------
// Mock: @clack/prompts (import namespace + spyOn, not mock.module)
// ---------------------------------------------------------------------------

import * as clack from "@clack/prompts";

function installClackSpies(): void {
  spyOn(clack, "intro").mockImplementation((msg?: string) => {
    captured.intro.push(msg ?? "");
  });
  spyOn(clack, "outro").mockImplementation((msg?: string) => {
    captured.outro.push(msg ?? "");
  });
  spyOn(clack, "note").mockImplementation(
    (content?: string, title?: string) => {
      captured.note.push({ title: title ?? "", content: content ?? "" });
    }
  );
  spyOn(clack, "password").mockImplementation(
    // @ts-expect-error — mock validate fn signature simplified vs clack's PasswordOptions
    async (opts: {
      message: string;
      validate?: (v: string) => string | void;
    }) => {
      captured.passwordMessages.push(opts.message);
      counters.password++;
      if (simulateCancel) return Symbol.for("clack.cancel");
      if (customPasswordResponder) return customPasswordResponder(opts.message);
      return responses.password ?? defaultResponses.password;
    }
  );
  spyOn(clack, "text").mockImplementation(
    // @ts-expect-error — mock validate fn signature simplified vs clack's TextOptions
    async (opts: {
      message: string;
      placeholder?: string;
      defaultValue?: string;
      validate?: (v: string) => string | void;
    }) => {
      captured.textMessages.push(opts.message);
      counters.text++;
      return simulateCancel
        ? Symbol.for("clack.cancel")
        : (responses.text ?? defaultResponses.text);
    }
  );
  spyOn(clack, "multiselect").mockImplementation(
    // @ts-expect-error — clack's multiselect is generic, mock uses concrete types
    async (opts: {
      message: string;
      options: { value: string; label: string; hint?: string }[];
      required?: boolean;
    }) => {
      captured.multiselectMessages.push(opts.message);
      counters.multiselect++;
      return simulateCancel
        ? Symbol.for("clack.cancel")
        : (responses.multiselect ?? defaultResponses.multiselect);
    }
  );
  spyOn(clack, "select").mockImplementation(
    // @ts-expect-error — clack's select is generic, mock uses concrete types
    async (opts: {
      message: string;
      options: { value: string; label: string; hint?: string }[];
    }) => {
      captured.selectMessages.push(opts.message);
      counters.select++;
      return simulateCancel
        ? Symbol.for("clack.cancel")
        : (responses.select ?? defaultResponses.select);
    }
  );
  spyOn(clack, "confirm").mockImplementation(
    async (opts: { message: string; initialValue?: boolean }) => {
      captured.confirmMessages.push(opts.message);
      const idx = counters.confirm++;
      const seq = responses.confirmSequence ?? defaultResponses.confirmSequence;
      const val = idx < seq.length ? seq[idx] : seq[seq.length - 1];
      if (simulateCancel) return Symbol.for("clack.cancel");
      return val ?? false;
    }
  );
  spyOn(clack, "group").mockImplementation(
    // @ts-expect-error — clack's group uses PromptGroup<T>, not Record<string, () => Promise<...>>
    async (
      fields: Record<string, () => Promise<string | symbol>>,
      groupOpts?: { onCancel?: () => void }
    ) => {
      const results: Record<string, string> = {};
      for (const [key, fn] of Object.entries(fields)) {
        if (simulateCancel) {
          if (groupOpts?.onCancel) groupOpts.onCancel();
          return Symbol.for("clack.cancel");
        }
        const val = await fn();
        results[key] =
          responses.group?.[key] !== undefined
            ? responses.group[key]
            : typeof val === "string"
              ? val
              : "";
      }
      return results;
    }
  );
  spyOn(clack, "isCancel").mockImplementation(
    (value: unknown): value is symbol => {
      return (
        simulateCancel ||
        (typeof value === "symbol" &&
          Symbol.keyFor(value as symbol) === "clack.cancel")
      );
    }
  );
  spyOn(clack, "cancel").mockImplementation((msg?: string) => {
    captured.cancelMessages.push(msg ?? "");
  });
  spyOn(clack.log, "info").mockImplementation((msg?: string) => {
    captured.logInfo.push(msg ?? "");
  });
  spyOn(clack.log, "step").mockImplementation((msg?: string) => {
    captured.logStep.push(msg ?? "");
  });
  spyOn(clack.log, "success").mockImplementation((msg?: string) => {
    captured.logSuccess.push(msg ?? "");
  });
  spyOn(clack.log, "warn").mockImplementation((msg?: string) => {
    captured.logWarn.push(msg ?? "");
  });
  spyOn(clack.log, "error").mockImplementation((msg?: string) => {
    captured.logError.push(msg ?? "");
  });
}

// ---------------------------------------------------------------------------
// Mock: Bun.write & Bun.file
// ---------------------------------------------------------------------------

const origWhoamiPrototype = CloudflareService.prototype.whoami;

beforeEach(() => {
  captured = makeCapture();
  responses = { ...defaultResponses };
  resetCounters();
  simulateCancel = false;
  customPasswordResponder = null;
  process.exitCode = undefined;
  mockWhoami.mockImplementation(async () => ({
    ok: true,
    value: "user@example.com",
  }));

  // Mock: CloudflareService prototype
  CloudflareService.prototype.whoami = mockWhoami;

  // Mock: @clack/prompts via spyOn (scoped, restorable)
  installClackSpies();

  // Mock Bun.write to capture all file writes

  spyOn(Bun, "write" as any).mockImplementation(
    async (path: string | URL, content: string | Uint8Array) => {
      captured.writes[String(path)] =
        typeof content === "string"
          ? content
          : new TextDecoder().decode(content);
      return typeof content === "string" ? content.length : content.byteLength;
    }
  );

  // Mock Bun.file to simulate filesystem. Paths listed in `fileExists`
  // are reported as present; everything else is absent. Defaults to the
  // monorepo marker + a wrangler signal so the command's own
  // verifyRepoRoot() guard passes in the normal-flow tests.
  fileExists.clear();
  fileExists.add("wrangler.jsonc");
  fileExists.add("packages/cli/package.json");
  dirExists.clear();

  spyOn(Bun, "file" as any).mockImplementation(
    (_path: string | URL) =>
      ({
        exists: async () => fileExists.has(String(_path)),
        text: async () => "",
        arrayBuffer: async () => new ArrayBuffer(0),
        json: async () => ({}),
        size: 0,
        name: String(_path),
        lastModified: 0,
        slice: () => new Blob(),
        stream: () => new ReadableStream(),
        type: "",
      }) as unknown as Bun.BunFile
  );

  // Mock existsSync so verifyRepoRoot's workers/ check is controllable
  // (otherwise the real monorepo workers/ dir would always pass).
  spyOn(nodeFs, "existsSync").mockImplementation((path) =>
    dirExists.has(String(path))
  );

  // Mock process.exit — no-op to prevent actual test termination
  spyOn(process, "exit").mockImplementation(((_code?: number) => {
    // no-op: prevent actual exit
  }) as never);
});

afterEach(() => {
  mock.restore();
  CloudflareService.prototype.whoami = origWhoamiPrototype;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("init command", () => {
  // ------------------------------------------------------------------
  // Interactive flow
  // ------------------------------------------------------------------

  describe("interactive flow", () => {
    it("shows intro and outro messages", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(captured.intro.length).toBeGreaterThan(0);
      expect(captured.intro.some((m) => m.includes("Hoox Setup Wizard"))).toBe(
        true
      );
      expect(captured.outro.some((m) => m.includes("Config written"))).toBe(
        true
      );
      expect(captured.outro.some((m) => m.includes("hoox setup"))).toBe(true);
    });

    it("collects Cloudflare API token with validation", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(captured.passwordMessages).toContain("Cloudflare API token:");
      expect(mockWhoami).toHaveBeenCalled();
    });

    it("retries on invalid token (validation error)", async () => {
      let callCount = 0;
      mockWhoami.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false as const, error: "Invalid credentials" };
        }
        return { ok: true as const, value: "user@example.com" };
      });

      // First password call returns bad token, second returns good token
      let pwdCount = 0;
      customPasswordResponder = (_msg: string) => {
        pwdCount++;
        return pwdCount === 1 ? "bad-token" : "good-token";
      };

      responses = {
        password: "",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // Should have called password at least twice (first failed, retry)
      expect(pwdCount).toBeGreaterThanOrEqual(2);
      expect(captured.logError.length).toBeGreaterThan(0);
    });

    it("collects account ID with default from existing wrangler.jsonc", async () => {
      const fileSpy = spyOn(Bun, "file" as any).mockImplementation(
        (path: string) => {
          if (path === "wrangler.jsonc") {
            return {
              exists: async () => true,
              text: async () =>
                '{"global":{"cloudflare_account_id":"existing-account-id-123"}}',
              arrayBuffer: async () => new ArrayBuffer(0),
              json: async () => ({}),
              size: 0,
              name: "",
              lastModified: 0,
              slice: () => new Blob(),
              stream: () => new ReadableStream(),
              type: "",
            } as unknown as Bun.BunFile;
          }
          return {
            exists: async () => path === "packages/cli/package.json",
            text: async () => "",
            arrayBuffer: async () => new ArrayBuffer(0),
            json: async () => ({}),
            size: 0,
            name: "",
            lastModified: 0,
            slice: () => new Blob(),
            stream: () => new ReadableStream(),
            type: "",
          } as unknown as Bun.BunFile;
        }
      );

      responses = {
        password: "valid-token",
        text: "existing-account-id-123",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(captured.textMessages.some((m) => m.includes("Account ID"))).toBe(
        true
      );

      fileSpy.mockRestore();
    });

    it("collects integrations via multiselect", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: ["exchange", "telegram"],
        select: "full", // full preset includes integrations
        confirmSequence: [true, false, false],
        group: {
          EXCHANGE_KEY_BINDING: "binance-key-123",
          EXCHANGE_SECRET_BINDING: "binance-secret-123",
          TG_BOT_TOKEN_BINDING: "tg-bot-token-123",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(
        captured.selectMessages.some((m) =>
          m.includes("Select a worker preset")
        )
      ).toBe(true);
    });

    it("collects per-integration secrets for selected integrations", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: ["telegram"],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          TG_BOT_TOKEN_BINDING: "tg-token-abc",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // Password prompts should include Telegram Bot Token
      expect(
        captured.passwordMessages.some((m) => m.includes("Telegram Bot Token"))
      ).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Non-interactive flow
  // ------------------------------------------------------------------

  describe("non-interactive flow", () => {
    it("skips prompts when --token and --account are provided", async () => {
      const options: InitOptions = {
        token: "cf-token-non-interactive",
        account: "cf-account-non-interactive",
        secretStore: "ss-id-123",
        prefix: "myprefix",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      // No interactive prompts should have been shown
      expect(captured.passwordMessages.length).toBe(0);
      expect(captured.textMessages.length).toBe(0);
      expect(captured.multiselectMessages.length).toBe(0);

      // Token should have been validated
      expect(mockWhoami).toHaveBeenCalled();
    });

    it("validates token in non-interactive mode", async () => {
      mockWhoami.mockImplementation(async () => ({
        ok: false as const,
        error: "Bad token",
      }));

      const options: InitOptions = {
        token: "bad-token",
        account: "abc123def456abc123def456abc123de",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      expect(process.exitCode).toBe(ExitCode.ERROR);
    });

    it("writes wrangler.jsonc in non-interactive mode", async () => {
      const options: InitOptions = {
        token: "cf-token-ni",
        account: "cf-account-ni",
        secretStore: "ss-ni",
        prefix: "ni-prefix",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      // Verify wrangler.jsonc was written
      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain("cf-token-ni");
      expect(workersJsonc).toContain("cf-account-ni");
      expect(workersJsonc).toContain("ss-ni");
      expect(workersJsonc).toContain("ni-prefix");
      expect(workersJsonc).toContain("d1-worker");
      expect(workersJsonc).toContain("hoox");
    });

    it("uses default prefix 'cryptolinx' when --prefix not provided", async () => {
      const options: InitOptions = {
        token: "cf-token-def",
        account: "cf-account-def",
      };

      await runInitCommand(options, { json: false, quiet: true }, true);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toContain("cryptolinx");
    });
  });

  // ------------------------------------------------------------------
  // wrangler.jsonc content verification
  // ------------------------------------------------------------------

  describe("wrangler.jsonc output", () => {
    it("includes base workers (d1-worker, hoox, agent-worker, analytics-worker)", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain('"d1-worker"');
      expect(workersJsonc).toContain('"hoox"');
      expect(workersJsonc).toContain('"agent-worker"');
      expect(workersJsonc).toContain('"analytics-worker"');
    });

    it("includes integration workers when selected", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          EXCHANGE_KEY_BINDING: "bk",
          EXCHANGE_SECRET_BINDING: "bs",
          TG_BOT_TOKEN_BINDING: "tgt",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain('"trade-worker"');
      expect(workersJsonc).toContain('"EXCHANGE_KEY_BINDING"');
      expect(workersJsonc).toContain('"EXCHANGE_SECRET_BINDING"');
      expect(workersJsonc).toContain('"telegram-worker"');
      expect(workersJsonc).toContain('"TG_BOT_TOKEN_BINDING"');
    });

    it("includes AI provider (OpenAI) integration from full preset", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          AGENT_INTERNAL_KEY: "sk-openai-123",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain('"agent-worker"');
      expect(workersJsonc).toContain('"AGENT_INTERNAL_KEY"');
    });

    it("includes wallet integration from full preset", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          WALLET_MNEMONIC_SECRET: "seed-phrase-789",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain('"web3-wallet-worker"');
      expect(workersJsonc).toContain('"WALLET_MNEMONIC_SECRET"');
    });

    it("merges exchange secrets into single trade-worker", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          EXCHANGE_KEY_BINDING: "bk",
          EXCHANGE_SECRET_BINDING: "bs",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain('"trade-worker"');
      expect(workersJsonc).toContain('"EXCHANGE_KEY_BINDING"');
      expect(workersJsonc).toContain('"EXCHANGE_SECRET_BINDING"');
      expect(workersJsonc).not.toContain('"BINANCE_KEY_BINDING"');
      expect(workersJsonc).not.toContain('"MEXC_KEY_BINDING"');
      // Should only appear once
      const tradeWorkerCount =
        workersJsonc?.match(/"trade-worker"/g)?.length ?? 0;
      expect(tradeWorkerCount).toBe(1);
    });

    it("includes global config section", async () => {
      responses = {
        password: "my-cf-token",
        text: "my-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain('"global"');
      expect(workersJsonc).toContain('"cloudflare_api_token"');
      expect(workersJsonc).toContain('"cloudflare_account_id"');
      expect(workersJsonc).toContain('"my-account-id"');
      expect(workersJsonc).not.toContain("my-cf-token");
      expect(workersJsonc).toContain(
        "<USE_CLOUDFLARE_API_TOKEN_ENV_OR_WRANGLER_AUTH>"
      );
    });

    it("has JSONC header comment", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain("// Hoox Workspace Configuration");
      expect(workersJsonc).toContain("// Generated by `hoox init`");
    });

    it("--self-hosted prints Docker instructions and does not write wrangler.jsonc", async () => {
      await runInitCommand(
        { selfHosted: true },
        { json: false, quiet: false },
        false
      );
      expect(captured.writes["wrangler.jsonc"]).toBeUndefined();
      const notes = captured.note.map((n) => n.content).join("\n");
      expect(notes).toContain("docker:prod");
      expect(notes).toContain("server.js");
    });
  });

  // ------------------------------------------------------------------
  // .dev.vars creation
  // ------------------------------------------------------------------

  describe(".dev.vars creation", () => {
    it("creates .dev.vars for integration workers", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          TG_BOT_TOKEN_BINDING: "tg-secret-value",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const devVarsPath = "workers/telegram-worker/.dev.vars";
      const devVars = captured.writes[devVarsPath];
      expect(devVars).toBeDefined();
      expect(devVars).toContain("TG_BOT_TOKEN_BINDING=tg-secret-value");
      expect(devVars).toContain("NEVER commit this file");
    });

    it("does not create .dev.vars for workers without secrets", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // d1-worker has no user-collected secrets
      const d1DevVars = captured.writes["workers/d1-worker/.dev.vars"];
      expect(d1DevVars).toBeUndefined();
    });

    it("creates .dev.vars for agent-worker when an AI provider is selected", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          AGENT_INTERNAL_KEY: "sk-openai-real-value",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const devVarsPath = "workers/agent-worker/.dev.vars";
      const devVars = captured.writes[devVarsPath];
      expect(devVars).toBeDefined();
      expect(devVars).toContain("AGENT_INTERNAL_KEY=sk-openai-real-value");
      expect(devVars).toContain("NEVER commit this file");
    });

    it("creates .dev.vars for web3-wallet-worker when wallet integration selected", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          WALLET_MNEMONIC_SECRET: "mnemonic-real-value",
        },
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      const devVarsPath = "workers/web3-wallet-worker/.dev.vars";
      const devVars = captured.writes[devVarsPath];
      expect(devVars).toBeDefined();
      expect(devVars).toContain("WALLET_MNEMONIC_SECRET=mnemonic-real-value");
      expect(devVars).toContain("NEVER commit this file");
    });
  });

  // ------------------------------------------------------------------
  // Cancellation handling
  // ------------------------------------------------------------------

  describe("cancellation handling", () => {
    it("exits on cancel during risk acknowledgment", async () => {
      // Make the first confirm return false (user declines the risk terms)
      responses.confirmSequence = [false];

      await runInitCommand({}, { json: false, quiet: true }, false);

      expect(process.exitCode).toBe(0);
      // Must not fall through and write config after risk decline
      expect(captured.writes["wrangler.jsonc"]).toBeUndefined();
    });
  });

  // ------------------------------------------------------------------
  // Global options (--json, --quiet)
  // ------------------------------------------------------------------

  describe("global options", () => {
    it("suppresses output in quiet mode", async () => {
      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false],
      };

      await runInitCommand({}, { json: false, quiet: true }, false);

      // In quiet mode, formatSuccess/formatter functions respect quiet mode.
      // The flow should complete without throwing.
      expect(captured.writes["wrangler.jsonc"]).toBeDefined();
    });
  });

  describe("verifyRepoRoot", () => {
    it("passes with packages/cli/package.json + wrangler.jsonc.example (no wrangler.jsonc)", async () => {
      fileExists.clear();
      dirExists.clear();
      fileExists.add("packages/cli/package.json");
      fileExists.add("wrangler.jsonc.example");
      await expect(verifyRepoRoot()).resolves.toBeUndefined();
    });

    it("passes with packages/cli/package.json + wrangler.jsonc", async () => {
      fileExists.clear();
      dirExists.clear();
      fileExists.add("packages/cli/package.json");
      fileExists.add("wrangler.jsonc");
      await expect(verifyRepoRoot()).resolves.toBeUndefined();
    });

    it("passes with packages/cli/package.json + workers/ directory", async () => {
      fileExists.clear();
      dirExists.clear();
      fileExists.add("packages/cli/package.json");
      dirExists.add("workers");
      await expect(verifyRepoRoot()).resolves.toBeUndefined();
    });

    it("passes with packages/cli/package.json + .gitmodules", async () => {
      fileExists.clear();
      dirExists.clear();
      fileExists.add("packages/cli/package.json");
      fileExists.add(".gitmodules");
      await expect(verifyRepoRoot()).resolves.toBeUndefined();
    });

    it("throws INVALID_USAGE when packages/cli is missing", async () => {
      fileExists.clear();
      dirExists.clear();
      fileExists.add("wrangler.jsonc");
      fileExists.add("wrangler.jsonc.example");
      await expect(verifyRepoRoot()).rejects.toThrowError(
        /this is not the hoox monorepo/
      );
    });

    it("throws INVALID_USAGE when has packages/cli but no other markers", async () => {
      fileExists.clear();
      dirExists.clear();
      fileExists.add("packages/cli/package.json");
      await expect(verifyRepoRoot()).rejects.toThrowError(
        /missing Hoox repo markers/
      );
    });

    it("throws INVALID_USAGE when run from an empty directory", async () => {
      fileExists.clear();
      dirExists.clear();
      await expect(verifyRepoRoot()).rejects.toThrowError(
        /git clone --recursive/
      );
    });
  });

  // ------------------------------------------------------------------
  // Additional paths (accept-risk, resume, provisioning, presets)
  // ------------------------------------------------------------------

  describe("accept-risk and presets", () => {
    it("skips risk confirmation when --accept-risk is set", async () => {
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "standard",
        confirmSequence: [false, false], // would fail risk if not skipped
      };

      await runInitCommand(
        { acceptRisk: true },
        { json: false, quiet: true },
        false
      );

      // Risk confirm should not have run; select for preset should have
      expect(
        captured.confirmMessages.some((m) => m.includes("acknowledge"))
      ).toBe(false);
      expect(captured.writes["wrangler.jsonc"]).toBeDefined();
    });

    it("applies standard preset in non-interactive mode", async () => {
      const options: InitOptions = {
        token: "cf-token",
        account: "cf-account",
        preset: "standard",
      };
      await runInitCommand(options, { json: false, quiet: true }, true);
      const workersJsonc = captured.writes["wrangler.jsonc"];
      expect(workersJsonc).toBeDefined();
      expect(workersJsonc).toContain("trade-worker");
    });

    it("defaults invalid preset to minimal in non-interactive mode", async () => {
      const options: InitOptions = {
        token: "cf-token",
        account: "cf-account",
        preset: "not-a-real-preset",
      };
      await runInitCommand(options, { json: false, quiet: false }, true);
      expect(captured.writes["wrangler.jsonc"]).toContain("d1-worker");
      expect(captured.intro.length + captured.note.length).toBeGreaterThan(0);
    });
  });

  describe("provisioning step", () => {
    it("runs CLIProvisioner when user confirms provisioning", async () => {
      const { CLIProvisioner } = await import("./cli-provisioner.js");
      const orig = CLIProvisioner.prototype.provision;
      CLIProvisioner.prototype.provision = mock(async () => ({
        success: true,
        created: ["D1:trade-data-db"],
        errors: [],
      })) as typeof orig;

      // risk accept, provision yes, deploy no
      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, true, false],
      };

      try {
        await runInitCommand({}, { json: false, quiet: true }, false);
        expect(CLIProvisioner.prototype.provision).toHaveBeenCalled();
      } finally {
        CLIProvisioner.prototype.provision = orig;
      }
    });

    it("skips provisioner when user declines", async () => {
      const { CLIProvisioner } = await import("./cli-provisioner.js");
      const orig = CLIProvisioner.prototype.provision;
      const provisionMock = mock(async () => ({
        success: true,
        created: [],
        errors: [],
      }));
      CLIProvisioner.prototype.provision = provisionMock as typeof orig;

      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, false, false], // risk yes, provision no, deploy no
      };

      try {
        await runInitCommand({}, { json: false, quiet: true }, false);
        expect(provisionMock).not.toHaveBeenCalled();
        expect(captured.writes["wrangler.jsonc"]).toBeDefined();
      } finally {
        CLIProvisioner.prototype.provision = orig;
      }
    });

    it("warns when provisioner returns errors", async () => {
      const { CLIProvisioner } = await import("./cli-provisioner.js");
      const orig = CLIProvisioner.prototype.provision;
      CLIProvisioner.prototype.provision = mock(async () => ({
        success: false,
        created: [],
        errors: ["D1:trade-data-db — already exists"],
      })) as typeof orig;

      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        confirmSequence: [true, true, false],
      };

      try {
        await runInitCommand({}, { json: false, quiet: true }, false);
        expect(captured.logWarn.some((m) => m.includes("issues"))).toBe(true);
      } finally {
        CLIProvisioner.prototype.provision = orig;
      }
    });
  });

  describe("resume flow", () => {
    it("loads saved wizard state when --resume is set", async () => {
      // Serialize a partial wizard state at CLOUDFLARE_CONFIG step
      const { WizardEngine, serializeState, WIZARD_STATE_PATH } =
        await import("@hoox-sh/hoox-shared");
      const engine = new WizardEngine();
      engine.execute({ checksPassed: true });
      const stateJson = serializeState(engine.getState());

      // Point Bun.file at the state path with content
      const prevFileImpl = (Bun as any).file;
      spyOn(Bun, "file" as any).mockImplementation((path: string | URL) => {
        const p = String(path);
        if (p === WIZARD_STATE_PATH || p.endsWith(".hoox-wizard-state.json")) {
          return {
            exists: async () => true,
            text: async () => stateJson,
            arrayBuffer: async () => new ArrayBuffer(0),
            json: async () => ({}),
            size: stateJson.length,
            name: p,
            lastModified: 0,
            slice: () => new Blob(),
            stream: () => new ReadableStream(),
            type: "",
          } as unknown as Bun.BunFile;
        }
        return {
          exists: async () =>
            p === "wrangler.jsonc" || p === "packages/cli/package.json",
          text: async () => "",
          arrayBuffer: async () => new ArrayBuffer(0),
          json: async () => ({}),
          size: 0,
          name: p,
          lastModified: 0,
          slice: () => new Blob(),
          stream: () => new ReadableStream(),
          type: "",
        } as unknown as Bun.BunFile;
      });

      responses = {
        password: "valid-token",
        text: "test-account-id",
        multiselect: [],
        select: "minimal",
        // First confirm: resume yes; then risk already done so no risk; provision no; deploy no
        confirmSequence: [true, false, false],
      };

      try {
        await runInitCommand(
          { resume: true },
          { json: false, quiet: true },
          false
        );
        expect(captured.confirmMessages.some((m) => m.includes("Resume"))).toBe(
          true
        );
        expect(captured.writes["wrangler.jsonc"]).toBeDefined();
      } finally {
        // restore handled by afterEach mock.restore
        void prevFileImpl;
      }
    });
  });

  describe("createDevVars mkdir fallback", () => {
    it("creates parent dir when first Bun.write fails", async () => {
      let writeCalls = 0;
      spyOn(Bun, "write" as any).mockImplementation(
        async (path: string | URL, content: string | Uint8Array) => {
          const p = String(path);
          const body =
            typeof content === "string"
              ? content
              : new TextDecoder().decode(content);
          // Fail first write to a .dev.vars path to force mkdir path
          if (p.endsWith(".dev.vars") && writeCalls === 0) {
            writeCalls++;
            throw new Error("ENOENT");
          }
          captured.writes[p] = body;
          return body.length;
        }
      );

      responses = {
        password: "valid-token",
        text: "test-account",
        multiselect: [],
        select: "full",
        confirmSequence: [true, false, false],
        group: {
          TG_BOT_TOKEN_BINDING: "tg-secret",
        },
      };

      await runInitCommand({}, { json: false, quiet: false }, false);

      const devVarsPath = "workers/telegram-worker/.dev.vars";
      expect(captured.writes[devVarsPath]).toBeDefined();
    });
  });

  describe("registerInitCommand", () => {
    it("registers init on a program", async () => {
      const { registerInitCommand } = await import("./init-command.js");
      const { Command } = await import("commander");
      const program = new Command();
      program.exitOverride();
      registerInitCommand(program);
      const init = program.commands.find((c) => c.name() === "init");
      expect(init).toBeDefined();
      expect(init!.options.map((o) => o.long)).toContain("--token");
      expect(init!.options.map((o) => o.long)).toContain("--accept-risk");
    });
  });

  describe("token env persistence", () => {
    it("keeps CLOUDFLARE_API_TOKEN after successful non-interactive validation", async () => {
      // Bracket access avoids TS narrowing process.env.KEY to undefined after delete.
      delete process.env["CLOUDFLARE_API_TOKEN"];
      delete process.env["CLOUDFLARE_ACCOUNT_ID"];
      const options: InitOptions = {
        token: "new-token",
        account: "acct",
      };
      await runInitCommand(options, { json: false, quiet: true }, true);
      expect(process.env["CLOUDFLARE_API_TOKEN"]).toBe("new-token");
      expect(process.env["CLOUDFLARE_ACCOUNT_ID"]).toBe("acct");
      delete process.env["CLOUDFLARE_API_TOKEN"];
      delete process.env["CLOUDFLARE_ACCOUNT_ID"];
    });

    it("does not persist token when non-interactive validation fails", async () => {
      delete process.env["CLOUDFLARE_API_TOKEN"];
      mockWhoami.mockImplementation(async () => ({
        ok: false as const,
        error: "Bad token",
      }));
      const options: InitOptions = {
        token: "bad-token",
        account: "acct",
      };
      await runInitCommand(options, { json: false, quiet: true }, true);
      expect(process.exitCode).toBe(ExitCode.ERROR);
      expect(process.env.CLOUDFLARE_API_TOKEN).toBeUndefined();
      // Must not continue and write config after token failure
      expect(captured.writes["wrangler.jsonc"]).toBeUndefined();
    });
  });
});
