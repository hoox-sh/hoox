/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { findEntry } from "./catalog.ts";
import type { CatalogEntry } from "./types.ts";

export interface DescribeResult {
  ok: boolean;
  value: Record<string, unknown>;
}

/**
 * The `hoox_describe` projection, shared with `execute` so the two never drift.
 * Field names and ordering are part of the tool output; keep them stable.
 */
export function describeCommand(
  catalog: readonly CatalogEntry[],
  command: string
): DescribeResult {
  const entry = findEntry(catalog, command);
  if (!entry) {
    const needle = command.trim().toLowerCase();
    const close = catalog
      .filter(
        (item) => item.path.includes(needle) || item.toolName.includes(needle)
      )
      .slice(0, 8)
      .map((item) => item.path);
    return {
      ok: false,
      value: { message: `Unknown command: ${command}`, close },
    };
  }
  return {
    ok: true,
    value: {
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
    },
  };
}
