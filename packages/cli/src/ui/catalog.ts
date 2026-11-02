/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CLI command catalog — grouping, one-line blurbs, and the launcher payload.
 *
 * Used by:
 *   - the help formatter (grouped `hoox --help`)
 *   - the OpenTUI start screen (serialized over HOOX_LAUNCHER_CATALOG)
 *   - the Clack fallback menu
 */

import type { Command } from "commander";

/** Help / launcher group. Order is display order. */
export const COMMAND_GROUPS = [
  {
    id: "setup",
    title: "Setup",
    commands: ["onboard", "init", "setup", "doctor"],
  },
  {
    id: "ship",
    title: "Ship",
    commands: ["deploy", "clone", "update"],
  },
  {
    id: "develop",
    title: "Develop",
    commands: ["dev", "test"],
  },
  {
    id: "operate",
    title: "Operate",
    commands: ["tui", "dashboard", "workers", "monitor"],
  },
  {
    id: "config",
    title: "Config",
    commands: ["config", "secrets", "keys", "infra", "db", "schema", "waf"],
  },
  {
    id: "observe",
    title: "Observe",
    commands: ["logs", "check", "trace", "perf", "repair"],
  },
  {
    id: "tools",
    title: "Tools",
    commands: ["agent", "pyne", "tunnel", "completion", "disclaimer"],
  },
] as const;

export type CommandGroupId = (typeof COMMAND_GROUPS)[number]["id"];

const GROUP_BY_COMMAND = new Map<string, CommandGroupId>();
for (const group of COMMAND_GROUPS) {
  for (const name of group.commands) {
    GROUP_BY_COMMAND.set(name, group.id);
  }
}

/** Commands that take over the TTY until the user stops them. */
export const LONG_RUNNING_COMMANDS = new Set([
  "tui",
  "dev start",
  "dashboard dev",
  "logs",
  "logs all",
]);

export function isLongRunning(commandStr: string): boolean {
  const normalized = commandStr.trim();
  if (LONG_RUNNING_COMMANDS.has(normalized)) return true;
  return /^(logs|workers logs|workers dev|dev worker)\b/.test(normalized);
}

/** First non-empty line of a block of text. */
export function firstLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}

/**
 * One-line listing text for a Commander command.
 * Prefers `.summary()`, else the first line of `.description()`.
 */
export function commandBlurb(cmd: Command): string {
  const summary =
    typeof cmd.summary === "function" ? String(cmd.summary() ?? "") : "";
  if (summary.trim()) return firstLine(summary);
  return firstLine(cmd.description() ?? "");
}

/** Split a long description so EXAMPLES/SUBCOMMANDS do not pollute listings. */
export function splitHelpBody(description: string): {
  body: string;
  examples: string;
} {
  const raw = description.replace(/\r\n/g, "\n");
  const examplesMatch = raw.match(/\nEXAMPLES:\s*\n/i);
  const subMatch = raw.match(/\nSUBCOMMANDS:\s*\n/i);

  let cut = raw.length;
  if (examplesMatch?.index !== undefined) {
    cut = Math.min(cut, examplesMatch.index);
  }
  if (subMatch?.index !== undefined) {
    cut = Math.min(cut, subMatch.index);
  }

  const body = raw.slice(0, cut).trim();
  const examples =
    examplesMatch?.index !== undefined
      ? raw
          .slice(examplesMatch.index + examplesMatch[0].length)
          .replace(/\nOPTIONS:\s*\n[\s\S]*$/i, "")
          .replace(/\nSUBCOMMANDS:\s*\n[\s\S]*$/i, "")
          .replace(/\s+$/, "")
      : "";

  return { body, examples };
}

export interface LauncherItem {
  id: string;
  argv: string[];
  label: string;
  hint: string;
  group: string;
  keywords: string[];
  recommended?: boolean;
  longRunning?: boolean;
}

export interface LauncherGroup {
  id: string;
  title: string;
}

export interface LauncherCatalog {
  version: string;
  cwd: string;
  groups: LauncherGroup[];
  items: LauncherItem[];
  recents: string[];
}

/** Extra recommended shortcuts that are not just the top-level command name. */
const RECOMMENDED_SHORTCUTS: ReadonlyArray<{
  id: string;
  argv: string[];
  label: string;
  hint: string;
  group: CommandGroupId;
  keywords?: string[];
}> = [
  {
    id: "tui",
    argv: ["tui"],
    label: "Operations center",
    hint: "full-screen OpenTUI dashboard",
    group: "operate",
    keywords: ["tui", "dashboard", "ops"],
  },
  {
    id: "onboard",
    argv: ["onboard"],
    label: "Onboard",
    hint: "init + setup end-to-end",
    group: "setup",
    keywords: ["bootstrap", "quickstart", "wizard"],
  },
  {
    id: "doctor",
    argv: ["doctor"],
    label: "Doctor",
    hint: "runtime, TUI paths, security",
    group: "setup",
    keywords: ["diagnose", "health"],
  },
  {
    id: "deploy-all",
    argv: ["deploy", "all"],
    label: "Deploy all",
    hint: "workers + dashboard",
    group: "ship",
    keywords: ["ship", "release"],
  },
  {
    id: "dev-start",
    argv: ["dev", "start"],
    label: "Dev start",
    hint: "run workers locally",
    group: "develop",
    keywords: ["local", "wrangler"],
  },
  {
    id: "check-setup",
    argv: ["check", "setup"],
    label: "Check setup",
    hint: "full system validation",
    group: "observe",
    keywords: ["diagnostics", "validate"],
  },
];

function hiddenCommand(cmd: Command): boolean {
  return Boolean((cmd as unknown as { _hidden?: boolean })._hidden);
}

function groupForName(name: string): CommandGroupId | "other" {
  return GROUP_BY_COMMAND.get(name) ?? "other";
}

/**
 * Build the launcher catalog from a live Commander program.
 * Top-level commands plus a handful of recommended shortcuts.
 */
export function buildLauncherCatalog(
  program: Command,
  opts: { version: string; cwd: string; recents?: string[] }
): LauncherCatalog {
  const groups: LauncherGroup[] = COMMAND_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
  }));
  if (
    program.commands.some(
      (c) => !hiddenCommand(c) && groupForName(c.name()) === "other"
    )
  ) {
    groups.push({ id: "other", title: "Other" });
  }

  const items: LauncherItem[] = [];
  const seen = new Set<string>();

  for (const shortcut of RECOMMENDED_SHORTCUTS) {
    const id = shortcut.argv.join(" ");
    seen.add(id);
    items.push({
      id: shortcut.id,
      argv: [...shortcut.argv],
      label: shortcut.label,
      hint: shortcut.hint,
      group: shortcut.group,
      keywords: shortcut.keywords ?? [],
      recommended: true,
      longRunning: isLongRunning(id),
    });
  }

  for (const cmd of program.commands) {
    if (hiddenCommand(cmd)) continue;
    const name = cmd.name();
    const id = name;
    if (seen.has(id)) {
      // Recommended shortcut already covers this top-level command.
      // Keep the richer label; still ensure the blurb is available as hint
      // if the shortcut hint is generic.
      continue;
    }
    seen.add(id);
    items.push({
      id,
      argv: [name],
      label: name,
      hint: commandBlurb(cmd),
      group: groupForName(name),
      keywords: cmd.aliases(),
      recommended: false,
      longRunning: isLongRunning(id),
    });
  }

  return {
    version: opts.version,
    cwd: opts.cwd,
    groups,
    items,
    recents: opts.recents ?? [],
  };
}

export function groupTitle(id: string): string {
  const found = COMMAND_GROUPS.find((g) => g.id === id);
  if (found) return found.title;
  return "Other";
}

/** Map a top-level command name to its help-section group. */
export function groupIdForCommand(name: string): string {
  return groupForName(name);
}
