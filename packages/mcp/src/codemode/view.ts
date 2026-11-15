/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CatalogEntry } from "../types.ts";

/**
 * Compact catalog row injected into `search`.
 *
 * Names only, no schemas: descriptions, types, defaults, and choices stay
 * behind `execute` + `hoox.describe`. Keeping this small is the whole point of
 * Code Mode, because the array is what the sandbox code filters over.
 */
export interface SearchEntry {
  path: string;
  tool: string | null;
  risk: CatalogEntry["risk"];
  summary: string;
  destructive: boolean;
  local: boolean;
  action: boolean;
  /** Positional argument names, for example ["name"]. */
  args: string[];
  /** Flag tokens, for example ["--follow", "--level"]. */
  flags: string[];
}

export function searchEntries(catalog: readonly CatalogEntry[]): SearchEntry[] {
  return catalog.map((entry) => ({
    path: entry.path,
    tool: entry.action ? entry.toolName : null,
    risk: entry.risk,
    summary: entry.summary.replace(/\s+/g, " ").slice(0, 160),
    destructive: entry.destructive,
    local: entry.local,
    action: entry.action,
    args: entry.args.map((arg) => arg.name),
    flags: entry.options.map((opt) => opt.flag),
  }));
}
