/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Interactive TUI loop for the Hoox CLI.
 *
 * When `hoox` is called with no arguments, this module takes over:
 * shows the ASCII banner, an interactive clack menu, dispatches to
 * the appropriate Commander action, and returns to the menu.
 */

import { Command } from "commander";
import {
  intro,
  outro,
  select,
  text,
  confirm,
  log,
  isCancel,
  cancel,
} from "@clack/prompts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { animateBanner, DISCLAIMER } from "./banner.js";
import { CLIError } from "../utils/errors.js";
import { formatError } from "../utils/formatters.js";
import { theme } from "../utils/theme.js";
import { isLongRunning } from "./catalog.js";
import {
  runOpenTuiLauncher,
  shouldLaunchStartScreen,
} from "./opentui-launch.js";

function recentsPath(): string {
  return join(homedir(), ".hoox", ".tui-state", "launcher-recent.json");
}

function readRecents(): string[] {
  try {
    const raw = readFileSync(recentsPath(), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, 8);
  } catch {
    return [];
  }
}

function pushRecent(commandStr: string): void {
  const next = [
    commandStr,
    ...readRecents().filter((x) => x !== commandStr),
  ].slice(0, 8);
  try {
    const path = recentsPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(next), "utf-8");
  } catch {
    /* ignore */
  }
}

function cliVersion(): string {
  try {
    const pkgPath = new URL("../../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version ?? "dev";
  } catch {
    return "dev";
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Run the interactive TUI loop.
 * - Shows the (animated when TTY) banner once
 * - Shows a category-selection menu
 * - Each category leads to sub-actions
 * - After each action, returns to the menu
 * - Exit or Ctrl+C to quit
 */
export async function runInteractiveTUI(program: Command): Promise<void> {
  if (shouldLaunchStartScreen()) {
    const usedOpenTui = await runOpenTuiLoop(program);
    if (usedOpenTui) return;
  }

  await runClackMenu(program);
}

/**
 * OpenCode-style OpenTUI home. Returns false when the TUI package is
 * missing so the Clack menu can take over.
 */
async function runOpenTuiLoop(program: Command): Promise<boolean> {
  const version = cliVersion();
  let launchedOnce = false;

  while (true) {
    const result = await runOpenTuiLauncher(program, {
      version,
      recents: readRecents(),
    });
    if (result === null) {
      return launchedOnce;
    }
    launchedOnce = true;
    if (result.action === "quit") return true;

    pushRecent(result.argv.join(" "));
    await runCommand(program, result.argv);
  }
}

async function runClackMenu(program: Command): Promise<void> {
  await animateBanner();
  process.stdout.write("\n");
  intro("hoox");

  while (true) {
    const category = await showMainMenu();
    if (category === "__exit") break;

    const result = await handleCategory(category, program);
    if (result === "exit") break;
  }

  process.stdout.write(
    theme.dim("─".repeat(50)) + "\n" + theme.muted(DISCLAIMER) + "\n"
  );
  outro("See you later!");
}

// ---------------------------------------------------------------------------
// Main menu
// ---------------------------------------------------------------------------

const MAIN_CATEGORIES = [
  {
    value: "setup",
    label: "⚡ Setup",
    hint: "onboard, init, setup, doctor",
  },
  { value: "deploy", label: "Deploy", hint: "workers, dashboard" },
  {
    value: "manage",
    label: "Manage",
    hint: "infrastructure, config, secrets, repair",
  },
  {
    value: "monitor",
    label: "Monitor",
    hint: "diagnostics, health, logs, tests",
  },
  {
    value: "tools",
    label: "Tools",
    hint: "TUI, clone, dashboard, WAF, agent, pyne",
  },
  { value: "develop", label: "Develop", hint: "dev server, start project" },
  { value: "__exit", label: "Exit" },
] as const;

async function showMainMenu(): Promise<string> {
  const choice = await select({
    message: "What would you like to do?",
    options: [...MAIN_CATEGORIES],
  });

  if (isCancel(choice)) {
    cancel("Operation cancelled.");
    return "__exit";
  }

  return choice;
}

// ---------------------------------------------------------------------------
// Category handlers
// ---------------------------------------------------------------------------

/**
 * Handle a selected category. Returns "back", "exit", or "continue".
 */
async function handleCategory(
  category: string,
  program: Command
): Promise<"back" | "exit" | "continue"> {
  switch (category) {
    case "setup":
      return showSetupMenu(program);
    case "deploy":
      return showDeployMenu(program);
    case "develop":
      return showDevelopMenu(program);
    case "manage":
      return showManageMenu(program);
    case "monitor":
      return showMonitorMenu(program);
    case "tools":
      return showToolsMenu(program);
    default:
      return "back";
  }
}

// ---------------------------------------------------------------------------
// Setup sub-menu
// ---------------------------------------------------------------------------

async function showSetupMenu(
  program: Command
): Promise<"back" | "exit" | "continue"> {
  while (true) {
    const choice = await select({
      message: "Setup",
      options: [
        {
          value: "onboard",
          label: "Onboard (recommended)",
          hint: "init + setup end-to-end",
        },
        {
          value: "init",
          label: "Init only",
          hint: "write wrangler.jsonc + collect secrets",
        },
        {
          value: "setup",
          label: "Setup only",
          hint: "keys, D1 schema, secrets, dashboard",
        },
        {
          value: "doctor",
          label: "Doctor",
          hint: "paths, TUI entry, security hygiene",
        },
        { value: "__back", label: "◀ Back to main menu" },
      ],
    });

    if (isCancel(choice)) return "back";
    if (choice === "__back") return "continue";

    await runCommand(program, [choice]);
  }
}

// ---------------------------------------------------------------------------
// Deploy sub-menu
// ---------------------------------------------------------------------------

async function showDeployMenu(
  program: Command
): Promise<"back" | "exit" | "continue"> {
  while (true) {
    const choice = await select({
      message: "Deploy",
      options: [
        { value: "all", label: "All workers + dashboard", hint: "recommended" },
        { value: "workers", label: "Workers only" },
        { value: "single", label: "Single worker..." },
        { value: "dashboard", label: "Dashboard only" },
        { value: "__back", label: "◀ Back to main menu" },
      ],
    });

    if (isCancel(choice)) return "back";
    if (choice === "__back") return "continue";

    if (choice === "single") {
      const name = await text({
        message: "Which worker?",
        placeholder: "e.g. hoox, trade-worker, d1-worker",
        validate: (v) =>
          v === undefined || v.length === 0
            ? "Worker name is required"
            : undefined,
      });
      if (isCancel(name)) continue;
      if (!name) continue;
      await runCommand(program, ["deploy", "worker", name]);
    } else {
      const argv = choice === "all" ? ["deploy", "all"] : ["deploy", choice];
      await runCommand(program, argv);
    }
  }
}

// ---------------------------------------------------------------------------
// Develop sub-menu
// ---------------------------------------------------------------------------

/** Static menu IDs → argv. User-entered values are appended, never split. */
const DEVELOP_ARGV: Record<string, readonly string[]> = {
  "dev start": ["dev", "start"],
};

async function showDevelopMenu(
  program: Command
): Promise<"back" | "exit" | "continue"> {
  while (true) {
    const choice = await select({
      message: "Develop",
      options: [
        {
          value: "dev start",
          label: "Start dev server",
          hint: "runs all workers locally",
        },
        { value: "__back", label: "◀ Back to main menu" },
      ],
    });

    if (isCancel(choice)) return "back";
    if (choice === "__back") return "continue";

    await runCommand(program, DEVELOP_ARGV[choice] ?? [choice]);
  }
}

// ---------------------------------------------------------------------------
// Manage sub-menu
// ---------------------------------------------------------------------------

async function showManageMenu(
  program: Command
): Promise<"back" | "exit" | "continue"> {
  while (true) {
    const choice = await select({
      message: "Manage",
      options: [
        {
          value: "infra provision",
          label: "Infrastructure",
          hint: "provision D1, R2, KV, Queues",
        },
        {
          value: "config",
          label: "Configuration",
          hint: "show / set wrangler.jsonc",
        },
        { value: "secrets", label: "Secrets", hint: "list, set, sync" },
        { value: "keys", label: "Auth keys", hint: "generate, list" },
        {
          value: "repair check",
          label: "Repair check",
          hint: "diagnose workers / infra / secrets",
        },
        {
          value: "db list",
          label: "Database",
          hint: "list tables (use CLI for apply/migrate)",
        },
        { value: "__back", label: "◀ Back to main menu" },
      ],
    });

    if (isCancel(choice)) return "back";
    if (choice === "__back") return "continue";

    switch (choice) {
      case "infra provision":
        await runCommand(program, ["infra", "provision"]);
        break;
      case "config":
        await showConfigSubMenu(program);
        break;
      case "secrets":
        await showSecretsSubMenu(program);
        break;
      case "keys":
        await showKeysSubMenu(program);
        break;
      case "repair check":
        await runCommand(program, ["repair", "check"]);
        break;
      case "db list":
        await runCommand(program, ["db", "list"]);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Config sub-sub-menu
// ---------------------------------------------------------------------------

async function showConfigSubMenu(program: Command): Promise<void> {
  const choice = await select({
    message: "Configuration",
    options: [
      { value: "show", label: "Show config", hint: "display wrangler.jsonc" },
      { value: "set", label: "Set a value..." },
      { value: "__back", label: "◀ Back to Manage" },
    ],
  });

  if (isCancel(choice) || choice === "__back") return;

  if (choice === "set") {
    const key = await text({
      message: "Config key (dot-separated path)",
      placeholder: "e.g. global.cloudflare_account_id",
      validate: (v) =>
        v === undefined || v.length === 0 ? "Key is required" : undefined,
    });
    if (isCancel(key) || !key) return;

    const value = await text({
      message: `Value for "${key}"`,
      placeholder: "enter value",
    });
    if (isCancel(value) || value === undefined) return;

    await runCommand(program, ["config", "set", key, value ?? ""]);
  } else {
    await runCommand(program, ["config", "show"]);
  }
}

// ---------------------------------------------------------------------------
// Secrets sub-sub-menu
// ---------------------------------------------------------------------------

async function showSecretsSubMenu(program: Command): Promise<void> {
  const choice = await select({
    message: "Secrets",
    options: [
      { value: "list", label: "List secrets" },
      { value: "set", label: "Set a secret..." },
      { value: "sync", label: "Sync to Cloudflare" },
      { value: "__back", label: "◀ Back to Manage" },
    ],
  });

  if (isCancel(choice) || choice === "__back") return;

  switch (choice) {
    case "list":
      await runCommand(program, ["secrets", "list"]);
      break;
    case "set": {
      const worker = await text({
        message: "Worker name",
        placeholder: "e.g. hoox, trade-worker",
        validate: (v) =>
          v === undefined || v.length === 0
            ? "Worker name is required"
            : undefined,
      });
      if (isCancel(worker) || !worker) return;

      const secretName = await text({
        message: "Secret name",
        placeholder: "e.g. API_KEY, DATABASE_URL",
        validate: (v) =>
          v === undefined || v.length === 0
            ? "Secret name is required"
            : undefined,
      });
      if (isCancel(secretName) || !secretName) return;

      await runCommand(program, ["secrets", "set", worker, secretName]);
      break;
    }
    case "sync":
      await runCommand(program, ["secrets", "sync", "--system"]);
      break;
  }
}

// ---------------------------------------------------------------------------
// Keys sub-sub-menu
// ---------------------------------------------------------------------------

async function showKeysSubMenu(program: Command): Promise<void> {
  const choice = await select({
    message: "Auth Keys",
    options: [
      { value: "generate", label: "Generate new keys" },
      { value: "list", label: "List existing keys" },
      { value: "__back", label: "◀ Back to Manage" },
    ],
  });

  if (isCancel(choice) || choice === "__back") return;

  if (choice === "generate") {
    const proceed = await confirm({
      message:
        "Generate new internal auth keys? This will create .keys/*.env files.",
      initialValue: false,
    });
    if (isCancel(proceed) || !proceed) return;
  }

  await runCommand(program, ["keys", choice]);
}

// ---------------------------------------------------------------------------
// Monitor sub-menu
// ---------------------------------------------------------------------------

/** Static menu IDs → argv. User-entered values are appended, never split. */
const MONITOR_ARGV: Record<string, readonly string[]> = {
  "check setup": ["check", "setup"],
  "check health": ["check", "health"],
  "check fix": ["check", "fix"],
  test: ["test"],
};

async function showMonitorMenu(
  program: Command
): Promise<"back" | "exit" | "continue"> {
  while (true) {
    const choice = await select({
      message: "Monitor",
      options: [
        {
          value: "check setup",
          label: "Run diagnostics",
          hint: "full system validation",
        },
        {
          value: "check health",
          label: "Health check",
          hint: "worker connectivity",
        },
        { value: "check fix", label: "Auto-repair", hint: "fix common issues" },
        { value: "__logs", label: "View logs", hint: "real-time log tailing" },
        { value: "test", label: "Run tests" },
        { value: "__back", label: "◀ Back to main menu" },
      ],
    });

    if (isCancel(choice)) return "back";
    if (choice === "__back") return "continue";

    if (choice === "__logs") {
      const target = await select({
        message: "Tail logs for",
        options: [
          { value: "all", label: "All workers" },
          { value: "single", label: "A specific worker..." },
          { value: "__back", label: "◀ Back" },
        ],
      });
      if (isCancel(target) || target === "__back") continue;
      if (target === "single") {
        const name = await text({
          message: "Worker name",
          placeholder: "e.g. hoox, trade-worker, d1-worker",
        });
        if (isCancel(name) || !name) continue;
        await runCommand(program, ["logs", "worker", name]);
      } else {
        await runCommand(program, ["logs", "all"]);
      }
      continue;
    }

    await runCommand(program, MONITOR_ARGV[choice] ?? [choice]);
  }
}

// ---------------------------------------------------------------------------
// Tools sub-menu
// ---------------------------------------------------------------------------

/** Static menu IDs → argv. User-entered values are appended, never split. */
const TOOLS_ARGV: Record<string, readonly string[]> = {
  tui: ["tui"],
  clone: ["clone"],
  "dashboard deploy": ["dashboard", "deploy"],
  "dashboard dev": ["dashboard", "dev"],
  "waf status": ["waf", "status"],
  "agent health": ["agent", "health"],
  "pyne health": ["pyne", "health"],
  "pyne sync-vendor": ["pyne", "sync-vendor"],
  "pyne deploy": ["pyne", "deploy"],
};

async function showToolsMenu(
  program: Command
): Promise<"back" | "exit" | "continue"> {
  while (true) {
    const choice = await select({
      message: "Tools",
      options: [
        {
          value: "tui",
          label: "Launch TUI Dashboard",
          hint: "blocks until exit",
        },
        {
          value: "clone",
          label: "Clone worker",
          hint: "git submodule checkout",
        },
        {
          value: "dashboard deploy",
          label: "Deploy dashboard",
          hint: "build & deploy web dashboard",
        },
        {
          value: "dashboard dev",
          label: "Dashboard dev server",
          hint: "blocks until exit",
        },
        {
          value: "waf status",
          label: "WAF status",
          hint: "current mode and rules summary",
        },
        {
          value: "agent health",
          label: "Agent health",
          hint: "AI provider key check",
        },
        {
          value: "pyne health",
          label: "PYNE health",
          hint: "pyne-worker GET /health",
        },
        {
          value: "pyne sync-vendor",
          label: "PYNE sync-vendor",
          hint: "vendor pynescript for deploy",
        },
        {
          value: "pyne deploy",
          label: "PYNE deploy",
          hint: "sync-vendor + wrangler deploy",
        },
        { value: "__back", label: "◀ Back to main menu" },
      ],
    });

    if (isCancel(choice)) return "back";
    if (choice === "__back") return "continue";

    await runCommand(program, TOOLS_ARGV[choice] ?? [choice]);
  }
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

/**
 * Run a Commander command inside the TUI loop.
 *
 * Takes an argv array so prompt values are never re-tokenized: a worker or
 * config value containing spaces stays exactly one argument. Delegates to
 * `program.parseAsync()`.
 * Wraps in try-catch so errors don't terminate the loop.
 * Long-running commands (dev, tui, logs) require confirmation so the
 * menu does not appear "hung".
 */
async function runCommand(
  program: Command,
  argv: readonly string[]
): Promise<void> {
  const commandStr = argv.join(" ");
  if (isLongRunning(commandStr)) {
    const proceed = await confirm({
      message: `"${commandStr}" runs until you stop it. Leave the menu?`,
      initialValue: true,
    });
    if (isCancel(proceed) || !proceed) {
      log.info("Cancelled.");
      return;
    }
  }

  try {
    // from: "user" means Commander expects raw user arguments only —
    // NOT [node, script, ...args] format. So just pass the args directly.
    await program.parseAsync([...argv], {
      from: "user",
    });
  } catch (err) {
    // Check if it's a Commander informational exit (help/version)
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "commander.helpDisplayed"
    ) {
      return;
    }

    if (err instanceof CLIError) {
      formatError(err, { inCard: false });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      formatError(new CLIError(message, undefined, undefined, true), {
        inCard: false,
      });
    }

    // A menu command is one step in an interactive session. Its failure has
    // been formatted and reported; leaving process.exitCode set would poison
    // the session's final exit status and suppress later completion footers.
    process.exitCode = 0;
  }
}
