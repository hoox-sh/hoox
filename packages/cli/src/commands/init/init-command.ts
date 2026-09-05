/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `hoox init` — interactive setup wizard for Hoox Workspace.
 *
 * Uses the shared WizardEngine from @hoox-sh/hoox-shared.
 *
 * Interactive flow uses @clack/prompts for the UI layer.
 * Non-interactive mode (--token, --account, --secret-store, --prefix):
 *   Skips all prompts and writes config with base workers only.
 */

import * as p from "@clack/prompts";
import { Command } from "commander";
import * as fs from "node:fs";
import {
  WizardEngine,
  serializeState,
  deserializeState,
  WIZARD_STATE_PATH,
} from "@hoox-sh/hoox-shared";
import type { WorkersJsonConfig } from "@hoox-sh/hoox-shared";
import { CloudflareService } from "../../services/cloudflare/index.js";
import {
  getFormatOptions,
  formatSuccess,
  formatError,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import { theme } from "../../utils/theme.js";
import { CLIProvisioner } from "./cli-provisioner.js";
import { SetupService } from "../../services/setup/index.js";
import type { InitOptions } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify the current working directory is the root of a cloned Hoox repo.
 *
 * `hoox init` / `hoox onboard` write `wrangler.jsonc` and per-worker
 * `.dev.vars` into the current directory (and its `workers/*` subdirs).
 * If run from the wrong folder (e.g. a home dir, an empty temp dir, or a
 * non-Hoox project) they would silently scatter files and then fail later
 * with confusing "Worker not found in wrangler.jsonc" / auth errors.
 *
 * Required: `packages/cli/package.json` (monorepo workspace marker).
 *
 * Also require at least one of these Hoox-repo signals (because
 * `wrangler.jsonc` is gitignored and created BY init/onboard, so a fresh
 * clone will not have it yet):
 *   - `wrangler.jsonc.example`
 *   - `wrangler.jsonc`
 *   - `workers/` directory
 *   - `.gitmodules`
 *
 * @throws CLIError (INVALID_USAGE) with an actionable hint when not in
 *         a Hoox repo root.
 */
export async function verifyRepoRoot(): Promise<void> {
  const cliPackage = Bun.file("packages/cli/package.json");
  const wranglerExample = Bun.file("wrangler.jsonc.example");
  const wranglerConfig = Bun.file("wrangler.jsonc");
  const gitmodules = Bun.file(".gitmodules");

  const [
    cliPackageExists,
    wranglerExampleExists,
    wranglerConfigExists,
    gitmodulesExists,
  ] = await Promise.all([
    cliPackage.exists(),
    wranglerExample.exists(),
    wranglerConfig.exists(),
    gitmodules.exists(),
  ]);

  const workersDirExists = fs.existsSync("workers");
  const hasRepoSignal =
    wranglerExampleExists ||
    wranglerConfigExists ||
    workersDirExists ||
    gitmodulesExists;

  if (cliPackageExists && hasRepoSignal) return;

  const reasons: string[] = [];
  if (!cliPackageExists) {
    reasons.push(
      "no `packages/cli` workspace found (this is not the hoox monorepo)"
    );
  }
  if (cliPackageExists && !hasRepoSignal) {
    reasons.push(
      "missing Hoox repo markers (expected one of: `wrangler.jsonc.example`, `wrangler.jsonc`, `workers/`, or `.gitmodules`)"
    );
  }

  const cloneHint =
    "  Clone first: git clone --recursive " +
    "https://github.com/hoox-sh/hoox.git";
  throw new CLIError(
    "Not inside a Hoox repository root.\n  " +
      reasons.join("\n  ") +
      "\n  Run `hoox init` / `hoox onboard` from the root of your cloned " +
      "hoox monorepo.\n  " +
      cloneHint,
    ExitCode.INVALID_USAGE
  );
}

async function getExistingAccountId(): Promise<string | undefined> {
  try {
    const file = Bun.file("wrangler.jsonc");
    if (!(await file.exists())) return undefined;
    const raw = await file.text();
    const match = raw.match(/"cloudflare_account_id"\s*:\s*"([^"]+)"/);
    return match ? match[1] : undefined;
  } catch {
    return undefined;
  }
}

async function validateApiToken(
  cf: CloudflareService,
  token: string
): Promise<string | undefined> {
  const prev = process.env.CLOUDFLARE_API_TOKEN;
  process.env.CLOUDFLARE_API_TOKEN = token;
  try {
    const result = await cf.whoami();
    if (result.ok) return undefined;
    return `Authentication failed: ${result.error}`;
  } finally {
    if (prev) {
      process.env.CLOUDFLARE_API_TOKEN = prev;
    } else {
      delete process.env.CLOUDFLARE_API_TOKEN;
    }
  }
}

async function writeWorkersJsonc(
  config: WorkersJsonConfig,
  opts?: { json?: boolean; quiet?: boolean }
): Promise<void> {
  const { format, applyEdits } = await import("jsonc-parser");

  const raw = JSON.stringify(config, null, 2);
  const formattingOpts = {
    insertSpaces: true,
    tabSize: 2,
    eol: "\n",
  };
  const edits = format(raw, undefined, formattingOpts);
  const formatted = applyEdits(raw, edits);

  const header =
    "// Hoox Workspace Configuration\n" +
    "// Generated by `hoox init`. Edit manually or re-run the wizard.\n" +
    "// Secrets are referenced by name — actual values are stored in Cloudflare.\n" +
    "// Do not put CLOUDFLARE_API_TOKEN in this file. Use the env var or `wrangler login`.\n\n";

  await Bun.write("wrangler.jsonc", header + formatted);

  if (!opts?.quiet) {
    formatSuccess("wrangler.jsonc written", opts);
  }

  // Fresh clones only ship wrangler.jsonc.example per worker (the real
  // file is gitignored). Deploy / OpenNext fail until those exist.
  const setup = new SetupService();
  setup.materializeWranglerConfigs();
}

async function createDevVars(
  config: WorkersJsonConfig,
  secrets: Record<string, Record<string, string>>,
  opts?: { json?: boolean; quiet?: boolean }
): Promise<void> {
  for (const [workerName, worker] of Object.entries(config.workers)) {
    const lines: string[] = [];
    lines.push(`# .dev.vars — local secrets for ${workerName}`);
    lines.push(`# Generated by \`hoox init\`. NEVER commit this file.`);
    lines.push("");

    // Add secrets from the collected data
    for (const [, integrationSecrets] of Object.entries(secrets)) {
      for (const [key, value] of Object.entries(integrationSecrets)) {
        lines.push(`${key}=${value}`);
      }
    }

    if (lines.length <= 3) continue;

    const content = lines.join("\n") + "\n";
    const filePath = `${worker.path}/.dev.vars`;
    const dir = `${worker.path}`;

    try {
      await Bun.write(filePath, content);
      const { secureSecretFile } = await import("../../utils/fs-secure.js");
      secureSecretFile(filePath);
      if (!opts?.quiet) {
        formatSuccess(`Created ${filePath}`, opts);
      }
    } catch {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dir, { recursive: true });
      await Bun.write(filePath, content);
      const { secureSecretFile } = await import("../../utils/fs-secure.js");
      secureSecretFile(filePath);
      if (!opts?.quiet) {
        formatSuccess(`Created ${filePath}`, opts);
      }
    }
  }
}

async function saveState(engine: WizardEngine): Promise<void> {
  const state = engine.getState();
  const json = serializeState(state);
  await Bun.write(WIZARD_STATE_PATH, json);
  try {
    const { chmodSync } = await import("node:fs");
    chmodSync(WIZARD_STATE_PATH, 0o600);
  } catch {
    // ignore (Windows, tests)
  }
}

async function loadSavedState(): Promise<WizardEngine | null> {
  try {
    const file = Bun.file(WIZARD_STATE_PATH);
    if (!(await file.exists())) return null;
    const json = await file.text();
    const state = deserializeState(json);
    return new WizardEngine(state);
  } catch {
    return null;
  }
}

async function cleanupState(): Promise<void> {
  try {
    const file = Bun.file(WIZARD_STATE_PATH);
    if (await file.exists()) {
      await Bun.write(WIZARD_STATE_PATH, "");
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Main command registration
// ---------------------------------------------------------------------------

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .summary("Interactive setup wizard for Hoox Workspace")
    .description(
      `Initialize a new Hoox workspace with interactive prompts.

This wizard writes the workspace configuration (wrangler.jsonc) and collects
integration secrets. It does NOT generate keys, apply D1 schema, push secrets
to Cloudflare, or build the dashboard — run 'hoox setup' after this to do
that.

WHAT THIS COMMAND DOES:
  - Collects Cloudflare API token and account
  - Collects subdomain prefix for worker URLs
  - Selects worker preset (minimal, standard, full)
  - Provisions D1 databases and KV namespaces (interactive mode only)
  - Collects integration secrets (writes to .dev.vars)
  - Writes wrangler.jsonc

WHAT YOU STILL NEED TO RUN:
  - hoox setup            Generate keys, apply schema, push secrets, deploy dashboard
  - hoox check setup      Verify the installation

INTERACTIVE MODE:
  Run without flags to use the interactive wizard.

NON-INTERACTIVE MODE:
  Provide all required options to skip prompts.

OPTIONS:
  --token <token>         Cloudflare API token
  --account <id>         Cloudflare Account ID
  --secret-store <id>    Secret Store ID
  --prefix <prefix>      Subdomain prefix (default: cryptolinx)
  --preset <name>        Worker preset (minimal, standard, full)
  --resume               Resume from saved wizard state
  --accept-risk          Skip risk acknowledgment
  --self-hosted          Print the VPS / Docker path (no Cloudflare) and exit

EXAMPLES:
  hoox init                           Interactive wizard
  hoox init --token cfut_xxx --account xxx  Non-interactive
  hoox init --preset full --token cfut_xxx --account xxx  Full preset, non-interactive
  hoox init && hoox setup             Full bootstrap: config then infrastructure
  hoox init --self-hosted             Docker / server.js path (not Cloudflare)`
    )
    .option("--token <token>", "Cloudflare API token (non-interactive)")
    .option("--account <id>", "Cloudflare Account ID (non-interactive)")
    .option("--secret-store <id>", "Secret Store ID (non-interactive)")
    .option(
      "--prefix <prefix>",
      "Subdomain prefix (non-interactive, default: cryptolinx)"
    )
    .option("--preset <name>", "Worker preset (minimal, standard, full)")
    .option("--resume", "Resume from saved wizard state")
    .option("--accept-risk", "Skip the risk acknowledgment confirmation")
    .option(
      "--self-hosted",
      "Print VPS / Docker self-host instructions and exit (does not write Cloudflare config)"
    )
    .action(
      withErrorHandling(
        async (options: InitOptions, cmd: Command) => {
          const globalOpts = getFormatOptions(cmd);
          const isNonInteractive = Boolean(options.token && options.account);

          await runInitCommand(options, globalOpts, isNonInteractive);
        },
        { service: "init" }
      )
    );
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function printSelfHostedHelp(): void {
  p.intro(theme.heading("HOOX self-hosted (no Cloudflare)"));
  p.note(
    [
      "There is no Cloudflare-free wrangler.jsonc path.",
      "Use the Bun server or the production Docker image:",
      "",
      "  bun run docker:prod",
      "  docker build -f Dockerfile.prod . --tag hoox:prod",
      "  docker run -p 8080:8080 -e HOOX_SERVER_API_KEY=your-key hoox:prod",
      "  bun run server.js",
      "",
      "Durable Objects, Vectorize, and Workers AI are unavailable self-hosted.",
      "Production path remains: hoox onboard && hoox deploy all --auto",
    ].join("\n"),
    "Self-hosted"
  );
  p.outro("See README.md → Production / self-hosted.");
}

export async function runInitCommand(
  options: InitOptions,
  globalOpts: { json?: boolean; quiet?: boolean },
  isNonInteractive: boolean
): Promise<void> {
  if (options.selfHosted) {
    printSelfHostedHelp();
    return;
  }

  // Guard: must run from the root of a cloned Hoox repo, otherwise we
  // would scatter wrangler.jsonc / .dev.vars into the wrong directory.
  await verifyRepoRoot();

  // ── Non-interactive mode ─────────────────────────────────────────────
  if (isNonInteractive) {
    if (!globalOpts.quiet) {
      p.intro("Hoox Setup Wizard");
      p.note("Non-interactive mode — using provided flags.", "Mode");
    }

    const token = options.token!;
    const account = options.account!;
    const secretStore = options.secretStore ?? "";
    const prefix = options.prefix ?? "cryptolinx";

    // Validate token
    const cf = new CloudflareService();
    const error = await validateApiToken(cf, token);
    if (error) {
      formatError(new CLIError(error, ExitCode.ERROR), globalOpts);
      process.exitCode = ExitCode.ERROR;
      return;
    }
    // Keep credentials for process lifetime so subsequent `hoox setup` /
    // onboard steps can use wrangler with the validated token.
    process.env.CLOUDFLARE_API_TOKEN = token;
    process.env.CLOUDFLARE_ACCOUNT_ID = account;
    if (!globalOpts.quiet) {
      formatSuccess("Cloudflare API token validated", globalOpts);
    }

    // Use engine to build config
    const engine = new WizardEngine();
    engine.execute({ checksPassed: true });
    engine.execute({
      apiToken: token,
      accountId: account,
      secretStoreId: secretStore,
      subdomain: prefix,
    });

    // Apply preset if provided
    if (
      options.preset &&
      ["minimal", "standard", "full"].includes(options.preset)
    ) {
      engine.execute({ preset: options.preset });
    } else {
      engine.execute({ preset: "minimal" as const });
    }

    const config = engine.buildConfig();
    await writeWorkersJsonc(config, globalOpts);
    await createDevVars(config, {}, globalOpts);

    if (!globalOpts.quiet) {
      p.outro(
        "Config written. Next: run `hoox setup` to generate keys, " +
          "apply D1 schema, push secrets, and deploy the dashboard. " +
          "Then run `hoox check setup` to verify."
      );
    }
    return;
  }

  // ── Interactive mode ─────────────────────────────────────────────────

  p.intro(theme.heading("Hoox Setup Wizard"));

  // Try to resume from saved state
  let engine: WizardEngine | null = null;
  if (options.resume) {
    engine = await loadSavedState();
    if (engine) {
      const resumeStep = engine.getCurrentStep().label;
      const resumed = await p.confirm({
        message: `Found saved wizard state. Resume from "${resumeStep}"?`,
        initialValue: true,
      });
      if (p.isCancel(resumed)) {
        p.cancel("Setup cancelled.");
        process.exitCode = 0;
        return;
      }
      if (!resumed) {
        engine = null;
      }
    }
  }

  if (!engine) {
    engine = new WizardEngine();
  }

  const skipRiskWarning = options.acceptRisk;
  if (engine.getCurrentStep().id === "PREREQUISITES") {
    if (!skipRiskWarning) {
      const accepted = await p.confirm({
        message:
          "Hoox connects to live trading exchanges and can execute real trades with real money. " +
          "By continuing, you acknowledge that you are solely responsible for all trading activity " +
          "and accept the risk of financial loss. Do you accept these terms?",
        initialValue: false,
      });

      if (p.isCancel(accepted)) {
        p.cancel("Setup cancelled.");
        process.exitCode = 0;
        return;
      }

      if (!accepted) {
        p.outro("Setup cancelled. See DISCLAIMER.md for full terms.");
        process.exitCode = 0;
        return;
      }
    }

    // Step 0: Prerequisites check (always passes — CLI is running)
    engine.execute({ checksPassed: true });
    await saveState(engine);
  }

  // ── Step 1: Cloudflare API token ──────────────────────────────────────
  if (engine.getCurrentStep().id === "CLOUDFLARE_CONFIG") {
    const cf = new CloudflareService();
    let apiToken: string | symbol = "";
    let tokenValid = false;

    while (!tokenValid) {
      apiToken = await p.password({
        message: "Cloudflare API token:",
        validate(value) {
          if (!value) return "API token is required";
          return;
        },
      });

      if (p.isCancel(apiToken)) {
        p.cancel("Setup cancelled.");
        process.exitCode = 0;
        return;
      }

      p.log.step("Validating Cloudflare API token...");
      const tokenError = await validateApiToken(cf, apiToken as string);
      if (tokenError) {
        p.log.error(tokenError);
        p.log.warn("Please check your token and try again.");
      } else {
        tokenValid = true;
        // Keep token for process lifetime so later provision / setup steps work.
        process.env.CLOUDFLARE_API_TOKEN = apiToken as string;
        formatSuccess("Cloudflare API token validated", globalOpts);
      }
    }

    const defaultAccountId = await getExistingAccountId();
    const accountResult = await p.text({
      message: "Cloudflare Account ID:",
      placeholder: "abc123...",
      defaultValue: defaultAccountId ?? "",
      validate(value) {
        if (!value) return "Account ID is required";
        if (!/^[a-f0-9]{32}$/i.test(value.trim())) {
          return "Account ID should be a 32-character hex string";
        }
        return;
      },
    });
    if (p.isCancel(accountResult)) {
      p.cancel("Setup cancelled.");
      process.exitCode = 0;
      return;
    }

    const secretStoreResult = await p.text({
      message: "Cloudflare Secret Store ID:",
      placeholder: "optional",
      defaultValue: "",
    });
    if (p.isCancel(secretStoreResult)) {
      p.cancel("Setup cancelled.");
      process.exitCode = 0;
      return;
    }

    const prefixResult = await p.text({
      message: "Subdomain prefix:",
      placeholder: "cryptolinx",
      defaultValue: "cryptolinx",
      validate(value) {
        if (!value) return "Subdomain prefix is required";
        return;
      },
    });
    if (p.isCancel(prefixResult)) {
      p.cancel("Setup cancelled.");
      process.exitCode = 0;
      return;
    }

    process.env.CLOUDFLARE_ACCOUNT_ID = accountResult as string;

    engine.execute({
      apiToken: apiToken as string,
      accountId: accountResult,
      secretStoreId: secretStoreResult,
      subdomain: prefixResult,
    });
    await saveState(engine);
  }

  // ── Step 2: Worker selection with presets ──────────────────────────────
  if (engine.getCurrentStep().id === "WORKER_SELECTION") {
    const presetChoice = await p.select({
      message: "Select a worker preset:",
      options: [
        {
          value: "minimal",
          label: "Minimal",
          hint: "Gateway + D1 — webhook processing only",
        },
        {
          value: "standard",
          label: "Standard",
          hint: "Trading + analytics + Telegram",
        },
        {
          value: "full",
          label: "Full",
          hint: "All workers + AI + DeFi + email",
        },
      ],
    });

    if (p.isCancel(presetChoice)) {
      p.cancel("Setup cancelled.");
      process.exitCode = 0;
      return;
    }

    engine.execute({ preset: presetChoice as string });
    await saveState(engine);

    // Show selected workers
    const state = engine.getState();
    p.log.step(`Selected workers: ${state.selectedWorkers.join(", ")}`);
    if (state.selectedIntegrations.length > 0) {
      p.log.step(`Integrations: ${state.selectedIntegrations.join(", ")}`);
    }
  }

  // ── Step 3: Provisioning ──────────────────────────────────────────────
  if (engine.getCurrentStep().id === "PROVISIONING") {
    const plan = engine.getProvisioningPlan();
    const hasResources =
      plan.d1Databases.length > 0 ||
      plan.kvNamespaces.length > 0 ||
      (plan.vectorizeIndexes?.length ?? 0) > 0;

    if (hasResources) {
      const shouldProvision = await p.confirm({
        message: `Provision Cloudflare resources? (${[
          ...plan.d1Databases.map((d) => `D1:${d}`),
          ...plan.kvNamespaces.map((k) => `KV:${k}`),
          ...(plan.vectorizeIndexes ?? []).map((v) => `Vectorize:${v}`),
        ].join(", ")})`,
        initialValue: true,
      });

      if (p.isCancel(shouldProvision)) {
        p.cancel("Setup cancelled.");
        process.exitCode = 0;
        return;
      }

      if (shouldProvision) {
        p.log.step("Provisioning infrastructure...");
        const provisioner = new CLIProvisioner();
        const result = await provisioner.provision(plan);

        if (result.success) {
          formatSuccess(`Created: ${result.created.join(", ")}`, globalOpts);
        } else {
          p.log.warn(`Provisioning had issues: ${result.errors.join("; ")}`);
        }

        engine.execute({ provisioningResults: result });
      } else {
        engine.execute({
          provisioningResults: { success: true, created: [], errors: [] },
        });
      }
    } else {
      engine.execute({});
    }
    await saveState(engine);
  }

  // ── Step 4: Secrets ──────────────────────────────────────────────────
  if (engine.getCurrentStep().id === "SECRETS") {
    const state = engine.getState();
    const collectedSecrets: Record<string, Record<string, string>> = {};

    if (state.selectedIntegrations.length > 0) {
      p.log.step("Collecting integration secrets...");

      for (const key of state.selectedIntegrations) {
        const { INTEGRATIONS } = await import("@hoox-sh/hoox-shared");
        const integration = INTEGRATIONS.find((i) => i.key === key);
        if (!integration || Object.keys(integration.secrets).length === 0)
          continue;

        const secretEntries = Object.entries(integration.secrets);
        const groupFields: Record<string, () => Promise<string | symbol>> = {};

        for (const [secretName] of secretEntries) {
          groupFields[secretName] = () =>
            p.password({
              message: `${integration.secrets[secretName]}:`,
              validate(value) {
                if (!value) return "This secret is required";
                return;
              },
            });
        }

        const collected = await p.group(groupFields, {
          onCancel: () => {
            p.cancel("Setup cancelled.");
            process.exitCode = 0;
          },
        });

        if (p.isCancel(collected)) {
          // Do not advance the wizard or write partial secrets
          return;
        }

        collectedSecrets[key] = {};
        for (const [secretName] of secretEntries) {
          const val = collected[secretName];
          if (p.isCancel(val) || typeof val !== "string") {
            p.cancel("Setup cancelled.");
            process.exitCode = 0;
            return;
          }
          collectedSecrets[key][secretName] = val;
        }
      }
    }

    // Only persist secrets and continue when collection finished fully
    engine.execute({ secrets: collectedSecrets });
    await saveState(engine);
  }

  // ── Step 5: Config Write ──────────────────────────────────────────────
  if (engine.getCurrentStep().id === "CONFIG_WRITE") {
    p.log.step("Writing configuration...");

    const config = engine.buildConfig();
    const state = engine.getState();

    await writeWorkersJsonc(config, globalOpts);
    await createDevVars(config, state.secrets, globalOpts);

    engine.execute({});
    await cleanupState(); // Clean up state file — wizard complete
  }

  // ── Step 6: Deploy ──────────────────────────────────────────────────
  if (engine.getCurrentStep().id === "DEPLOY") {
    const shouldDeploy = await p.confirm({
      message: "Deploy workers now?",
      initialValue: false,
    });

    if (p.isCancel(shouldDeploy)) {
      p.cancel("Setup cancelled.");
      process.exitCode = 0;
      return;
    }

    if (shouldDeploy) {
      p.log.step("Deploying workers...");
      const proc = Bun.spawn(["hoox", "deploy", "all"], {
        stdout: "inherit",
        stderr: "inherit",
      });
      await proc.exited;
    }

    engine.execute({});
  }

  // ── Done ──────────────────────────────────────────────────────────────
  p.outro(
    theme.success("Config written. Next: run ") +
      theme.bold("hoox setup") +
      theme.success(
        " to generate keys, apply D1 schema, push secrets, and deploy the dashboard. Then run "
      ) +
      theme.bold("hoox check setup") +
      theme.success(" to verify.")
  );
}
