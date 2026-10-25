/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { hashSecret } from "./confirm.ts";
import type { CatalogEntry } from "./types.ts";

export type BuiltArgv =
  | { ok: true; argv: string[]; stdin: string | null; secretHash: string }
  | { ok: false; message: string };

/**
 * Build a hoox argv array. Never uses a shell.
 * Does not append `--yes`; the runner adds that only for a confirmed mutation.
 */
export function buildArgv(
  entry: CatalogEntry,
  values: Record<string, unknown>
): BuiltArgv {
  const argv = entry.path.split(" ");

  for (const arg of entry.args) {
    const raw = values[arg.key];
    if (raw === undefined || raw === "") {
      if (arg.required) {
        return { ok: false, message: `Missing required argument ${arg.name}` };
      }
      continue;
    }
    if (arg.variadic) {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
        return {
          ok: false,
          message: `${arg.name} must be an array of strings`,
        };
      }
      if (arg.required && raw.length === 0) {
        return { ok: false, message: `Missing required argument ${arg.name}` };
      }
      if (raw.length > 50) {
        return { ok: false, message: `${arg.name} has too many values` };
      }
      for (const item of raw) {
        const problem = unsafeToken(item, arg.name, true);
        if (problem) return { ok: false, message: problem };
        argv.push(item);
      }
      continue;
    }
    if (typeof raw !== "string") {
      return { ok: false, message: `${arg.name} must be a string` };
    }
    const problem = unsafeToken(raw, arg.name, true);
    if (problem) return { ok: false, message: problem };
    argv.push(raw);
  }

  const handled = new Set<string>();
  if (entry.safety === "no-follow-logs") {
    handled.add("follow");
    handled.add("no_follow");
    if (values.follow === true && values.no_follow !== true) {
      argv.push("--follow");
    } else {
      argv.push("--no-follow");
    }
  }
  if (entry.safety === "trace-live-cap") {
    handled.add("duration");
    const duration =
      typeof values.duration === "string" && values.duration.length > 0
        ? values.duration
        : "20";
    const problem = unsafeToken(duration, "duration", false);
    if (problem) return { ok: false, message: problem };
    argv.push("--duration", duration);
  }

  for (const opt of entry.options) {
    if (handled.has(opt.key)) continue;
    const raw = values[opt.key];
    if (raw === undefined) continue;
    if (opt.kind === "boolean") {
      if (raw === true) argv.push(opt.flag);
      else if (raw !== false) {
        return { ok: false, message: `${opt.flag} must be a boolean` };
      }
      continue;
    }
    if (opt.kind === "string[]") {
      if (!Array.isArray(raw)) {
        return {
          ok: false,
          message: `${opt.flag} must be an array of strings`,
        };
      }
      for (const item of raw) {
        if (typeof item !== "string") {
          return { ok: false, message: `${opt.flag} values must be strings` };
        }
        const problem = unsafeToken(item, opt.flag, false);
        if (problem) return { ok: false, message: problem };
        argv.push(opt.flag, item);
      }
      continue;
    }
    if (typeof raw !== "string") {
      return { ok: false, message: `${opt.flag} must be a string` };
    }
    if (opt.required && raw.length === 0) {
      return { ok: false, message: `${opt.flag} needs a value` };
    }
    const problem = unsafeToken(raw, opt.flag, false);
    if (problem) return { ok: false, message: problem };
    argv.push(opt.flag, raw);
  }

  let stdin: string | null = null;
  if (entry.scriptStdin) {
    const dash = entry.args.some((arg) => values[arg.key] === "-");
    const body = values.script_body;
    if (dash) {
      if (typeof body !== "string" || body.length === 0) {
        return {
          ok: false,
          message: "script_body is required when script-path is -",
        };
      }
      if (body.length > 200_000) {
        return { ok: false, message: "script_body is too large" };
      }
      stdin = body.endsWith("\n") ? body : `${body}\n`;
    } else if (body !== undefined) {
      return {
        ok: false,
        message: "script_body is only used when script-path is -",
      };
    }
  }

  if (entry.secretStdin) {
    const secret = values.secret_value;
    if (typeof secret !== "string" || secret.length === 0) {
      return {
        ok: false,
        message:
          "secret_value is required. It is written to stdin and kept out of argv.",
      };
    }
    if (secret.length > 8000) {
      return { ok: false, message: "secret_value is too large" };
    }
    // readLine() keeps one trimmed line. A newline would be stored truncated.
    if (secret.includes("\0") || /[\r\n]/.test(secret)) {
      return {
        ok: false,
        message: "secret_value contains a newline or NUL",
      };
    }
    const trimmed = secret.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        message:
          "secret_value is required. It is written to stdin and kept out of argv.",
      };
    }
    stdin = `${trimmed}\n`;
  }

  // Hash the exact stdin bytes (script or secret), not a pre-normalized copy.
  const secretHash = hashSecret(stdin ?? undefined);
  // `--quiet` returns before the JSON envelope in formatSuccess / formatTable.
  argv.push("--json", "--no-color");
  return { ok: true, argv, stdin, secretHash };
}

function unsafeToken(
  value: string,
  label: string,
  positional: boolean
): string | null {
  if (value.length > 8000) return `${label} is too long`;
  if (value.includes("\0") || value.includes("\n") || value.includes("\r")) {
    return `${label} contains a newline or NUL`;
  }
  if (positional && value.startsWith("-") && value !== "-") {
    return `${label} must not look like a flag`;
  }
  return null;
}
