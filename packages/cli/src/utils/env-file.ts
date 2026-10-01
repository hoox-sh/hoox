/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared `.env` / `.dev.vars` file helpers.
 *
 * Values are written with {@link formatEnvValue}: bare when they only
 * contain shell/dotenv-safe characters, double-quoted (dotenv-compatible)
 * otherwise — so secrets containing spaces, `#`, quotes, or newlines
 * survive a write → parse round-trip instead of being corrupted.
 * Wrangler reads `.dev.vars` with dotenv semantics, which understands
 * double-quoted values and `\\`, `\"`, `\n`, `\r`, `\t` escapes.
 */

/** Characters that are safe to leave unquoted in dotenv files. */
const BARE_VALUE_RE = /^[A-Za-z0-9_@%+=:,./-]+$/;

/**
 * Format a value for a `KEY=value` line. Bare when safe, otherwise
 * double-quoted with dotenv-compatible escaping.
 */
export function formatEnvValue(value: string): string {
  if (value.length > 0 && BARE_VALUE_RE.test(value)) return value;
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/** Format a full `KEY=value` line. */
export function serializeEnvLine(key: string, value: string): string {
  return `${key}=${formatEnvValue(value)}`;
}

/**
 * Parse a `.env` / `.dev.vars` style file into a Map of KEY → VALUE.
 * Skips blank lines and comments (`#...`), tolerates an `export ` prefix,
 * and strips single/double quotes (unescaping `\"`, `\\`, `\n`, `\r`,
 * `\t` inside double quotes) so files written by {@link formatEnvValue}
 * round-trip exactly.
 */
export function parseEnvFile(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    let trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("export ")) trimmed = trimmed.slice(7).trimStart();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || /\s/.test(key)) continue;
    map.set(key, unquoteValue(trimmed.slice(eq + 1).trim()));
  }
  return map;
}

function unquoteValue(raw: string): string {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
    // Single-pass unescape so `\\` is consumed before `\"`/`\n`/etc.
    // (sequential replaces would corrupt a literal backslash before n/r/t).
    return raw.slice(1, -1).replace(/\\(\\|"|n|r|t)/g, (_, c: string) => {
      switch (c) {
        case "n":
          return "\n";
        case "r":
          return "\r";
        case "t":
          return "\t";
        default:
          return c;
      }
    });
  }
  if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1);
  }
  return raw;
}
