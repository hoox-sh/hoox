/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Code Mode tool surface: two tools, `search` and `execute`, both taking one
 * `code` string. They are registered only when `HOOX_MCP_CODE_MODE=1`, so an
 * existing client sees a byte-identical tool list when the flag is unset.
 *
 * This module is the porting seam for the other MCP servers: give it a catalog
 * and a set of handlers and the same two tools come out.
 */

import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { advise } from "../advise.ts";
import { findEntry } from "../catalog.ts";
import { describeCommand } from "../describe.ts";
import { POLICY_TEXT } from "../policy.ts";
import { jsonResult } from "../result.ts";
import { executeEntry } from "../runner.ts";
import type { ExecDeps } from "../runner.ts";
import { inputSchemaFor } from "../schema.ts";
import { snapshot } from "../snapshot.ts";
import type { CatalogEntry, ToolPayload } from "../types.ts";
import {
  DEFAULT_LIMITS,
  type CodeModeHandlers,
  type CodeModeLimits,
  type SandboxResult,
} from "./protocol.ts";
import { runInSandbox, type SandboxDeps } from "./sandbox.ts";
import { searchEntries } from "./view.ts";

export interface CodeModeOptions {
  /** Defaults to `process.env.HOOX_MCP_CODE_MODE === "1"`. */
  enabled?: boolean;
  limits?: Partial<CodeModeLimits>;
  deps?: SandboxDeps;
  /** Runner seam, same shape snapshot.ts uses. */
  execDeps?: ExecDeps;
  /** Test seam. Production handlers are built from the catalog. */
  handlers?: Partial<CodeModeHandlers>;
}

export function codeModeEnabled(options?: CodeModeOptions): boolean {
  return options?.enabled ?? process.env.HOOX_MCP_CODE_MODE === "1";
}

export function createHandlers(
  catalog: readonly CatalogEntry[],
  overrides?: Partial<CodeModeHandlers>,
  execDeps?: ExecDeps
): CodeModeHandlers {
  const base: CodeModeHandlers = {
    async run(target, rawArgs) {
      const entry = findEntry(catalog, target);
      if (!entry?.action) {
        return refusal(
          target,
          `Unknown runnable command: ${target}. Use search to find a path, or hoox.describe for a command group.`
        );
      }
      // Same schema the direct tool uses, so execute is not a validation bypass.
      const parsed = inputSchemaFor(entry).safeParse(rawArgs ?? {});
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) =>
            issue.path.length > 0
              ? `${issue.path.join(".")}: ${issue.message}`
              : issue.message
          )
          .join("; ");
        return refusal(entry.path, `Invalid arguments: ${issues}`);
      }
      return executeEntry(entry, parsed.data as Record<string, unknown>, {
        deps: execDeps,
      });
    },

    async describe(target) {
      const described = describeCommand(catalog, target);
      return { found: described.ok, ...described.value };
    },

    async advise(command, cwd) {
      return advise(
        catalog,
        typeof command === "string" ? command : undefined,
        typeof cwd === "string" ? cwd : undefined
      );
    },

    async snapshot(options) {
      const raw =
        options && typeof options === "object"
          ? (options as Record<string, unknown>)
          : {};
      return snapshot(catalog, {
        remote: raw.remote === true,
        cwd: typeof raw.cwd === "string" ? raw.cwd : undefined,
        timeout_ms:
          typeof raw.timeout_ms === "number" ? raw.timeout_ms : undefined,
      });
    },

    async policy() {
      return { text: POLICY_TEXT };
    },
  };
  return { ...base, ...overrides };
}

export function registerCodeMode(
  server: McpServer,
  catalog: readonly CatalogEntry[],
  options: CodeModeOptions = {}
): void {
  const limits: CodeModeLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const handlers = createHandlers(catalog, options.handlers, options.execDeps);
  const compact = searchEntries(catalog);

  const codeField = z
    .string()
    .min(1)
    .max(limits.maxCodeChars)
    .describe(
      "JavaScript async arrow function with no parameters, for example `async () => ({ ok: true })`. It must return JSON-serializable data."
    );

  server.registerTool(
    "search",
    {
      title: "Search the hoox command catalog",
      description: `Search the live hoox command catalog by running JavaScript against it instead of loading every tool schema into context. \`code\` is an async arrow function; the binding \`catalog\` is an array of { path, tool, risk, summary, destructive, local, action, args, flags }. Filter it and return only the rows you need. Full argument schemas stay behind execute + hoox.describe. Runs in a bubblewrap sandbox with no filesystem, network, or environment access; if the operator sets HOOX_MCP_CODE_MODE_SANDBOX=subprocess the environment is still cleared but host filesystem reads are possible.`,
      inputSchema: z.object({ code: codeField }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ code }) => {
      const result = await runInSandbox(
        { mode: "search", code, catalog: compact, limits },
        options.deps
      );
      return jsonResult(envelope("search", result), !result.ok);
    }
  );

  server.registerTool(
    "execute",
    {
      title: "Execute hoox commands from code",
      description: `Run JavaScript that calls hoox commands, composes several calls, and returns only the data you need. \`code\` is an async arrow function. Bindings: hoox.run(pathOrTool, args) runs one command through the same confirm gate as the direct tools (a mutation returns confirmation_required and a confirm_token; pass it back as args.confirm on a later call), hoox.describe(path) returns the full argument schema, hoox.advise(), hoox.snapshot(), hoox.policy(). Runs in a bubblewrap sandbox with no filesystem, network, or environment access (if the operator sets HOOX_MCP_CODE_MODE_SANDBOX=subprocess the environment is still cleared but host filesystem reads are possible); every call is re-validated by the server.`,
      inputSchema: z.object({ code: codeField }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ code }) => {
      const result = await runInSandbox(
        { mode: "execute", code, handlers, limits },
        options.deps
      );
      return jsonResult(envelope("execute", result), !result.ok);
    }
  );
}

function envelope(mode: "search" | "execute", result: SandboxResult) {
  if (!result.ok) {
    return {
      ok: false,
      mode,
      message: result.message,
      stderr: result.stderr,
      duration_ms: result.durationMs,
    };
  }
  return {
    ok: true,
    mode,
    value: result.value,
    calls: result.calls,
    logs: result.logs,
    truncated: result.truncated,
    duration_ms: result.durationMs,
  };
}

/** Same keys as a runner payload, so the model sees one shape. */
function refusal(command: string, message: string): ToolPayload {
  return {
    status: "refused",
    command,
    risk: "mutate",
    long: false,
    argv: [],
    cwd: null,
    exit_code: null,
    duration_ms: null,
    timed_out: false,
    stdout: "",
    stderr: "",
    json: null,
    truncated: false,
    redactions: 0,
    confirm_token: null,
    expires_at: null,
    suggestion: null,
    message,
  };
}
