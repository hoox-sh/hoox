/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Code Mode end-to-end proof.
 *
 *   bun packages/mcp/scripts/codemode-e2e.ts
 *
 * Starts the real stdio server twice (flag off, flag on), prints the tool-count
 * delta, then calls `search` and `execute` once each and prints the payloads.
 * The last call asks for a destructive command without a confirm token and must
 * come back as `confirmation_required` without running anything.
 */

import { resolve } from "node:path";
import { McpStdio, type McpToolResult } from "./mcp-stdio.ts";

const pkgRoot = resolve(import.meta.dir, "..");

function summarize(result: McpToolResult): unknown {
  if (result.structuredContent !== undefined) return result.structuredContent;
  const text = result.content?.[0]?.text ?? "";
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text.slice(0, 400);
  }
}

function clip(value: unknown, max = 1_600): string {
  const text = JSON.stringify(value, null, 2);
  return text.length > max
    ? `${text.slice(0, max)}\n… (${text.length} chars)`
    : text;
}

async function toolNames(env: Record<string, string | undefined>) {
  const client = await McpStdio.start({ cwd: pkgRoot, env });
  const names = (await client.listTools()).map((tool) => tool.name);
  client.close();
  return names;
}

const off = await toolNames({ HOOX_MCP_CODE_MODE: undefined });
const on = await toolNames({ HOOX_MCP_CODE_MODE: "1" });
const added = on.filter((name) => !off.includes(name));

console.log("== tool list ==");
console.log(
  `flag unset : ${off.length} tools, search=${off.includes("search")}, execute=${off.includes("execute")}`
);
console.log(`flag set   : ${on.length} tools, added=${JSON.stringify(added)}`);
console.log(
  `prefix identical: ${JSON.stringify(on.slice(0, off.length)) === JSON.stringify(off)}`
);

const client = await McpStdio.start({
  cwd: pkgRoot,
  env: { HOOX_MCP_CODE_MODE: "1" },
  timeoutMs: 60_000,
});

try {
  console.log("\n== search ==");
  const search = await client.callTool("search", {
    code: `async () => catalog
      .filter((e) => e.risk === "read" && /health|doctor|status/i.test(e.path + " " + e.summary))
      .map((e) => ({ path: e.path, tool: e.tool, risk: e.risk, summary: e.summary }))`,
  });
  console.log(clip(summarize(search)));

  console.log("\n== execute: read-only command + schema on demand ==");
  const execute = await client.callTool("execute", {
    code: `async () => {
      const run = await hoox.run("disclaimer");
      const schema = await hoox.describe("doctor");
      return {
        disclaimer: { status: run.status, exit_code: run.exit_code, first_line: run.stdout.split("\\n")[0] },
        doctor: { path: schema.path, risk: schema.risk, flags: schema.options.map((o) => o.flag) }
      };
    }`,
  });
  console.log(clip(summarize(execute)));

  console.log("\n== execute: destructive command without a confirm token ==");
  const held = await client.callTool("execute", {
    code: `async () => {
      const held = await hoox.run("db reset");
      return { status: held.status, command: held.command, risk: held.risk, message: held.message, has_token: Boolean(held.confirm_token), argv: held.argv };
    }`,
  });
  console.log(clip(summarize(held)));

  console.log("\n== execute: sandbox escape attempt ==");
  const escape = await client.callTool("execute", {
    code: `async () => process.env.CLOUDFLARE_API_TOKEN`,
  });
  console.log(clip(summarize(escape)));
} finally {
  client.close();
}
