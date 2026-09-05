#!/usr/bin/env bun
/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Hoox CLI — main entry point.
 * Built with commander.js. Commands are registered via dedicated register* functions.
 * Global options --json and --quiet are available to all commands via program.opts().
 */

// Runtime guard: the CLI is a Bun bundle. If it somehow runs under Node
// (e.g. a user symlinked the bin or ran `node bin/hoox.js`), surface a
// clear, actionable error instead of a cryptic "Bun is not defined" crash.
if (typeof Bun === "undefined") {
  process.stderr.write(
    "Error: the Hoox CLI requires Bun >= 1.2 to run.\n" +
      "  Install Bun:  curl -fsSL https://bun.sh/install | bash\n" +
      "  Put ~/.bun/bin on PATH, then: bun add -g @hoox-sh/hoox-cli\n" +
      "  (npm install -g aborts on workspace:* in optionalDependencies.)\n"
  );
  process.exit(1);
}

import { readFileSync } from "node:fs";
import { Command } from "commander";
import { toError } from "@hoox-sh/hoox-shared";
import { COPYRIGHT } from "@hoox-sh/hoox-shared/legal";
import { WIZARD_STATE_PATH } from "@hoox-sh/hoox-shared";
import { CLIError, ExitCode } from "./utils/errors.js";
import { formatError, formatCompletion } from "./utils/formatters.js";
import { suggestForCommand } from "./utils/error-handler.js";
import { theme } from "./utils/theme.js";
import { renderHelp } from "./utils/help-formatter.js";
import { suggestNextCommand, getCmdPath } from "./utils/completion.js";
import { registerInitCommand } from "./commands/init/index.js";
import { registerOnboardCommand } from "./commands/onboard/index.js";
import { register as registerDevCommandGroup } from "./commands/dev/index.js";
import { register as registerDeployCommandGroup } from "./commands/deploy/index.js";
import { registerInfraCommand } from "./commands/infra/index.js";
import { registerConfigCommand } from "./commands/config/index.js";
import { registerSecretsCommand } from "./commands/secrets/index.js";
import { registerKeysCommand } from "./commands/keys/index.js";
import { registerCheckCommand } from "./commands/check/index.js";
import { registerLogsCommand } from "./commands/logs/index.js";
import { registerTestCommand } from "./commands/test/index.js";
import { registerWafCommand } from "./commands/waf/index.js";
import { registerCloneCommand } from "./commands/clone/index.js";
import { registerDashboardCommand } from "./commands/dashboard/index.js";
import { registerDbCommand } from "./commands/db/index.js";
import { registerMonitorCommand } from "./commands/monitor/index.js";
import { registerWorkersCommand } from "./commands/workers/index.js";
import { registerRepairCommand } from "./commands/repair/index.js";
import { registerUpdateCommand } from "./commands/update/index.js";
import { registerSchemaCommand } from "./commands/schema/index.js";
import { registerTUICommand } from "./commands/tui/index.js";
import { registerDoctorCommand } from "./commands/doctor/index.js";
import { registerTunnelCommand } from "./commands/tunnel/index.js";
import { registerDisclaimerCommand } from "./commands/disclaimer/index.js";
import { registerAgentCommand } from "./commands/agent/index.js";
import { registerPyneCommand } from "./commands/pyne/index.js";
import { registerSetupCommand } from "./commands/setup/index.js";
import { registerTraceCommand } from "./commands/trace/index.js";
import { registerPerfCommand } from "./commands/perf/index.js";
import { registerCompletionCommand } from "./commands/completion/index.js";
import { runInteractiveTUI } from "./ui/index.js";
import { ensureWorkspaceContext } from "./services/workspace/index.js";

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

// Load version from package.json at module init time (synchronous to support
// Commander's .version() call, which runs during program initialization)
const pkgVersion: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;

const program = new Command();

program
  .name("hoox")
  .description(
    "Hoox CLI — manage Cloudflare Workers, infrastructure, secrets, and deployments"
  )
  .version(`${pkgVersion}\n\n${COPYRIGHT}`)
  .addHelpText(
    "beforeAll",
    theme.heading("\nHoox CLI — Cloudflare Workers Platform\n")
  )
  .configureHelp({
    // Cast the helper param: renderHelp accepts the standard
    // helpInformation signature but Commander types it as Help class.
    formatHelp: (cmd, helper) => renderHelp(cmd, helper as never),
    styleTitle: (str: string) => theme.heading(str),
    styleCommandText: (str: string) => theme.bold(str),
    styleOptionText: (str: string) => str,
    styleDescriptionText: (str: string) => theme.dim(str),
  })
  // Suppress Commander's default one-line error for paths we reformat in
  // exitOverride (unknown command/option/missing args). Keeps a single card.
  .configureOutput({
    outputError: (str, write) => {
      if (
        /^error: unknown command/i.test(str) ||
        /^error: unknown option/i.test(str) ||
        /^error: missing required argument/i.test(str) ||
        /^error: required option/i.test(str) ||
        // Commander may append its own "(Did you mean …?)" line
        /^\(Did you mean /i.test(str)
      ) {
        return;
      }
      write(str);
    },
  });

// Global options — accessible by all commands via program.opts()
program.option("--json", "Output in JSON format");
program.option("--quiet", "Minimal output");
program.option("--no-color", "Disable color output");
program.option("-y, --yes", "Skip confirmation prompts");

// ---------------------------------------------------------------------------
// Completion hooks — stamp start time + print footer on success
// ---------------------------------------------------------------------------

// Start-time per command. WeakMap lets us attach state to Commander
// instances without mutating their public type or casting on every read.
const commandStartedAt = new WeakMap<Command, number>();

program.hook("preAction", (thisCmd) => {
  commandStartedAt.set(thisCmd, Date.now());
});

// Quiet wrangler version check before commands (no spam when already current).
// Does NOT auto-install by default — set HOOX_AUTO_UPDATE_WRANGLER=1 to enable.
// Skipped in tests / when HOOX_SKIP_WRANGLER_UPDATE=1 / when --json (avoid stdout noise).
program.hook("preAction", async () => {
  if (process.env.HOOX_SKIP_WRANGLER_UPDATE === "1") return;
  if (process.env.NODE_ENV === "test" || process.env.BUN_TEST === "1") return;
  if (process.argv.includes("--json")) return;
  try {
    const { UpdateService } = await import("./services/update/index.js");
    const service = new UpdateService();
    const autoUpdate = process.env.HOOX_AUTO_UPDATE_WRANGLER === "1";
    await service.checkAndPromptUpdate({
      yes: autoUpdate,
      silent: true,
    });
  } catch {
    // Ignore update errors — don't block the actual command
  }
});

program.hook("postAction", (thisCmd) => {
  // postAction does not fire if the action threw, but be defensive
  // about callers that set process.exitCode explicitly.
  if (process.exitCode && process.exitCode !== 0) return;
  const startedAt = commandStartedAt.get(thisCmd);
  if (startedAt === undefined) return; // preAction didn't run — skip
  const durationMs = Date.now() - startedAt;
  const path = getCmdPath(thisCmd);
  const suggestion = suggestNextCommand(path);
  const g = program.opts();
  formatCompletion("Done", {
    durationMs,
    suggestion,
    json: Boolean(g.json),
    quiet: Boolean(g.quiet),
    noColor: g.color === false || Boolean(process.env.NO_COLOR),
  });
});

// ---------------------------------------------------------------------------
// Error handling — map CommanderError and CLIError to proper exit codes
//
// We only set `process.exitCode` here. The single `process.exit()` call
// lives in `main()` at the end of the run, so test runners can intercept
// via Commander's `exitOverride` and other handlers can read `exitCode`.
// ---------------------------------------------------------------------------

program.exitOverride((err) => {
  // Global --json / --quiet flags must be honored on the error path too,
  // so scripting users get machine-parseable JSON instead of a human card.
  // Commander stores --no-color as color:false (not noColor:true).
  const globalOpts = program.opts();
  const errFmtOpts = {
    json: Boolean(globalOpts.json),
    quiet: Boolean(globalOpts.quiet),
    noColor: globalOpts.color === false || Boolean(process.env.NO_COLOR),
  };

  // Commander's own informational exits — success
  if (
    err.code === "commander.helpDisplayed" ||
    err.code === "commander.version"
  ) {
    process.exitCode = ExitCode.SUCCESS;
    // Must throw: if the callback returns, Commander falls through to
    // process.exit(originalExitCode) which is often 1 even for help.
    throw err;
  }

  // Help text already displayed (e.g. parent command without subcommand).
  // Do NOT treat missingArgument as success — scripts need a non-zero exit.
  if (
    (err.message === "(outputHelp)" || err.message?.includes("outputHelp")) &&
    err.code !== "commander.missingArgument"
  ) {
    process.exitCode = ExitCode.SUCCESS;
    throw err;
  }

  // Unknown command: try to suggest a close match.
  // Commander already wrote a one-line message via outputError; we replace
  // that with a structured card + suggestion, then rethrow so _exit does
  // not call process.exit(1).
  if (err.code === "commander.unknownCommand") {
    const match = err.message.match(/'([^']+)'/);
    const badArg = match?.[1] ?? "";
    const suggestion = suggestForCommand(program, badArg);
    // Strip Commander's embedded "(Did you mean …?)" — we render our own card.
    const cleanMsg = err.message
      .replace(/\n?\(Did you mean[^)]*\)\s*/gi, "")
      .trim();
    formatError(
      new CLIError(cleanMsg, ExitCode.INVALID_USAGE, undefined, false),
      suggestion ? { ...errFmtOpts, suggestions: [suggestion] } : errFmtOpts
    );
    process.exitCode = ExitCode.INVALID_USAGE;
    throw err;
  }

  if (err.code === "commander.unknownOption") {
    formatError(
      new CLIError(err.message, ExitCode.INVALID_USAGE, undefined, false),
      errFmtOpts
    );
    process.exitCode = ExitCode.INVALID_USAGE;
    throw err;
  }

  if (
    err.code === "commander.missingArgument" ||
    err.code === "commander.missingMandatoryOptionValue"
  ) {
    formatError(
      new CLIError(err.message, ExitCode.INVALID_USAGE, undefined, false),
      errFmtOpts
    );
    process.exitCode = ExitCode.INVALID_USAGE;
    throw err;
  }

  if (err instanceof CLIError) {
    formatError(err, errFmtOpts);
    process.exitCode = (err as CLIError).code;
    throw err;
  }

  // Generic fallback
  formatError(
    new CLIError(err.message, ExitCode.ERROR, undefined, false),
    errFmtOpts
  );
  process.exitCode = ExitCode.ERROR;
  throw err;
});

// ---------------------------------------------------------------------------
// Global process error handlers
//
// Note: we set `process.exitCode` here too. The single `process.exit()`
// at the end of `main()` is the only place we actually terminate.
// ---------------------------------------------------------------------------

process.on("uncaughtException", (err) => {
  // Do not clobber a more specific exit code set by exitOverride / handlers.
  if (process.exitCode !== undefined && process.exitCode !== 0) return;
  formatError(
    err instanceof CLIError
      ? err
      : new CLIError(
          `Uncaught exception: ${err.message}`,
          ExitCode.ERROR,
          err.stack,
          false
        )
  );
  process.exitCode = ExitCode.ERROR;
});

process.on("unhandledRejection", (reason) => {
  // Commander exitOverride rethrows after setting exitCode — main() catches
  // that path. If something still escapes, preserve non-zero exit codes.
  if (process.exitCode !== undefined && process.exitCode !== 0) return;
  const err =
    reason instanceof Error
      ? reason
      : new Error(`Unhandled rejection: ${toError(reason)}`);

  formatError(new CLIError(err.message, ExitCode.ERROR, err.stack, false));
  process.exitCode = ExitCode.ERROR;
});

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

registerInitCommand(program);
registerOnboardCommand(program);
registerDevCommandGroup(program);
registerDeployCommandGroup(program);
registerInfraCommand(program);
registerConfigCommand(program);
registerSecretsCommand(program);
registerKeysCommand(program);
registerCheckCommand(program);
registerLogsCommand(program);
registerTestCommand(program);
registerWafCommand(program);
registerCloneCommand(program);
registerDashboardCommand(program);
registerDbCommand(program);
registerMonitorCommand(program);
registerWorkersCommand(program);
registerRepairCommand(program);
registerSchemaCommand(program);
registerUpdateCommand(program);
registerTUICommand(program);
registerDoctorCommand(program);
registerTunnelCommand(program);
registerDisclaimerCommand(program);
registerAgentCommand(program);
registerPyneCommand(program);
registerSetupCommand(program);
registerTraceCommand(program);
registerPerfCommand(program);
registerCompletionCommand(program);

// ---------------------------------------------------------------------------
// Main entry — exported so bin/hoox.js can invoke it explicitly
// (import.meta.main is false when loaded as a dependency)
// ---------------------------------------------------------------------------

/**
 * Main CLI entry point.
 * Parses args or launches the interactive TUI if no args are given.
 */
export async function main(): Promise<void> {
  try {
    // Detect monorepo (cwd / remembered / global), remember path, chdir so
    // `hx` works from ~/Videos etc. after the monorepo was discovered once.
    ensureWorkspaceContext();

    const hasArgs = process.argv.slice(2).length > 0;

    if (hasArgs) {
      await program.parseAsync(process.argv);
    } else {
      // Auto-launch the setup wizard if not yet initialized
      const configFile = Bun.file("wrangler.jsonc");
      const hasConfig = await configFile.exists();
      const wizardStateFile = Bun.file(WIZARD_STATE_PATH);
      // Empty leftover state file must not trigger --resume
      const hasWizardState =
        (await wizardStateFile.exists()) &&
        (await wizardStateFile.text()).trim().length > 0;

      if (!hasConfig) {
        // No wrangler.jsonc → project is uninitialized → auto-run the
        // recommended one-shot bootstrap. This chains init (config) + setup
        // (infrastructure) so the user gets a fully operational system.
        // For finer control, run 'hoox init' and 'hoox setup' separately.
        // Only auto-onboard when we are already inside a monorepo root
        // (markers present) — otherwise user needs clone/doctor first.
        const args = hasWizardState ? ["onboard", "--resume"] : ["onboard"];
        await program.parseAsync(args, { from: "user" });
        return;
      }

      // Clean up stale wizard state if project is already initialized
      if (await wizardStateFile.exists()) {
        try {
          const { unlinkSync } = await import("node:fs");
          unlinkSync(WIZARD_STATE_PATH);
        } catch {
          await Bun.write(WIZARD_STATE_PATH, "");
        }
      }

      // Interactive TUI mode — launches when hoox is called with no arguments
      await runInteractiveTUI(program);
    }
  } catch (err) {
    // Commander exitOverride formats the error, sets process.exitCode
    // (including 0 for help/version), then rethrows so Commander's _exit
    // does not call process.exit(1). Preserve any code already set —
    // including SUCCESS (0) — and only default unexpected throws to ERROR.
    if (process.exitCode === undefined) {
      const message =
        err instanceof Error ? err.message : `Unhandled error: ${String(err)}`;
      const isCommander =
        err instanceof Error &&
        "code" in err &&
        typeof (err as { code?: string }).code === "string" &&
        String((err as { code: string }).code).startsWith("commander.");
      if (!isCommander) {
        formatError(new CLIError(message, ExitCode.ERROR, undefined, false));
      }
      process.exitCode = ExitCode.ERROR;
    }
  } finally {
    // Single, final exit point. We read exitCode (which every other
    // handler in the file sets) and terminate cleanly. Test runners
    // and importers that mock `process.exit` will skip this.
    if (typeof process.exit === "function" && process.exitCode !== undefined) {
      process.exit(process.exitCode);
    }
  }
}

if (import.meta.main) {
  await main();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { program };
export { CLIError, ExitCode } from "./utils/errors.js";
export {
  formatSuccess,
  formatError,
  formatTable,
  formatJson,
  formatKeyValue,
} from "./utils/formatters.js";
export type { FormatOptions } from "./utils/formatters.js";
export { theme, icons } from "./utils/theme.js";

// Exported services — usable by other packages / code
export { SetupService } from "./services/setup/index.js";
export type {
  GeneratedKeys,
  SetupOptions,
  SetupResult,
  SetupStepResult,
  SecretResult,
  ProgressEvent,
  ProgressCallback,
} from "./services/setup/index.js";
