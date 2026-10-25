/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  baseRisk,
  isDestructive,
  isLocal,
  isLong,
  safetyOf,
  scriptStdin,
  secretStdin,
  toolNameFromPath,
} from "./policy.ts";
import type {
  ArgLike,
  CatalogArg,
  CatalogEntry,
  CatalogOpt,
  CmdLike,
  OptLike,
} from "./types.ts";

const SKIP_FLAGS = new Set([
  "--help",
  "--version",
  "--json",
  "--quiet",
  "--no-color",
  "--color",
  "--yes",
]);

const CONTROL_KEYS = new Set([
  "cwd",
  "timeout_ms",
  "confirm",
  "secret_value",
  "script_body",
]);

export function walkCatalog(program: CmdLike): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  const usedNames = new Set<string>();
  walk(program, "", entries, usedNames);
  return entries;
}

export function findEntry(
  catalog: readonly CatalogEntry[],
  command: string
): CatalogEntry | undefined {
  const query = command.trim();
  return catalog.find(
    (entry) =>
      entry.path === query ||
      entry.toolName === query ||
      entry.aliases.includes(query)
  );
}

function walk(
  cmd: CmdLike,
  prefix: string,
  out: CatalogEntry[],
  usedNames: Set<string>
): void {
  for (const child of cmd.commands) {
    const name = child.name();
    if (!name || name === "help") continue;
    const hidden = (child as { _hidden?: boolean })._hidden === true;
    if (hidden) continue;
    const path = prefix ? `${prefix} ${name}` : name;
    const action =
      typeof (child as { _actionHandler?: unknown })._actionHandler ===
      "function";
    out.push(toEntry(child, path, action, usedNames));
    walk(child, path, out, usedNames);
  }
}

function toEntry(
  cmd: CmdLike,
  path: string,
  action: boolean,
  usedNames: Set<string>
): CatalogEntry {
  const usedKeys = new Set<string>(CONTROL_KEYS);
  const args = cmd.registeredArguments.map((arg) => toArg(arg, usedKeys));
  const options = cmd.options
    .map((opt) => toOpt(opt, usedKeys))
    .filter((opt): opt is CatalogOpt => opt !== null)
    // HMAC `confirm` owns that name. The CLI flag is injected after verify.
    .filter((opt) => !(path === "db reset" && opt.flag === "--confirm"));
  const summary = firstLine(cmd.summary() || cmd.description() || path);
  const description = (cmd.description() || summary).slice(0, 4000);
  let aliases: string[];
  try {
    aliases = cmd.aliases();
  } catch {
    aliases = [];
  }
  return {
    path,
    toolName: uniqueToolName(path, usedNames),
    summary,
    description,
    aliases,
    action,
    args,
    options,
    risk: baseRisk(path),
    long: isLong(path),
    destructive: isDestructive(path),
    local: isLocal(path),
    secretStdin: secretStdin(path),
    scriptStdin: scriptStdin(path),
    safety: safetyOf(path),
  };
}

function toArg(arg: ArgLike, used: Set<string>): CatalogArg {
  const choices = arg.argChoices ? [...arg.argChoices] : undefined;
  return {
    key: alloc(used, arg.name().replace(/-/g, "_")),
    name: arg.name(),
    required: arg.required,
    variadic: arg.variadic,
    description: arg.description || `positional <${arg.name()}>`,
    ...(choices && choices.length > 0 ? { choices } : {}),
  };
}

function toOpt(opt: OptLike, used: Set<string>): CatalogOpt | null {
  if (opt.hidden) return null;
  const flag = longFlag(opt);
  if (!flag || SKIP_FLAGS.has(flag)) return null;
  const choices = opt.argChoices ? [...opt.argChoices] : undefined;
  let description = opt.description || flag;
  if (isPrintableDefault(opt.defaultValue)) {
    description += ` Default: ${JSON.stringify(opt.defaultValue)}.`;
  }
  return {
    key: alloc(used, flag.replace(/^--/, "").replace(/-/g, "_")),
    flag,
    description,
    kind: optionKind(opt),
    required: opt.mandatory,
    ...(choices && choices.length > 0 ? { choices } : {}),
  };
}

function optionKind(opt: OptLike): CatalogOpt["kind"] {
  if (opt.variadic) return "string[]";
  // `required` here means the flag's value is required, not the flag itself.
  if (opt.required || opt.optional) return "string";
  return "boolean";
}

function longFlag(opt: OptLike): string | null {
  if (opt.long) return opt.long;
  const match = opt.flags.match(/--[^\s,]+/);
  if (match) return match[0];
  if (opt.short) return opt.short;
  return null;
}

function alloc(used: Set<string>, base: string): string {
  const cleaned =
    base.replace(/[^A-Za-z0-9_]/g, "_").replace(/^_+/, "") || "arg";
  let key = cleaned;
  let n = 2;
  while (used.has(key)) {
    key = `${cleaned}_${n}`;
    n += 1;
  }
  used.add(key);
  return key;
}

function uniqueToolName(path: string, used: Set<string>): string {
  const base = toolNameFromPath(path);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  let next = `${base}_${n}`.slice(0, 64);
  while (used.has(next)) {
    n += 1;
    next = `${base}_${n}`.slice(0, 64);
  }
  used.add(next);
  return next;
}

function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() || text.trim();
}

function isPrintableDefault(value: unknown): boolean {
  if (value === undefined) return false;
  const kind = typeof value;
  return kind === "string" || kind === "number" || kind === "boolean";
}
