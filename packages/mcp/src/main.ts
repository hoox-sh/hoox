/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { resolveSandboxKind } from "./codemode/sandbox.ts";
import { loadHooxCatalog } from "./load-catalog.ts";
import { createHooxMcpServer } from "./server.ts";

const catalog = await loadHooxCatalog();
const tools = catalog.filter((entry) => entry.action).length;
const base = `${tools} command tools plus catalog, describe, plan, snapshot, advise`;
if (process.env.HOOX_MCP_CODE_MODE === "1") {
  const sandbox = resolveSandboxKind();
  console.error(
    "error" in sandbox
      ? `hoox-mcp: ${base} plus code mode (search, execute) — FAILING CLOSED: ${sandbox.error}`
      : `hoox-mcp: ${base} plus code mode (search, execute) in a ${sandbox.kind} sandbox`
  );
} else {
  console.error(`hoox-mcp: ${base}`);
}
serveStdio(() => createHooxMcpServer(catalog));
