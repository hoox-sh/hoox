/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Custom Commander.js help formatter.
 *
 * Root help is a grouped catalog of one-line summaries (never a dump of
 * nested EXAMPLES / SUBCOMMANDS). Per-command help keeps usage, options,
 * child summaries, and examples.
 */

import { Command, type HelpContext } from "commander";
import { theme, stripAnsi } from "./theme.js";
import { isRichMode } from "./format-mode.js";
import {
  commandBlurb,
  COMMAND_GROUPS,
  firstLine,
  groupTitle,
  splitHelpBody,
} from "../ui/catalog.js";

const COL = 14;

/**
 * Render the help text for a Commander command.
 *
 * @param cmd    - The command being asked for help.
 * @param helper - Commander Help instance (unused; we walk the Command tree).
 */
export function renderHelp(
  cmd: Command,
  helper: (this: Command, context?: HelpContext) => string
): string {
  void helper;

  const isRoot = !cmd.parent;
  const out = isRoot ? renderRootHelp(cmd) : renderCommandHelp(cmd);
  return isRichMode() ? out : stripAnsi(out);
}

function renderRootHelp(cmd: Command): string {
  const blocks: string[] = [];
  const version = versionOf(cmd);

  blocks.push("");
  blocks.push(
    ` ${theme.warning("◆")} ${theme.heading("Hoox")}` +
      (version
        ? `  ${theme.textFaint("·")}  ${theme.highlight(`v${version}`)}`
        : "")
  );
  blocks.push(` ${theme.textMuted("Cloudflare Workers Platform")}`);
  blocks.push("");
  blocks.push(headerLine("Usage"));
  blocks.push(`   ${theme.accent(buildUsage(cmd))}`);

  const grouped = groupTopLevel(cmd);
  for (const group of grouped) {
    blocks.push("");
    blocks.push(headerLine(group.title));
    const nameWidth = Math.max(8, ...group.items.map((s) => s.name.length));
    for (const item of group.items) {
      const padded = item.name.padEnd(nameWidth);
      blocks.push(`   ${theme.text(padded)}  ${theme.textMuted(item.blurb)}`);
    }
  }

  const options = visibleOptions(cmd);
  if (options.length > 0) {
    blocks.push("");
    blocks.push(headerLine("Options"));
    const flagWidth = Math.max(...options.map((o) => o.flags.length));
    for (const o of options) {
      const padded = o.flags.padEnd(flagWidth);
      const desc = o.description ? theme.textMuted(o.description) : "";
      blocks.push(`   ${theme.text(padded)}  ${desc}`);
    }
  }

  blocks.push("");
  blocks.push(
    ` ${theme.textFaint("Run")} ${theme.accent("hoox <command> --help")} ${theme.textFaint("for flags and examples.")}`
  );
  blocks.push(
    ` ${theme.textFaint("Run")} ${theme.accent("hoox")} ${theme.textFaint("with no arguments for the interactive launcher.")}`
  );
  blocks.push("");
  return blocks.join("\n") + "\n";
}

function renderCommandHelp(cmd: Command): string {
  const blocks: string[] = [];
  const argNames = formatArgs(cmd);
  const titleName = argNames ? `${cmd.name()} ${argNames}` : cmd.name();
  blocks.push("");
  blocks.push(theme.heading(` ${titleName}`));

  const rawDesc = cmd.description() ?? "";
  const { body, examples: embeddedExamples } = splitHelpBody(rawDesc);
  const blurb = commandBlurb(cmd);
  if (blurb) {
    blocks.push(` ${theme.textMuted(blurb)}`);
  }

  if (body && body !== blurb) {
    const rest = body.startsWith(blurb)
      ? body.slice(blurb.length).trim()
      : body;
    if (rest && rest !== blurb) {
      blocks.push("");
      for (const line of rest.split("\n")) {
        blocks.push(` ${theme.textMuted(line)}`);
      }
    }
  }

  blocks.push(theme.textFaint("─".repeat(60)));

  blocks.push(headerLine("Usage"));
  blocks.push(`   ${theme.accent(buildUsage(cmd))}`);

  const options = visibleOptions(cmd);
  if (options.length > 0) {
    blocks.push("");
    blocks.push(headerLine("Options"));
    const flagWidth = Math.max(...options.map((o) => o.flags.length));
    for (const o of options) {
      const padded = o.flags.padEnd(flagWidth);
      const desc = o.description ? theme.textMuted(o.description) : "";
      blocks.push(`   ${theme.text(padded)}  ${desc}`);
    }
  }

  const children = visibleCommands(cmd);
  if (children.length > 0) {
    blocks.push("");
    blocks.push(headerLine("Commands"));
    const nameWidth = Math.max(...children.map((s) => s.name.length), COL);
    for (const child of children) {
      const padded = child.name.padEnd(nameWidth);
      blocks.push(`   ${theme.text(padded)}  ${theme.textMuted(child.blurb)}`);
    }
  }

  const afterText = captureHelpEvent(cmd, "afterHelp").trim();
  const examples = formatExamples(afterText || embeddedExamples);
  if (examples.length > 0) {
    blocks.push("");
    blocks.push(headerLine("Examples"));
    for (const line of examples) {
      blocks.push(`   ${theme.textMuted(line)}`);
    }
  }

  return blocks.join("\n") + "\n";
}

function headerLine(text: string): string {
  return ` ${theme.textSubtle(text.toUpperCase())}`;
}

function visibleCommands(cmd: Command): Array<{ name: string; blurb: string }> {
  return cmd.commands
    .filter((c) => !(c as unknown as { _hidden?: boolean })._hidden)
    .map((c) => ({ name: c.name(), blurb: commandBlurb(c) }));
}

function visibleOptions(
  cmd: Command
): Array<{ flags: string; description: string }> {
  return cmd.options
    .filter((o) => !o.hidden)
    .map((o) => ({ flags: o.flags, description: o.description ?? "" }));
}

function groupTopLevel(cmd: Command): Array<{
  id: string;
  title: string;
  items: Array<{ name: string; blurb: string }>;
}> {
  const items = visibleCommands(cmd);
  const byName = new Map(items.map((item) => [item.name, item]));
  const used = new Set<string>();

  const result: Array<{
    id: string;
    title: string;
    items: Array<{ name: string; blurb: string }>;
  }> = [];

  for (const group of COMMAND_GROUPS) {
    const grouped: Array<{ name: string; blurb: string }> = [];
    for (const name of group.commands) {
      const item = byName.get(name);
      if (!item) continue;
      grouped.push(item);
      used.add(name);
    }
    if (grouped.length === 0) continue;
    result.push({ id: group.id, title: group.title, items: grouped });
  }

  const other = items.filter((item) => !used.has(item.name));
  if (other.length > 0) {
    result.push({ id: "other", title: groupTitle("other"), items: other });
  }
  return result;
}

function formatArgs(cmd: Command): string {
  return cmd.registeredArguments
    .map((a) => {
      const n = a.name();
      const inner = a.variadic ? `${n}...` : n;
      return a.required ? `<${inner}>` : `[${inner}]`;
    })
    .join(" ");
}

/** Build a usage line like "hoox deploy all [options]". */
export function buildUsage(cmd: Command): string {
  const parts: string[] = [];
  let c: Command | null = cmd;
  while (c && c.name()) {
    parts.unshift(c.name());
    c = c.parent;
  }
  const args = formatArgs(cmd);
  if (args) parts.push(args);
  const hasChildren = cmd.commands.some(
    (child) => !(child as unknown as { _hidden?: boolean })._hidden
  );
  if (hasChildren) parts.push("[command]");
  parts.push("[options]");
  return parts.join(" ");
}

function versionOf(cmd: Command): string {
  try {
    const raw =
      typeof cmd.version === "function" ? String(cmd.version() ?? "") : "";
    return firstLine(raw).replace(/^v/i, "");
  } catch {
    return "";
  }
}

function formatExamples(text: string): string[] {
  if (!text.trim()) return [];
  const lines = text
    .replace(/^\s*Examples?:\s*/i, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\$\s*/, "").replace(/\s+$/, ""))
    .filter((line) => line.trim().length > 0);
  const indents = lines.map((line) => (line.match(/^(\s*)/)?.[1] ?? "").length);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(minIndent));
}

/**
 * Capture text emitted by a help event on a Command.
 *
 * Commander v15 stores `addHelpText` content as event listeners on
 * `beforeHelp` / `afterHelp`.
 */
function captureHelpEvent(cmd: Command, eventName: string): string {
  const parts: string[] = [];
  const context = {
    error: false,
    command: cmd,
    write: (str: string) => {
      parts.push(str);
    },
  };
  const emitter = cmd as unknown as {
    emit: (event: string, payload: unknown) => boolean;
  };
  emitter.emit(eventName, context);
  return parts.join("");
}
