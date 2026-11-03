/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Enable optional catalog workers and wire them into the HOOX stack.
 *
 * Used when a command targets a satellite (pyne-worker, pyne-agent-worker)
 * that is not yet in wrangler.jsonc — prompt (or `--yes`) instead of
 * "Worker not found in config".
 */

import { copyFile, mkdir, readdir, rename, rm } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import { parse as parseJsonc, modify, applyEdits } from "jsonc-parser";
import type { FormattingOptions } from "jsonc-parser";
import * as p from "@clack/prompts";
import {
  WORKER_CATALOG,
  WORKER_MANIFESTS,
  resolveCatalogWorkerName,
  isPlannedWorker,
  plannedWorkerMessage,
} from "@hoox-sh/hoox-shared";
import { ConfigService } from "../config/index.js";
import type { WorkerConfig } from "../config/index.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { formatSuccess } from "../../utils/formatters.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { isRichMode } from "../../utils/format-mode.js";

const JSONC_FORMAT: FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
  eol: "\n",
};

export interface EnsureWorkerOptions {
  format: FormatOptions;
  /** Skip confirmation (`-y` / `--yes`). */
  yes?: boolean;
  /** Skip git submodule clone (config + bindings only). */
  skipClone?: boolean;
  /**
   * Config already loaded by the caller (deploy/dev/clone). When omitted,
   * the workspace `wrangler.jsonc` after CLI chdir is used — same file as
   * SecretsService.
   */
  config?: ConfigService;
}

/** Root wrangler.jsonc in the current workspace (after monorepo chdir). */
export function createWorkspaceConfigService(): ConfigService {
  return new ConfigService(join(process.cwd(), "wrangler.jsonc"));
}

function workspaceConfig(existing?: ConfigService): ConfigService {
  return existing ?? createWorkspaceConfigService();
}

export interface EnsureWorkerResult {
  name: string;
  alreadyEnabled: boolean;
  seeded: boolean;
  cloned: boolean;
  wired: boolean;
}

/**
 * Resolve a catalog name or throw a structured CLI error.
 * Planned stubs get a "not shippable yet" message; unknown names list the catalog.
 */
export function requireCatalogWorker(input: string): string {
  const canonical = resolveCatalogWorkerName(input);
  if (!canonical) {
    throw new CLIError(
      `Unknown worker "${input}".`,
      ExitCode.INVALID_USAGE,
      `Known workers: ${WORKER_CATALOG.map((w) => w.name).join(", ")}`,
      true,
      "Run `hoox workers catalog` to see core, optional, and planned isolates."
    );
  }
  if (isPlannedWorker(canonical)) {
    throw new CLIError(
      plannedWorkerMessage(canonical),
      ExitCode.INVALID_USAGE,
      undefined,
      true,
      "Use pyne-worker for edge evaluate, or pyne-agent-worker for NL → PYNE."
    );
  }
  return canonical;
}

/**
 * Ensure `name` is enabled in wrangler.jsonc, cloned, and wired into callers.
 *
 * No-op when the worker is already in config and enabled.
 * Interactive TTYs confirm; `--yes` proceeds; `--json` / non-TTY without `--yes`
 * throws with a hint to `hoox workers enable <name> --yes`.
 */
export async function ensureWorkerInStack(
  input: string,
  options: EnsureWorkerOptions
): Promise<EnsureWorkerResult> {
  const name = requireCatalogWorker(input);
  const manifest = WORKER_MANIFESTS[name]!;
  const fmt = options.format;

  const config = workspaceConfig(options.config);
  await config.load();
  const existing = config.getWorker(name);

  if (existing?.enabled) {
    let cloned = false;
    if (!options.skipClone) {
      cloned = await cloneWorkerIfMissing(name, manifest.path, fmt);
    }
    // Clone may have just landed wrangler.jsonc — wire callers that were skipped earlier.
    const wired = await wireCallerBindings(name, fmt, config);
    return {
      name,
      alreadyEnabled: true,
      seeded: false,
      cloned,
      wired,
    };
  }

  const tier = manifest.tier ?? "core";
  const label = manifest.description ?? name;
  const action = existing
    ? `Worker "${name}" is disabled.`
    : `Worker "${name}" is not in wrangler.jsonc (${tier}).`;
  const prompt = `${action} Enable it and wire it into this stack? (${label})`;

  const proceed = await confirmEnable(prompt, options);
  if (!proceed) {
    throw new CLIError(
      `Worker "${name}" is not enabled in this stack.`,
      ExitCode.INVALID_USAGE,
      undefined,
      true,
      `Enable and wire it: hoox workers enable ${name} --yes`
    );
  }

  const results = await config.setWorkersEnabled([name], true);
  const seeded = Boolean(results[0]?.seeded);

  if (!fmt.json && !fmt.quiet) {
    formatSuccess(
      seeded
        ? `Seeded and enabled ${name} in wrangler.jsonc`
        : `Enabled ${name} in wrangler.jsonc`,
      fmt
    );
  }

  let cloned = false;
  if (!options.skipClone) {
    cloned = await cloneWorkerIfMissing(name, manifest.path, fmt);
  }
  const wired = await wireCallerBindings(name, fmt, config);

  return {
    name,
    alreadyEnabled: false,
    seeded,
    cloned,
    wired,
  };
}

/**
 * Load a worker from wrangler.jsonc, enabling/wiring catalog satellites
 * when they are missing or disabled.
 */
export async function loadWorkerOrWire(
  config: ConfigService,
  input: string,
  options: EnsureWorkerOptions
): Promise<{ name: string; worker: WorkerConfig }> {
  const name = requireCatalogWorker(input);
  let worker = config.getWorker(name);
  // Ensure unless skipClone and already enabled (tests / callers that only
  // need config). When already enabled with skipClone false, ensure still
  // clones an empty tree and wires callers.
  const needsEnsure = !worker?.enabled || !options.skipClone;
  if (needsEnsure) {
    await ensureWorkerInStack(name, { ...options, config });
    await config.load();
    worker = config.getWorker(name);
  }
  if (!worker) {
    throw new CLIError(
      `Worker "${name}" could not be wired into wrangler.jsonc.`,
      ExitCode.ERROR,
      undefined,
      true,
      `Run \`hoox workers enable ${name} --yes\`.`
    );
  }
  return { name, worker };
}

async function confirmEnable(
  message: string,
  options: EnsureWorkerOptions
): Promise<boolean> {
  if (options.yes) return true;
  if (
    options.format.json ||
    options.format.quiet ||
    !isRichMode(options.format)
  ) {
    return false;
  }
  const confirmed = await p.confirm({ message, initialValue: true });
  if (p.isCancel(confirmed)) return false;
  return Boolean(confirmed);
}

/**
 * Add this worker as a service binding on each catalog `callers` target
 * that is already in the stack and has a wrangler.jsonc.
 */
export async function wireCallerBindings(
  workerName: string,
  fmt: FormatOptions,
  loadedConfig?: ConfigService
): Promise<boolean> {
  const manifest = WORKER_MANIFESTS[workerName];
  const callers = manifest?.callers ?? [];
  if (callers.length === 0) return false;

  const config = workspaceConfig(loadedConfig);
  await config.load();
  let wired = false;

  for (const caller of callers) {
    const callerCfg = config.getWorker(caller.worker);
    if (!callerCfg) continue;
    const wranglerPath = await resolveWritableWrangler(callerCfg.path);
    if (!wranglerPath) continue;
    const added = await addServiceBinding(
      wranglerPath,
      caller.binding,
      workerName
    );
    if (added) {
      wired = true;
      if (!fmt.json && !fmt.quiet) {
        formatSuccess(
          `Wired ${caller.worker}.${caller.binding} → ${workerName}`,
          fmt
        );
      }
    }
  }

  return wired;
}

/**
 * Prefer real `wrangler.jsonc`. If only the tracked `.example` exists,
 * materialize a local copy first — never mutate `*.example`.
 */
async function resolveWritableWrangler(
  workerPath: string
): Promise<string | null> {
  const abs = resolvePath(workerPath);
  const real = join(abs, "wrangler.jsonc");
  if (await Bun.file(real).exists()) return real;

  const example = join(abs, "wrangler.jsonc.example");
  if (!(await Bun.file(example).exists())) return null;

  await copyFile(example, real);
  return real;
}

async function addServiceBinding(
  wranglerPath: string,
  binding: string,
  service: string
): Promise<boolean> {
  const raw = await Bun.file(wranglerPath).text();
  const parsed = parseJsonc(raw) as {
    services?: Array<{ binding?: string; service?: string }>;
  } | null;
  if (!parsed || typeof parsed !== "object") return false;

  const services = Array.isArray(parsed.services) ? parsed.services : [];
  if (services.some((s) => s.binding === binding && s.service === service)) {
    return false;
  }

  let edits;
  if (!parsed.services) {
    edits = modify(raw, ["services"], [{ binding, service }], {
      formattingOptions: JSONC_FORMAT,
    });
  } else {
    edits = modify(
      raw,
      ["services", services.length],
      { binding, service },
      { formattingOptions: JSONC_FORMAT, isArrayInsertion: true }
    );
  }
  await Bun.write(wranglerPath, applyEdits(raw, edits));
  return true;
}

/**
 * Clone the worker repo as a git submodule when the directory is empty
 * or only has generated files (.dev.vars).
 */
export async function cloneWorkerIfMissing(
  name: string,
  workerPath: string,
  fmt: FormatOptions
): Promise<boolean> {
  const abs = resolvePath(workerPath);
  if (await isGitCheckout(abs)) return false;

  // Only auto-clone catalog paths inside this workspace. Temp dirs / absolute
  // paths outside the monorepo are left alone (tests, custom layouts).
  const root = process.cwd();
  if (abs !== root && !abs.startsWith(`${root}/`)) {
    return false;
  }

  const prepared = await prepareCloneTarget(abs);
  if (!prepared) return false;

  const repo = `https://github.com/hoox-sh/${WORKER_MANIFESTS[name]?.repo ?? name}.git`;
  // `-f` is required when `workers/*` is gitignored and the path is not yet
  // a registered submodule (optional satellites like pyne-agent-worker).
  const proc = Bun.spawn(["git", "submodule", "add", "-f", repo, workerPath], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const exit = await proc.exited;
  if (exit !== 0) {
    const stderr = await new Response(proc.stderr).text();
    // Directory already a submodule or path exists — not fatal for secrets.
    if (!fmt.json && !fmt.quiet && stderr.trim()) {
      formatSuccess(
        `Clone skipped for ${name}: ${stderr.trim().split("\n")[0]}`,
        fmt
      );
    }
    if (prepared.stashedDevVars) {
      await restoreStash(abs, prepared.stashedDevVars);
    }
    return false;
  }

  if (prepared.stashedDevVars) {
    await restoreStash(abs, prepared.stashedDevVars);
  }

  if (!fmt.json && !fmt.quiet) {
    formatSuccess(`Cloned ${name} → ${workerPath}`, fmt);
  }
  return true;
}

async function isGitCheckout(abs: string): Promise<boolean> {
  return Bun.file(join(abs, ".git")).exists();
}

const CLONE_IGNORABLE = new Set([
  ".dev.vars",
  ".dev.vars.example",
  ".wrangler",
  ".DS_Store",
]);

async function prepareCloneTarget(
  abs: string
): Promise<{ stashedDevVars: string | null } | null> {
  let entries: string[];
  try {
    entries = await readdir(abs);
  } catch {
    return { stashedDevVars: null };
  }

  if (entries.length === 0) {
    await rm(abs, { recursive: true, force: true });
    return { stashedDevVars: null };
  }

  if (!entries.every((e) => CLONE_IGNORABLE.has(e))) {
    // Source already present — treat as cloned.
    return null;
  }

  let stashedDevVars: string | null = null;
  const devVars = join(abs, ".dev.vars");
  if (await Bun.file(devVars).exists()) {
    // Stash outside the worker dir — we are about to rm it for submodule add.
    stashedDevVars = `${abs}.__hoox_devvars`;
    await rename(devVars, stashedDevVars);
  }
  await rm(abs, { recursive: true, force: true });
  return { stashedDevVars };
}

async function restoreStash(abs: string, stashPath: string): Promise<void> {
  try {
    await mkdir(abs, { recursive: true });
    await rename(stashPath, join(abs, ".dev.vars"));
  } catch {
    /* stash restore is best-effort */
  }
}
