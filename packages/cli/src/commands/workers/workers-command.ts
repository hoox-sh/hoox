/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `hoox workers` command group — facade for worker management.
 *
 * Subcommands:
 *   list                — List catalog + config workers with enabled status
 *   catalog             — Show the canonical worker catalog (defaults)
 *   enable <name...>    — Enable workers in wrangler.jsonc
 *   disable <name...>   — Disable workers in wrangler.jsonc
 *   dev <name>          — Delegate to `hoox dev worker <name>`
 *   logs <name>         — Delegate to `hoox logs worker <name>`
 *
 * Note: 'hoox workers status' was removed — use 'hoox check health' instead.
 */

import { Command } from "commander";
import { WORKER_CATALOG, WORKER_MANIFESTS } from "@hoox-sh/hoox-shared";
import {
  cloneWorkerIfMissing,
  createWorkspaceConfigService,
  wireCallerBindings,
} from "../../services/stack/index.js";
import {
  formatTable,
  formatJson,
  formatSuccess,
  getFormatOptions,
} from "../../utils/formatters.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch worker data from ConfigService and render as a list.
 * Respects --json and --quiet flags via FormatOptions.
 */
async function doListWorkers(fmt: FormatOptions): Promise<void> {
  const configService = createWorkspaceConfigService();
  await configService.load();

  const statuses = configService.listWorkerStatuses();

  const rows = statuses.map((w) => ({
    Worker: w.name,
    Status: w.enabled ? "enabled" : "disabled",
    Tier: w.tier ?? "-",
    Default:
      w.defaultEnabled === undefined
        ? "-"
        : w.defaultEnabled
          ? "enabled"
          : "disabled",
    Path: w.path,
    Config: w.inConfig ? "yes" : "no",
    Catalog: w.inCatalog ? "yes" : "no",
  }));

  if (fmt.json) {
    formatJson(
      statuses.map((w) => ({
        name: w.name,
        enabled: w.enabled,
        defaultEnabled: w.defaultEnabled ?? null,
        tier: w.tier ?? null,
        available: w.available,
        path: w.path,
        inConfig: w.inConfig,
        inCatalog: w.inCatalog,
      })),
      fmt
    );
    return;
  }

  formatTable(rows, fmt);
}

function doCatalog(fmt: FormatOptions): void {
  const rows = WORKER_CATALOG.map((w) => ({
    Worker: w.name,
    Tier: w.tier,
    Default: w.defaultEnabled ? "enabled" : "disabled",
    Available: w.available ? "yes" : "planned",
    Path: w.path,
  }));

  if (fmt.json) {
    formatJson(
      WORKER_CATALOG.map((w) => ({
        name: w.name,
        defaultEnabled: w.defaultEnabled,
        tier: w.tier,
        available: w.available,
        path: w.path,
        description: w.description ?? null,
        aliases: w.aliases ?? [],
      })),
      fmt
    );
    return;
  }

  formatTable(rows, fmt);
}

async function doSetEnabled(
  names: string[],
  enabled: boolean,
  fmt: FormatOptions
): Promise<void> {
  if (names.length === 0) {
    throw new CLIError(
      `Specify at least one worker name (e.g. hoox workers ${enabled ? "enable" : "disable"} trade-worker)`,
      ExitCode.INVALID_USAGE,
      undefined,
      true,
      `Run \`hoox workers catalog\` to see known workers.`
    );
  }

  const configService = createWorkspaceConfigService();
  await configService.load();

  let results: { name: string; enabled: boolean; seeded: boolean }[];
  try {
    results = await configService.setWorkersEnabled(names, enabled);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new CLIError(msg, ExitCode.INVALID_USAGE, undefined, true);
  }

  if (enabled) {
    for (const r of results) {
      const manifest = WORKER_MANIFESTS[r.name];
      if (!manifest) continue;
      await wireCallerBindings(r.name, fmt);
      if ((manifest.tier ?? "core") === "optional") {
        await cloneWorkerIfMissing(r.name, manifest.path, fmt);
      }
    }
  }

  if (fmt.json) {
    formatJson({ action: enabled ? "enable" : "disable", results }, fmt);
    return;
  }

  for (const r of results) {
    const seedNote = r.seeded ? " (seeded from catalog)" : "";
    formatSuccess(
      `${r.name} → ${r.enabled ? "enabled" : "disabled"}${seedNote}`,
      fmt
    );
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox workers` command group with subcommands:
 * list, catalog, enable, disable, dev, logs.
 */
export function registerWorkersCommand(program: Command): void {
  const workersCmd = program
    .command("workers")
    .summary("Manage Cloudflare Workers (list, enable, disable, dev, logs)")
    .description(
      `Manage your Hoox Cloudflare Workers.

SUBCOMMANDS:
  list              List all workers (catalog + config) with status
  catalog           Show the canonical worker catalog and defaults
  enable <name...>  Enable workers in wrangler.jsonc
  disable <name...> Disable workers in wrangler.jsonc
  dev <name>        Start a worker for local development (delegates to dev worker)
  logs <name>       Tail logs for a specific worker (delegates to logs worker)

The worker catalog (shared package) is the source of all known workers and
their default enabled flags. Enable/disable updates workers.<name>.enabled
in the root wrangler.jsonc. Missing catalog workers are seeded on enable.

For health checks, use 'hoox check health'.
For deployments, use 'hoox deploy workers' or 'hoox deploy worker <name>'.

EXAMPLES:
  hoox workers list
  hoox workers catalog
  hoox workers enable trade-worker agent-worker
  hoox workers disable web3-wallet-worker email-worker
  hoox workers dev trade-worker
  hoox workers logs hoox`
    );

  // -- workers list ----------------------------------------------------------

  workersCmd
    .command("list")
    .summary("List workers with enabled status (catalog + config)")
    .description(
      `List all workers from the shared catalog merged with wrangler.jsonc.

Columns:
  - Worker name
  - Status (effective enabled/disabled)
  - Default (catalog default)
  - Path
  - Config / Catalog membership

EXAMPLES:
  hoox workers list
  hoox workers list --json`
    )
    .action(
      withErrorHandling(
        async (_opts: unknown, cmd: Command) => {
          const fmt = getFormatOptions(cmd);
          await doListWorkers(fmt);
        },
        { service: "workers" }
      )
    );

  // -- workers catalog -------------------------------------------------------

  workersCmd
    .command("catalog")
    .summary("Show the canonical worker catalog with defaults")
    .description(
      `Print the shared worker catalog — every known worker and its default
enabled flag. This is the source of truth used when seeding missing workers
on enable.

EXAMPLES:
  hoox workers catalog
  hoox workers catalog --json`
    )
    .action(
      withErrorHandling(
        async (_opts: unknown, cmd: Command) => {
          const fmt = getFormatOptions(cmd);
          doCatalog(fmt);
        },
        { service: "workers" }
      )
    );

  // -- workers enable <names...> ---------------------------------------------

  workersCmd
    .command("enable")
    .argument("<names...>", "Worker name(s) to enable")
    .summary("Enable one or more workers in wrangler.jsonc")
    .description(
      `Set workers.<name>.enabled = true in the root wrangler.jsonc.

If a worker exists in the catalog but not in config, it is seeded with
path/secrets from the catalog and enabled. Optional satellites
(pyne-worker, pyne-agent-worker) are cloned and wired into caller
service bindings. Planned stubs (pynets-worker) cannot be enabled.

ARGUMENTS:
  names    One or more worker names (e.g. trade-worker email-worker)

EXAMPLES:
  hoox workers enable trade-worker
  hoox workers enable report-worker web3-wallet-worker
  hoox workers enable dashboard --json`
    )
    .action(
      withErrorHandling(
        async (names: string[], _opts: unknown, cmd: Command) => {
          const fmt = getFormatOptions(cmd);
          await doSetEnabled(names, true, fmt);
        },
        { service: "workers" }
      )
    );

  // -- workers disable <names...> --------------------------------------------

  workersCmd
    .command("disable")
    .argument("<names...>", "Worker name(s) to disable")
    .summary("Disable one or more workers in wrangler.jsonc")
    .description(
      `Set workers.<name>.enabled = false in the root wrangler.jsonc.

Disabled workers are skipped by deploy/logs/all flows that use
ConfigService.listEnabledWorkers().

ARGUMENTS:
  names    One or more worker names

EXAMPLES:
  hoox workers disable email-worker
  hoox workers disable web3-wallet-worker report-worker`
    )
    .action(
      withErrorHandling(
        async (names: string[], _opts: unknown, cmd: Command) => {
          const fmt = getFormatOptions(cmd);
          await doSetEnabled(names, false, fmt);
        },
        { service: "workers" }
      )
    );

  // -- workers dev <name> ----------------------------------------------------
  // Delegates entirely to `hoox dev worker <name>`

  workersCmd
    .command("dev <name>")
    .summary("Start a single worker for local development")
    .description(
      `Start a specific worker for local development by running \`hoox dev worker <name>\` in-process.

ARGUMENTS:
  name      Worker name (e.g., trade-worker, agent-worker, hoox)

EXAMPLES:
  hoox workers dev trade-worker      Start dev server for trade-worker
  hoox workers dev hoox              Start dev server for the hoox gateway`
    )
    .action(
      withErrorHandling(
        async (name: string) => {
          // In-process re-parse (avoids PATH/stale global `hoox` / bad shell aliases)
          await program.parseAsync(["dev", "worker", name], { from: "user" });
        },
        { service: "workers" }
      )
    );

  // -- workers logs <name> ---------------------------------------------------
  // Delegates entirely to `hoox logs worker <name>`

  workersCmd
    .command("logs <name>")
    .summary("Tail logs for a specific worker")
    .description(
      `Tail logs for a specific worker by running \`hoox logs worker <name>\` in-process.

ARGUMENTS:
  name      Worker name (e.g., trade-worker, agent-worker, hoox)

EXAMPLES:
  hoox workers logs hoox             Tail logs for the hoox gateway
  hoox workers logs trade-worker     Tail logs for trade-worker`
    )
    .action(
      withErrorHandling(
        async (name: string) => {
          await program.parseAsync(["logs", "worker", name], { from: "user" });
        },
        { service: "workers" }
      )
    );
}
