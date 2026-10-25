/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { walkCatalog } from "./catalog.ts";
import { importCliProgram } from "./cli-bridge.ts";
import type { CatalogEntry, CmdLike } from "./types.ts";

let pending: Promise<CatalogEntry[]> | null = null;

/**
 * Load the real hoox Commander tree. The CLI module installs process-level
 * error handlers that write to stdout; those would corrupt the MCP stdio
 * channel, so this removes only the listeners that import added.
 */
export function loadHooxCatalog(): Promise<CatalogEntry[]> {
  if (!pending) pending = load();
  return pending;
}

async function load(): Promise<CatalogEntry[]> {
  const beforeException = new Set(process.listeners("uncaughtException"));
  const beforeRejection = new Set(process.listeners("unhandledRejection"));
  const mod = await importCliProgram();
  for (const listener of process.listeners("uncaughtException")) {
    if (!beforeException.has(listener)) {
      process.removeListener("uncaughtException", listener);
    }
  }
  for (const listener of process.listeners("unhandledRejection")) {
    if (!beforeRejection.has(listener)) {
      process.removeListener("unhandledRejection", listener);
    }
  }
  return walkCatalog(mod.program as unknown as CmdLike);
}
