/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Regenerate each worker-configuration.d.ts from wrangler.jsonc.
 *
 * Hides .dev.vars so a wizard dump of every secret does not leak onto
 * every isolate Env. Injects catalog secrets from packages/shared after
 * wrangler types. Uses --strict-vars false so local URLs/account ids
 * stay `string`.
 *
 * Usage: bun scripts/generate-worker-types.ts
 */
import { existsSync, renameSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { WORKER_MANIFESTS } from "../packages/shared/src/schemas/registry.ts";

const COPYRIGHT = `/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

`;

const WORKERS_DIR = join(import.meta.dir, "..", "workers");

/** Catalog name → extra secret fields not listed in the manifest vars. */
const EXTRA_SECRETS: Record<string, Record<string, boolean>> = {
  hoox: { OPERATOR_API_KEY: true, AUTHORIZED_CHAT_IDS: true },
  "agent-worker": {
    OPENAI_API_KEY: true,
    ANTHROPIC_API_KEY: true,
    GOOGLE_API_KEY: true,
    AZURE_API_KEY: true,
    AZURE_ENDPOINT: true,
  },
  "trade-worker": {
    BINANCE_KEY_BINDING: true,
    BINANCE_SECRET_BINDING: true,
    BYBIT_KEY_BINDING: true,
    BYBIT_SECRET_BINDING: true,
    MEXC_KEY_BINDING: true,
    MEXC_SECRET_BINDING: true,
  },
  "report-worker": { INTERNAL_KEY_BINDING: false },
  "d1-worker": { INTERNAL_KEY_BINDING: false },
  "analytics-worker": { INTERNAL_KEY_BINDING: false },
  dashboard: {
    AGENT_INTERNAL_KEY: false,
    TRADE_INTERNAL_KEY: false,
    API_SERVICE_KEY_BINDING: false,
  },
  "web3-wallet-worker": {
    INTERNAL_KEY_BINDING: false,
    TELEGRAM_INTERNAL_KEY_BINDING: true,
  },
};

const DIR_TO_CATALOG: Record<string, string> = {
  "hoox-worker": "hoox",
  dashboard: "dashboard",
};

function catalogName(dir: string): string {
  return DIR_TO_CATALOG[dir] ?? dir;
}

function secretFields(dir: string): Record<string, boolean> {
  const name = catalogName(dir);
  const out: Record<string, boolean> = {
    TENANT_ID: true,
    TENANT_MODE: true,
    ...(EXTRA_SECRETS[name] ?? {}),
  };
  const manifest = WORKER_MANIFESTS[name];
  if (manifest) {
    for (const [key, def] of Object.entries(manifest.vars)) {
      if (def.type === "secret") {
        const optional =
          key.includes("TESTNET") ||
          key === "HA_TOKEN_BINDING" ||
          key === "JUPITER_API_KEY" ||
          key === "PYNE_API_KEY" ||
          key === "ALERT_WEBHOOK_URL" ||
          key.endsWith("_TESTNET_KEY_BINDING") ||
          key.endsWith("_TESTNET_SECRET_BINDING");
        out[key] = optional;
      }
    }
  }
  return out;
}

function injectSecrets(dts: string, secrets: Record<string, boolean>): string {
  const names = Object.keys(secrets);
  if (names.length === 0) return dts;
  const marker = "interface __BaseEnv_Env {";
  const start = dts.indexOf(marker);
  if (start < 0) return dts;
  const brace = dts.indexOf("{", start);
  const end = dts.indexOf("\n}", brace);
  if (end < 0) return dts;
  const block = dts.slice(brace, end);
  const lines: string[] = [];
  for (const name of names.sort()) {
    if (block.includes(`${name}:`) || block.includes(`${name}?:`)) continue;
    const opt = secrets[name] ? "?" : "";
    lines.push(`\t${name}${opt}: string;`);
  }
  if (lines.length === 0) return dts;
  return dts.slice(0, end) + "\n" + lines.join("\n") + dts.slice(end);
}

function ensureCopyright(dts: string): string {
  if (dts.includes("SPDX-License-Identifier")) return dts;
  return COPYRIGHT + dts;
}

function generateOne(dirName: string): void {
  const dir = join(WORKERS_DIR, dirName);
  const dtsPath = join(dir, "worker-configuration.d.ts");
  if (!existsSync(dtsPath)) {
    console.log(`skip ${dirName}: no worker-configuration.d.ts`);
    return;
  }
  const cfg = existsSync(join(dir, "wrangler.jsonc"))
    ? "wrangler.jsonc"
    : existsSync(join(dir, "wrangler.jsonc.example"))
      ? "wrangler.jsonc.example"
      : null;
  if (!cfg) {
    console.log(`skip ${dirName}: no wrangler config`);
    return;
  }

  const devVars = join(dir, ".dev.vars");
  const hidden = join(dir, ".dev.vars.__typegen");
  let hid = false;
  if (existsSync(devVars)) {
    renameSync(devVars, hidden);
    hid = true;
  }

  console.log(`→ ${dirName} (${cfg})`);
  const result = spawnSync(
    "bunx",
    [
      "wrangler",
      "types",
      "-c",
      cfg,
      "--strict-vars",
      "false",
      "worker-configuration.d.ts",
    ],
    { cwd: dir, encoding: "utf8" }
  );
  if (hid) renameSync(hidden, devVars);
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`wrangler types failed in ${dirName}`);
  }

  let dts = readFileSync(dtsPath, "utf8");
  dts = injectSecrets(dts, secretFields(dirName));
  dts = ensureCopyright(dts);
  writeFileSync(dtsPath, dts);
}

const dirs = [
  "agent-worker",
  "analytics-worker",
  "d1-worker",
  "dashboard",
  "email-worker",
  "hoox-worker",
  "report-worker",
  "telegram-worker",
  "trade-worker",
  "web3-wallet-worker",
];

for (const d of dirs) generateOne(d);
console.log("done");
