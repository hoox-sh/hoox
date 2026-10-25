/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { findEntry } from "./catalog.ts";
import { classifyCall } from "./policy.ts";
import { executeEntry, type ExecDeps } from "./runner.ts";
import type { CatalogEntry } from "./types.ts";

const LOCAL: Array<{ path: string; values?: Record<string, unknown> }> = [
  { path: "doctor" },
  { path: "schema validate" },
  { path: "schema list" },
  { path: "repair check", values: { no_typecheck: true } },
];

const REMOTE: Array<{ path: string; values?: Record<string, unknown> }> = [
  { path: "check health" },
  { path: "workers list" },
  { path: "monitor kill-switch show" },
  { path: "tunnel check" },
];

export async function snapshot(
  catalog: readonly CatalogEntry[],
  opts: {
    remote?: boolean;
    cwd?: string;
    timeout_ms?: number;
    deps?: ExecDeps;
  }
) {
  const jobs = [...LOCAL, ...(opts.remote ? REMOTE : [])];
  const results = await Promise.all(
    jobs.map(async (job) => {
      const entry = findEntry(catalog, job.path);
      if (!entry?.action) {
        return {
          command: job.path,
          status: "refused" as const,
          message: "command is not in the catalog",
        };
      }
      const values: Record<string, unknown> = {
        ...(job.values ?? {}),
        timeout_ms: opts.timeout_ms ?? 40_000,
      };
      if (opts.cwd) values.cwd = opts.cwd;
      const classified = classifyCall(entry, values);
      if (classified.risk !== "read") {
        return {
          command: job.path,
          status: "refused" as const,
          message: "snapshot only runs read-only commands",
        };
      }
      const result = await executeEntry(entry, values, { deps: opts.deps });
      return {
        command: entry.path,
        status: result.status,
        exit_code: result.exit_code,
        duration_ms: result.duration_ms,
        timed_out: result.timed_out,
        stdout: result.stdout,
        stderr: result.stderr,
        json: result.json,
        message: result.message,
      };
    })
  );
  const failed = results.filter(
    (item) => item.status === "error" || item.status === "refused"
  ).length;
  return {
    remote: Boolean(opts.remote),
    ok: failed === 0,
    failed,
    results,
  };
}
