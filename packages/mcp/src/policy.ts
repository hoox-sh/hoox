/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CatalogEntry, Risk } from "./types.ts";

/**
 * Commands that only read or print. Anything absent from this set and from
 * INTERACTIVE is treated as mutating. New CLI commands fail closed.
 */
const READ_ONLY = new Set<string>([
  "disclaimer",
  "doctor",
  "tunnel check",
  "completion",
  "schema validate",
  "schema list",
  "deploy history",
  "infra d1 list",
  "infra kv list",
  "infra r2 list",
  "infra queues list",
  "infra vectorize list",
  "infra analytics list",
  "config show",
  "config secrets list",
  "config env show",
  "config env validate",
  "config kv list",
  "config kv manifest",
  "config transport show",
  "config keys list",
  "secrets list",
  "keys list",
  "check setup",
  "check health",
  "check prerequisites",
  "logs worker",
  "logs all",
  "test all",
  "test unit",
  "test integration",
  "test worker",
  "waf status",
  "waf rules list",
  "db list",
  "monitor trades",
  "monitor logs",
  "monitor kill-switch show",
  "monitor queue-depth",
  "monitor analytics summary",
  "monitor analytics errors",
  "workers list",
  "workers catalog",
  "pyne",
  "pyne health",
  "pyne scripts",
  "pyne scripts list",
  "pyne scripts get",
  "pyne cron",
  "pyne cron jobs",
  "pyne feed",
  "trace events",
  "trace metrics",
  "trace keys",
  "trace values",
  "trace destinations",
  "trace destinations list",
  "trace usage",
  "perf fastpath report",
  "agent health",
  "repair check",
]);

/** Foreground TTY or streaming commands. The server refuses these. */
const INTERACTIVE = new Set<string>([
  "tui",
  "dev start",
  "dev worker",
  "dev dashboard",
  "dashboard dev",
  "workers dev",
  "workers logs",
]);

const LONG = new Set<string>([
  "test all",
  "test unit",
  "test integration",
  "test worker",
  "test live",
  "trace live",
  "logs worker",
  "logs all",
  "perf fastpath tail",
  "perf fastpath run",
]);

/** Does not talk to Cloudflare when used with its default flags. */
const LOCAL = new Set<string>([
  "disclaimer",
  "completion",
  "schema validate",
  "schema list",
  "schema generate",
  "config show",
  "config env show",
  "config env validate",
  "config keys list",
  "keys list",
  "repair check",
  "check prerequisites",
]);

const SECRET_STDIN = new Set<string>(["secrets set", "config secrets set"]);

/** Flags that turn a read into a write. Schema keys, not argv tokens. */
const ESCALATE_KEYS = [
  "fix",
  "fix_runtime",
  "install_deps",
  "provision",
  "allow_destructive",
] as const;

const REFUSAL: Record<string, string> = {
  tui: "The TUI needs a real terminal. Run `hoox tui` yourself.",
  "dev start":
    "Dev servers stay in the foreground. Run `hoox dev start` in a terminal.",
  "dev worker":
    "Dev servers stay in the foreground. Run `hoox dev worker <name>` in a terminal.",
  "dev dashboard":
    "The dashboard dev server stays in the foreground. Run `hoox dev dashboard` in a terminal.",
  "dashboard dev":
    "The dashboard dev server stays in the foreground. Run `hoox dashboard dev` in a terminal.",
  "workers dev":
    "This starts a dev server. Run `hoox workers dev <name>` in a terminal.",
  "workers logs":
    "This alias tails forever. Call hoox_logs_worker instead (it passes --no-follow).",
};

export const POLICY_TEXT = `Hoox MCP runs the hoox binary. It does not shell out through a string.

Read-only commands run immediately.
Mutating commands return a confirm token and do not run until the same arguments are sent again with that token. Tokens expire after 10 minutes and are bound to the argv, cwd, and a hash of any stdin payload (Pine script or secret). The secret and the script are not stored in the token.
Interactive servers (tui, dev, workers logs) are refused.
init and onboard are refused unless both token and account are set.
config env init is refused because it prompts for every variable.
deploy dashboard is refused unless rebuild is true.
deploy rollback is refused unless the version argument is set.
db reset adds --confirm after the token verifies. Pass the HMAC as confirm.
logs worker/all pass --no-follow unless follow is true, and a follow call is killed after 20s.
trace live defaults to --duration 20 when duration is omitted.
Secret values for secrets set go to stdin, are trimmed to one line, and are redacted from tool results. Newlines in secret_value are rejected.
Tool results redact JSON string values and .env lines whose names look like secrets.
Calls add --json and --no-color. They do not add --quiet, because that flag drops the JSON document.
Set HOOX_MCP_ALLOW_MUTATIONS=1 only on a trusted local process to skip the confirm token.
`;

export function toolNameFromPath(path: string): string {
  const raw =
    "hoox_" +
    path
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  return raw.slice(0, 64);
}

export function baseRisk(path: string): Risk {
  if (INTERACTIVE.has(path)) return "interactive";
  if (READ_ONLY.has(path)) return "read";
  return "mutate";
}

export function isLong(path: string): boolean {
  return LONG.has(path);
}

export function isDestructive(path: string): boolean {
  return (
    /(^| )(delete|reset|rollback|remove|disable|rebuild)( |$)/.test(path) ||
    path === "monitor kill-switch on" ||
    path === "monitor kill-switch off" ||
    path === "waf mode enable" ||
    path === "waf mode disable"
  );
}

export function isLocal(path: string): boolean {
  return LOCAL.has(path);
}

export function secretStdin(path: string): boolean {
  return SECRET_STDIN.has(path);
}

export function scriptStdin(path: string): boolean {
  return path === "pyne run";
}

export function safetyOf(path: string): CatalogEntry["safety"] {
  if (path === "logs worker" || path === "logs all") return "no-follow-logs";
  if (path === "trace live") return "trace-live-cap";
  return "none";
}

export function refusal(path: string): string {
  return (
    REFUSAL[path] ??
    "This command needs an interactive terminal and is refused over MCP."
  );
}

function readOpt(
  entry: CatalogEntry,
  values: Record<string, unknown>,
  flag: string,
  fallback: string
): unknown {
  const opt = entry.options.find((item) => item.flag === flag);
  return values[opt?.key ?? fallback];
}

function readArg(
  entry: CatalogEntry,
  values: Record<string, unknown>,
  name: string
): unknown {
  const arg = entry.args.find((item) => item.name === name);
  return values[arg?.key ?? name];
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

/**
 * Commands that call clack unless the non-interactive flags are present.
 * Returns a refusal message, or null when the call is safe to spawn.
 */
export function promptBlock(
  entry: CatalogEntry,
  values: Record<string, unknown>
): string | null {
  const path = entry.path;
  if (path === "init" || path === "onboard") {
    const ready =
      hasText(readOpt(entry, values, "--token", "token")) &&
      hasText(readOpt(entry, values, "--account", "account"));
    if (ready) return null;
    return `${path} prompts until both --token and --account are set. Pass token and account, or run \`hoox ${path}\` in a terminal.`;
  }
  if (path === "config env init") {
    return "config env init prompts for every variable. Run `hoox config env init` in a terminal.";
  }
  if (path === "deploy dashboard") {
    // `--no-rebuild` is not a flag. Only `--rebuild` skips promptRebuildDecision.
    if (readOpt(entry, values, "--rebuild", "rebuild") === true) return null;
    return "deploy dashboard prompts for a rebuild unless --rebuild is set. Pass rebuild: true, or run `hoox deploy dashboard --rebuild` in a terminal.";
  }
  if (path === "deploy rollback") {
    if (hasText(readArg(entry, values, "version"))) return null;
    return "deploy rollback prompts for a version unless the version argument is set. Pass version, or run `hoox deploy rollback <worker> <version>` in a terminal.";
  }
  return null;
}

export function classifyCall(
  entry: CatalogEntry,
  values: Record<string, unknown>
): { risk: Risk; long: boolean } {
  if (entry.risk === "interactive") {
    return { risk: "interactive", long: true };
  }
  const dry = values.dry_run === true;
  const escalate = ESCALATE_KEYS.some((key) => values[key] === true);
  let risk = entry.risk;
  if (escalate) risk = "mutate";
  else if (dry) risk = "read";
  let long = entry.long;
  if (
    (entry.path === "logs worker" || entry.path === "logs all") &&
    values.follow === true &&
    values.no_follow !== true
  ) {
    long = true;
  }
  return { risk, long };
}

export function resolveTimeoutMs(
  entry: CatalogEntry,
  values: Record<string, unknown>,
  long: boolean,
  risk: Risk
): number {
  const requested = values.timeout_ms;
  if (typeof requested === "number" && Number.isFinite(requested)) {
    return clampTimeout(requested);
  }
  const duration =
    typeof values.duration === "string"
      ? Number.parseInt(values.duration, 10)
      : Number.NaN;
  if (entry.path === "trace live") {
    const sec = Number.isFinite(duration) ? duration : 20;
    return clampTimeout(sec * 1000 + 10_000);
  }
  if (entry.path === "perf fastpath tail") {
    const sec = Number.isFinite(duration) ? duration : 60;
    return clampTimeout(sec * 1000 + 15_000);
  }
  if (entry.path === "logs worker" || entry.path === "logs all") {
    if (values.follow === true && values.no_follow !== true) return 20_000;
    return 30_000;
  }
  if (long && risk === "read") return 180_000;
  if (risk === "mutate") return 180_000;
  return 45_000;
}

function clampTimeout(value: number): number {
  return Math.min(300_000, Math.max(1_000, Math.floor(value)));
}

export function toolBlurb(entry: CatalogEntry): string {
  const summary = entry.summary.replace(/\s+/g, " ").slice(0, 180);
  let risk: string;
  if (entry.risk === "interactive") {
    risk = refusal(entry.path);
  } else if (entry.risk === "mutate") {
    risk =
      "Mutating: the first call returns confirm_token and does not run. Pass it as confirm to execute.";
  } else {
    risk = "Read-only: runs immediately.";
  }
  let extra = "";
  if (entry.safety === "no-follow-logs") {
    extra = " Passes --no-follow unless follow is true (then killed at 20s).";
  } else if (entry.safety === "trace-live-cap") {
    extra = " Defaults --duration to 20 when omitted.";
  }
  if (entry.secretStdin) {
    extra += " Requires secret_value, written to stdin.";
  }
  if (entry.path === "db reset") {
    extra += " Adds --confirm when the mutation runs.";
  } else if (entry.path === "init" || entry.path === "onboard") {
    extra += " Refused unless token and account are both set.";
  } else if (entry.path === "config env init") {
    extra += " Refused: it prompts for every variable.";
  } else if (entry.path === "deploy dashboard") {
    extra += " Refused unless rebuild is true.";
  } else if (entry.path === "deploy rollback") {
    extra += " Refused unless version is set.";
  }
  const text = `hoox ${entry.path} — ${summary}. ${risk}${extra} Adds --json --no-color.`;
  return text.slice(0, 700);
}
