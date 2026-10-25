/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { advise } from "./advise.ts";
import { findEntry } from "./catalog.ts";
import { POLICY_TEXT, toolBlurb } from "./policy.ts";
import { jsonResult } from "./result.ts";
import { executeEntry } from "./runner.ts";
import { inputSchemaFor } from "./schema.ts";
import { snapshot } from "./snapshot.ts";
import type { CatalogEntry } from "./types.ts";

const TRIAGE = `Triage this Hoox checkout before changing anything.
1. Call hoox_snapshot. Add remote=true when Cloudflare credentials are available.
2. If a worker looks unhealthy, call hoox_logs_worker with its name. Leave follow unset so the call passes --no-follow.
3. Call hoox_advise with the command you just ran and follow its suggestion only when it is read-only.
4. Do not deploy, rotate secrets, reset the database, or flip the kill switch unless the user asks. Those tools return a confirm token first.`;

const DEPLOY = `Prepare a Hoox deploy and stop before the mutation.
1. Call hoox_doctor and hoox_schema_validate.
2. Call hoox_deploy_all with dry_run=true and show the result.
3. Call hoox_advise with command "deploy all".
4. Run the real deploy only after the user agrees, by calling hoox_deploy_all again with the confirm token.`;

export function createHooxMcpServer(
  catalog: readonly CatalogEntry[]
): McpServer {
  const server = new McpServer({ name: "hoox", version: "0.15.0" });
  registerAdvanced(server, catalog);
  for (const entry of catalog) {
    if (!entry.action) continue;
    registerCommand(server, entry);
  }
  registerResources(server, catalog);
  registerPrompts(server);
  return server;
}

function registerCommand(server: McpServer, entry: CatalogEntry): void {
  const config = {
    title: `hoox ${entry.path}`,
    description: toolBlurb(entry),
    inputSchema: inputSchemaFor(entry),
    annotations: {
      readOnlyHint: entry.risk === "read",
      destructiveHint: entry.destructive,
      idempotentHint: entry.risk === "read",
      openWorldHint: !entry.local,
    },
  };
  server.registerTool(entry.toolName, config, async (args) => {
    const payload = await executeEntry(entry, args as Record<string, unknown>);
    const isError = payload.status === "error" || payload.status === "refused";
    return jsonResult(payload, isError);
  });
}

function registerAdvanced(
  server: McpServer,
  catalog: readonly CatalogEntry[]
): void {
  server.registerTool(
    "hoox_catalog",
    {
      title: "Hoox command catalog",
      description:
        "List every hoox command from the live Commander tree, including risk (read, mutate, interactive) and the MCP tool name.",
      inputSchema: z.object({
        group: z
          .string()
          .optional()
          .describe("Top-level group such as deploy or monitor"),
        risk: z.enum(["read", "mutate", "interactive"]).optional(),
        query: z
          .string()
          .optional()
          .describe("Substring matched against path, summary, and tool name"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ group, risk, query }) => {
      let entries = [...catalog];
      if (group) {
        entries = entries.filter(
          (entry) => entry.path === group || entry.path.startsWith(`${group} `)
        );
      }
      if (risk) entries = entries.filter((entry) => entry.risk === risk);
      if (query) {
        const needle = query.toLowerCase();
        entries = entries.filter(
          (entry) =>
            entry.path.toLowerCase().includes(needle) ||
            entry.summary.toLowerCase().includes(needle) ||
            entry.toolName.includes(needle)
        );
      }
      return jsonResult({
        count: entries.length,
        commands: entries.map((entry) => ({
          path: entry.path,
          tool: entry.action ? entry.toolName : null,
          risk: entry.risk,
          action: entry.action,
          long: entry.long,
          destructive: entry.destructive,
          summary: entry.summary,
        })),
      });
    }
  );

  server.registerTool(
    "hoox_describe",
    {
      title: "Describe a hoox command",
      description:
        "Return arguments, flags, risk, and the Commander description for one command path or tool name.",
      inputSchema: z.object({
        command: z
          .string()
          .describe("Path such as 'deploy all' or tool name hoox_deploy_all"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ command }) => {
      const entry = findEntry(catalog, command);
      if (!entry) {
        const needle = command.trim().toLowerCase();
        const close = catalog
          .filter(
            (item) =>
              item.path.includes(needle) || item.toolName.includes(needle)
          )
          .slice(0, 8)
          .map((item) => item.path);
        return jsonResult(
          { message: `Unknown command: ${command}`, close },
          true
        );
      }
      return jsonResult({
        path: entry.path,
        tool: entry.action ? entry.toolName : null,
        risk: entry.risk,
        action: entry.action,
        long: entry.long,
        destructive: entry.destructive,
        local: entry.local,
        secret_stdin: entry.secretStdin,
        script_stdin: entry.scriptStdin,
        aliases: entry.aliases,
        summary: entry.summary,
        description: entry.description,
        args: entry.args,
        options: entry.options,
      });
    }
  );

  server.registerTool(
    "hoox_plan",
    {
      title: "Plan a hoox command",
      description:
        "Build the argv for one command. Mutating plans return a confirm token and do not run. Read-only plans do not run either.",
      inputSchema: z.object({
        command: z.string().describe("Command path, for example 'deploy all'"),
        args: z
          .record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
          )
          .optional()
          .describe(
            "Flat tool arguments: positionals, flags, cwd, secret_value"
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ command, args }) => {
      const entry = findEntry(catalog, command);
      if (!entry?.action) {
        return jsonResult(
          { message: `Unknown runnable command: ${command}` },
          true
        );
      }
      const payload = await executeEntry(
        entry,
        (args ?? {}) as Record<string, unknown>,
        { mode: "plan" }
      );
      const isError =
        payload.status === "error" || payload.status === "refused";
      return jsonResult(payload, isError);
    }
  );

  server.registerTool(
    "hoox_snapshot",
    {
      title: "Hoox ops snapshot",
      description:
        "Run a read-only local bundle: doctor, schema validate, schema list, and repair check (no typecheck). Set remote=true to add check health, workers list, kill-switch show, and tunnel check.",
      inputSchema: z.object({
        remote: z
          .boolean()
          .optional()
          .describe("Also run the Cloudflare read commands"),
        cwd: z.string().optional().describe("Absolute Hoox checkout"),
        timeout_ms: z
          .number()
          .int()
          .min(1000)
          .max(120_000)
          .optional()
          .describe("Per-command timeout. Default 40000."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ remote, cwd, timeout_ms }) => {
      const result = await snapshot(catalog, {
        remote,
        cwd,
        timeout_ms,
      });
      return jsonResult(result, !result.ok);
    }
  );

  server.registerTool(
    "hoox_advise",
    {
      title: "Advise the next hoox command",
      description:
        "Return the CLI next-step suggestion for a command, plus a workspace brief: wrangler.jsonc presence, CLI version, worker names, and whether each worker has a .dev.vars file. File contents are not read.",
      inputSchema: z.object({
        command: z
          .string()
          .optional()
          .describe("Command that just ran, for example 'deploy all'"),
        cwd: z.string().optional().describe("Absolute Hoox checkout"),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ command, cwd }) => {
      const result = await advise(catalog, command, cwd);
      return jsonResult(result, !result.ok);
    }
  );
}

function registerResources(
  server: McpServer,
  catalog: readonly CatalogEntry[]
): void {
  server.registerResource(
    "commands",
    "hoox://commands",
    {
      title: "Hoox command catalog",
      description: "Live Commander catalog with risk and tool names",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            catalog.map((entry) => ({
              path: entry.path,
              tool: entry.action ? entry.toolName : null,
              risk: entry.risk,
              summary: entry.summary,
            }))
          ),
        },
      ],
    })
  );

  server.registerResource(
    "policy",
    "hoox://policy",
    {
      title: "Hoox MCP policy",
      description: "Confirm gate, refusals, and redaction rules",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/plain", text: POLICY_TEXT }],
    })
  );
}

function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    "triage",
    {
      title: "Incident triage",
      description: "Read-only health pass before any mutation",
    },
    () => ({
      messages: [{ role: "user", content: { type: "text", text: TRIAGE } }],
    })
  );
  server.registerPrompt(
    "deploy-checklist",
    {
      title: "Deploy checklist",
      description: "Dry-run a deploy and wait for confirmation",
    },
    () => ({
      messages: [{ role: "user", content: { type: "text", text: DEPLOY } }],
    })
  );
}
