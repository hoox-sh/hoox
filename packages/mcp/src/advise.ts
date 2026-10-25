/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findEntry } from "./catalog.ts";
import { suggestNextCommand } from "./cli-bridge.ts";
import { resolveCwd } from "./paths.ts";
import type { CatalogEntry } from "./types.ts";

export interface WorkspaceBrief {
  wrangler: boolean;
  cli_version: string | null;
  workers: Array<{ name: string; dev_vars: boolean }>;
}

export async function advise(
  catalog: readonly CatalogEntry[],
  command: string | undefined,
  cwdRequested?: string
) {
  const cwd = resolveCwd(cwdRequested);
  if (!cwd.ok) return { ok: false as const, message: cwd.message };
  const entry = command ? findEntry(catalog, command) : undefined;
  const path = entry?.path ?? command?.trim() ?? "";
  const suggestion = path ? await suggestNextCommand(path) : null;
  return {
    ok: true as const,
    cwd: cwd.cwd,
    command: path || null,
    tool: entry?.toolName ?? null,
    risk: entry?.risk ?? null,
    action: entry ? entry.action : null,
    known: Boolean(entry),
    suggestion,
    workspace: inspectWorkspace(cwd.cwd),
  };
}

function inspectWorkspace(root: string): WorkspaceBrief {
  return {
    wrangler: existsSync(join(root, "wrangler.jsonc")),
    cli_version: readCliVersion(root),
    workers: listWorkers(root),
  };
}

function listWorkers(root: string): WorkspaceBrief["workers"] {
  const dir = join(root, "workers");
  if (!existsSync(dir)) return [];
  const out: WorkspaceBrief["workers"] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    out.push({
      name: entry.name,
      dev_vars: existsSync(join(dir, entry.name, ".dev.vars")),
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

function readCliVersion(root: string): string | null {
  try {
    const raw = readFileSync(join(root, "packages/cli/package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}
