/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** How a command is allowed to run through MCP. */
export type Risk = "read" | "mutate" | "interactive";

/** Extra argv shaping for commands whose CLI defaults are unsafe over stdio. */
export type Safety = "none" | "no-follow-logs" | "trace-live-cap";

export interface CatalogArg {
  /** Flat tool argument name. */
  key: string;
  /** Commander argument name. */
  name: string;
  required: boolean;
  variadic: boolean;
  description: string;
  choices?: string[];
}

export interface CatalogOpt {
  key: string;
  /** Argv token, for example `--env`. */
  flag: string;
  description: string;
  kind: "boolean" | "string" | "string[]";
  /** Commander `mandatory`: the flag itself must be present. */
  required: boolean;
  choices?: string[];
}

export interface CatalogEntry {
  /** Space-joined path, for example `monitor kill-switch show`. */
  path: string;
  toolName: string;
  summary: string;
  description: string;
  aliases: string[];
  /** False for group nodes that only have subcommands. */
  action: boolean;
  args: CatalogArg[];
  options: CatalogOpt[];
  risk: Risk;
  long: boolean;
  destructive: boolean;
  /** Safe to describe as not calling the network. */
  local: boolean;
  /** `secrets set` reads the value from stdin. */
  secretStdin: boolean;
  /** `pyne run -` reads the script from stdin. */
  scriptStdin: boolean;
  safety: Safety;
}

export interface Suggestion {
  command: string;
  reason: string;
}

export interface ToolPayload {
  status: "ok" | "error" | "confirmation_required" | "refused" | "planned";
  command: string;
  risk: Risk;
  long: boolean;
  /** Display argv. Secret flag values are already redacted. */
  argv: string[];
  cwd: string | null;
  exit_code: number | null;
  duration_ms: number | null;
  timed_out: boolean;
  stdout: string;
  stderr: string;
  json: unknown;
  truncated: boolean;
  redactions: number;
  confirm_token: string | null;
  expires_at: string | null;
  suggestion: Suggestion | null;
  message: string | null;
}

/** Minimal Commander surface the catalog walker needs. */
export interface CmdLike {
  name(): string;
  description(): string;
  summary(): string;
  aliases(): string[];
  commands: readonly CmdLike[];
  options: readonly OptLike[];
  registeredArguments: readonly ArgLike[];
}

export interface OptLike {
  flags: string;
  description: string;
  long?: string;
  short?: string;
  required: boolean;
  optional: boolean;
  variadic: boolean;
  mandatory: boolean;
  hidden: boolean;
  defaultValue?: unknown;
  argChoices?: string[];
}

export interface ArgLike {
  description: string;
  required: boolean;
  variadic: boolean;
  argChoices?: string[];
  name(): string;
}
