/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Wire protocol between the MCP server (parent) and the sandbox harness (child).
 *
 * One JSON object per line, newline delimited, over the child's stdin/stdout.
 * The child's stderr is diagnostics only and never parsed.
 *
 * parent -> child, first line:
 *   { type: "job", mode, code, catalog, maxCalls }
 * child -> parent, zero or more:
 *   { type: "call", id, method, target, args }
 * parent -> child, one per call:
 *   { type: "reply", id, ok, json }   // json is a STRING, parsed inside the context
 * child -> parent, exactly one:
 *   { type: "done", json, calls, logs }
 *   { type: "error", message, stack }
 *
 * `json` is always a string, never a nested object. That is deliberate: the
 * harness only lets primitives and context-created objects cross into the vm
 * context, so a host object can never become a `constructor` bridge.
 */

export const DEFAULT_LIMITS: CodeModeLimits = {
  /** Wall clock for one sandbox process. The parent kills on expiry. */
  timeoutMs: 20_000,
  /** `hoox.*` calls one code string may make. */
  maxCalls: 50,
  /** Rejected before a process is spawned. */
  maxCodeChars: 20_000,
  /** Result JSON larger than this is truncated with a marker. */
  maxResultChars: 200_000,
};

export interface CodeModeLimits {
  timeoutMs: number;
  maxCalls: number;
  maxCodeChars: number;
  maxResultChars: number;
}

/** Which operations the sandbox may ask the parent to perform. */
export type SandboxMethod =
  "run" | "describe" | "advise" | "snapshot" | "policy";

/**
 * The capability surface the parent exposes to the child. The parent is the
 * policy enforcement point: it never trusts the child and re-validates every
 * request as if a model had typed it.
 */
export interface CodeModeHandlers {
  run(target: string, args: unknown): Promise<unknown>;
  describe(target: string): Promise<unknown>;
  advise(command: unknown, cwd: unknown): Promise<unknown>;
  snapshot(options: unknown): Promise<unknown>;
  policy(): Promise<unknown>;
}

export interface SandboxRequest {
  mode: "search" | "execute";
  /** Untrusted. Comes from a model that may have read attacker-controlled text. */
  code: string;
  /** Compact catalog injected into `search`. Omitted for `execute`. */
  catalog?: readonly unknown[];
  handlers?: CodeModeHandlers;
  limits?: Partial<CodeModeLimits>;
}

export type SandboxResult =
  | {
      ok: true;
      value: unknown;
      calls: number;
      logs: string[];
      durationMs: number;
      truncated: boolean;
    }
  | {
      ok: false;
      message: string;
      stderr: string;
      durationMs: number;
    };
