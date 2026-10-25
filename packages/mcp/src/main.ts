/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadHooxCatalog } from "./load-catalog.ts";
import { createHooxMcpServer } from "./server.ts";

const catalog = await loadHooxCatalog();
const tools = catalog.filter((entry) => entry.action).length;
console.error(
  `hoox-mcp: ${tools} command tools plus catalog, describe, plan, snapshot, advise`
);
serveStdio(() => createHooxMcpServer(catalog));
