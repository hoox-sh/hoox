/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WorkerManifest, WorkerTier } from "./types.js";

/**
 * Compute reverse service binding mapping.
 * Returns a map of worker-name -> list-of-workers-that-call-it.
 */
function deriveCalledBy(
  manifests: Record<string, WorkerManifest>
): Record<string, string[]> {
  const calledBy: Record<string, Set<string>> = {};
  for (const [workerName, manifest] of Object.entries(manifests)) {
    if (!calledBy[workerName]) calledBy[workerName] = new Set();
    for (const svc of manifest.services) {
      let callers = calledBy[svc.service];
      if (!callers) {
        callers = new Set();
        calledBy[svc.service] = callers;
      }
      callers.add(workerName);
    }
    for (const incoming of manifest.callers ?? []) {
      calledBy[workerName]!.add(incoming.worker);
    }
  }
  const result: Record<string, string[]> = {};
  for (const [worker, callers] of Object.entries(calledBy)) {
    result[worker] = [...callers].sort();
  }
  return result;
}

const manifests: Record<string, WorkerManifest> = {
  hoox: {
    name: "hoox",
    path: "workers/hoox-worker",
    defaultEnabled: true,
    vars: {
      WEBHOOK_API_KEY_BINDING: {
        type: "secret",
        description: "External webhook auth key",
      },
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      HA_TOKEN_BINDING: { type: "secret", description: "Home Assistant token" },
      TELEGRAM_ALLOWED_CHAT_IDS: {
        type: "secret",
        description:
          "Comma-separated chat IDs for webhook notify (fail-closed when unset); alias AUTHORIZED_CHAT_IDS",
      },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      kv: [
        { binding: "SESSIONS_KV", description: "Webhook session storage" },
        {
          binding: "CONFIG_KV",
          description: "Configuration + rate limiter state",
        },
      ],
      vectorize: [{ binding: "VECTORIZE_INDEX", index: "my-rag-index" }],
      ai: true,
      queues: { producer: ["trade-execution"] },
      durableObjects: [
        { name: "IDEMPOTENCY_STORE", className: "IdempotencyStore" },
        { name: "RATE_LIMITER", className: "RateLimiterStore" },
      ],
    },
    middleware: [
      "requireAuth",
      "requireInternalAuth",
      "cors",
      "rateLimit",
      "logger",
      "validate",
    ],
  },

  "trade-worker": {
    name: "trade-worker",
    path: "workers/trade-worker",
    defaultEnabled: true,
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      TELEGRAM_INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Telegram outbound auth",
      },
      EXCHANGE_KEY_BINDING: {
        type: "secret",
        description: "Unified exchange API key (Binance / Bybit / MEXC)",
      },
      EXCHANGE_SECRET_BINDING: {
        type: "secret",
        description: "Unified exchange API secret",
      },
      EXCHANGE_TESTNET_KEY_BINDING: {
        type: "secret",
        description: "Optional unified testnet API key",
      },
      EXCHANGE_TESTNET_SECRET_BINDING: {
        type: "secret",
        description: "Optional unified testnet API secret",
      },
      WALLET_EXECUTE_KEY_BINDING: {
        type: "secret",
        description: "Mesh key for DEX swaps via web3-wallet-worker",
      },
    },
    services: [
      {
        binding: "D1_SERVICE",
        service: "d1-worker",
        description: "Database operations",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
      {
        binding: "WEB3_WALLET_SERVICE",
        service: "web3-wallet-worker",
        description: "DEX spot swaps (Uniswap / Jupiter)",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      d1: [
        {
          binding: "DB",
          database: "trade-data-db",
          description: "Trade operations",
        },
      ],
      r2: [
        {
          binding: "REPORTS_BUCKET",
          bucket: "trade-reports",
          description: "Trade reports",
        },
        {
          binding: "SYSTEM_LOGS_BUCKET",
          bucket: "hoox-system-logs",
          description: "Verbose exchange logs",
        },
      ],
      queues: { consumer: ["trade-execution"] },
    },
    middleware: ["requireInternalAuth"],
  },

  "telegram-worker": {
    name: "telegram-worker",
    path: "workers/telegram-worker",
    defaultEnabled: true,
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      TG_BOT_TOKEN_BINDING: {
        type: "secret",
        description: "Telegram bot token",
      },
      TG_CHAT_ID_BINDING: { type: "secret", description: "Default chat ID" },
      TELEGRAM_SECRET_TOKEN: {
        type: "secret",
        description: "Webhook verification token",
      },
      AUTHORIZED_CHAT_IDS: {
        type: "secret",
        description:
          "Comma-separated chat IDs; inbound webhook fail-closed when unset; outbound /alert allowlist",
      },
    },
    services: [],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      r2: [
        {
          binding: "UPLOADS_BUCKET",
          bucket: "user-uploads",
          description: "User uploaded files",
        },
      ],
      vectorize: [{ binding: "VECTORIZE_INDEX", index: "my-rag-index" }],
      ai: true,
    },
    middleware: ["requireInternalAuth"],
  },

  "d1-worker": {
    name: "d1-worker",
    path: "workers/d1-worker",
    defaultEnabled: true,
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
    },
    services: [],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      d1: [
        {
          binding: "DB",
          database: "trade-data-db",
          description: "Main database",
        },
      ],
    },
    middleware: ["requireInternalAuth"],
  },

  "web3-wallet-worker": {
    name: "web3-wallet-worker",
    path: "workers/web3-wallet-worker",
    defaultEnabled: false,
    vars: {
      WALLET_PK_SECRET: { type: "secret", description: "Wallet private key" },
      WALLET_MNEMONIC_SECRET: {
        type: "secret",
        description: "Wallet mnemonic phrase",
      },
      WALLET_EXECUTE_KEY_BINDING: {
        type: "secret",
        description: "Mesh key for privileged wallet routes",
      },
      SOLANA_PRIVATE_KEY: {
        type: "secret",
        description: "Solana signing key (base58 seed or Phantom export)",
      },
      JUPITER_API_KEY: {
        type: "secret",
        description: "Jupiter Swap V2 API key",
      },
      RPC_URL_SOLANA: {
        type: "plaintext",
        description: "Solana JSON-RPC URL",
      },
    },
    services: [
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {},
    middleware: ["requireInternalAuth"],
  },

  "agent-worker": {
    name: "agent-worker",
    path: "workers/agent-worker",
    defaultEnabled: true,
    vars: {
      AGENT_INTERNAL_KEY: { type: "secret", description: "Agent worker auth" },
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      OPENAI_API_KEY: { type: "secret", description: "OpenAI API key" },
      ANTHROPIC_API_KEY: { type: "secret", description: "Anthropic API key" },
      GOOGLE_API_KEY: { type: "secret", description: "Google AI API key" },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      d1: [
        {
          binding: "DB",
          database: "trade-data-db",
          description: "Portfolio queries",
        },
      ],
      ai: true,
    },
    middleware: ["requireInternalAuth"],
    // Configurable 1–1440 min; default every 15 minutes (see agent-worker README)
    cron: ["*/15 * * * *"],
  },

  "email-worker": {
    name: "email-worker",
    path: "workers/email-worker",
    defaultEnabled: false,
    vars: {
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      EMAIL_HOST_BINDING: { type: "secret", description: "Email IMAP host" },
      EMAIL_USER_BINDING: { type: "secret", description: "Email username" },
      EMAIL_PASS_BINDING: { type: "secret", description: "Email password" },
      TRADE_WORKER_NAME: {
        type: "plaintext",
        description: "Trade worker service name",
        default: "trade-worker",
      },
      USE_IMAP: {
        type: "plaintext",
        description: "Use IMAP for email",
        default: "false",
      },
      MAILGUN_API_KEY: { type: "secret", description: "Mailgun API key" },
      EMAIL_SCAN_SUBJECT: { type: "secret", description: "Email scan subject" },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
    },
    middleware: ["requireInternalAuth"],
    cron: ["*/5 * * * *"],
  },

  "analytics-worker": {
    name: "analytics-worker",
    path: "workers/analytics-worker",
    defaultEnabled: true,
    vars: {
      CLOUDFLARE_API_TOKEN: {
        type: "secret",
        description: "CF API token for Analytics SQL",
      },
      CLOUDFLARE_ACCOUNT_ID: {
        type: "plaintext",
        description: "CF Account ID",
      },
    },
    services: [],
    infrastructure: {
      analyticsEngine: true,
    },
    middleware: [],
  },

  "report-worker": {
    name: "report-worker",
    path: "workers/report-worker",
    defaultEnabled: false,
    vars: {
      CF_API_TOKEN_BINDING: {
        type: "secret",
        description: "CF API token for Browser Rendering",
      },
      ACCOUNT_ID: { type: "plaintext", description: "CF Account ID" },
    },
    services: [
      {
        binding: "D1_SERVICE",
        service: "d1-worker",
        description: "Database queries",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      r2: [
        {
          binding: "REPORTS_BUCKET",
          bucket: "trade-reports",
          description: "PDF reports",
        },
      ],
    },
    middleware: ["requireInternalAuth"],
    cron: ["0 8 * * *", "0 18 * * *"],
  },

  "pyne-worker": {
    name: "pyne-worker",
    path: "workers/pyne-worker",
    defaultEnabled: true,
    tier: "optional",
    description: "Pine Script™ edge evaluate isolate (Python Worker)",
    repo: "pyne-worker",
    vars: {
      API_KEY: {
        type: "secret",
        description: "X-API-Key for /run and management endpoints",
      },
      ALERT_WEBHOOK_URL: {
        type: "secret",
        description: "Default HTTPS webhook for alert()/alertcondition()",
        optional: true,
      },
      TRADE_WORKER_NAME: {
        type: "plaintext",
        description: "Trade worker service name",
        default: "trade-worker",
      },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Forward strategy trade events",
      },
    ],
    infrastructure: {
      r2: [
        {
          binding: "OHLCV_DATA",
          bucket: "pyne-worker-ohlcv",
          description: "OHLCV klines + script registry",
        },
      ],
    },
    // Python isolate — auth is X-API-Key, not mesh INTERNAL_KEY middleware
    middleware: [],
    cron: ["* * * * *"],
    callers: [
      {
        worker: "dashboard",
        binding: "PYNE_SERVICE",
        description: "PYNE edge evaluate",
      },
    ],
  },

  "pyne-agent-worker": {
    name: "pyne-agent-worker",
    path: "workers/pyne-agent-worker",
    defaultEnabled: false,
    tier: "optional",
    description:
      "NL → PYNE scripts (Workers AI™; optional validate via pyne-worker)",
    repo: "pyne-agent-worker",
    vars: {
      API_KEY: {
        type: "secret",
        description: "HTTP auth (X-API-Key / Authorization: Bearer)",
      },
      AXIS_MCP_KEY: {
        type: "secret",
        description: "AXIS MCP Bearer (falls back to API_KEY)",
        optional: true,
      },
      PYNE_WORKER_API_KEY: {
        type: "secret",
        description:
          "HTTP pyne-worker validate loop (when not using service binding)",
        optional: true,
      },
      PYNE_PRO_API_KEY: {
        type: "secret",
        description: "pyn_… Bearer for pynescript.online",
        optional: true,
      },
      HX_ALLOW_SELFHOST: {
        type: "secret",
        description: "Fail-open self-host token (set equal to API_KEY)",
        optional: true,
      },
      PYNE_WORKER_URL: {
        type: "plaintext",
        description: "HTTP evaluate host when PYNE_SERVICE is unset",
      },
      AXIS_MCP_URL: {
        type: "plaintext",
        description: "AXIS MCP endpoint",
        default: "https://worker.axis.hoox.sh/mcp",
      },
    },
    services: [
      {
        binding: "PYNE_SERVICE",
        service: "pyne-worker",
        description: "Optional /run validate + AST ops",
        optional: true,
      },
    ],
    callers: [
      {
        worker: "dashboard",
        binding: "PYNE_AGENT_SERVICE",
        description: "NL → PYNE agent chat",
      },
    ],
    infrastructure: {
      ai: true,
      kv: [
        {
          binding: "TENANT_KEYS",
          description: "Live tenant verify cache",
        },
      ],
      vectorize: [{ binding: "VECTORIZE", index: "pyne-agent-kb" }],
      r2: [
        {
          binding: "KB",
          bucket: "pyne-agent-kb",
          description: "Knowledge documents",
        },
      ],
      d1: [
        {
          binding: "DB",
          database: "pyne-agent-sessions",
          description: "Chat session history",
        },
      ],
      durableObjects: [
        { name: "PyneAgent", className: "PyneAgent" },
        { name: "PyneMcp", className: "PyneMcp" },
      ],
    },
    middleware: [],
  },

  /**
   * Catalog stub — PyneTS currently ships as `@hoox-sh/pynets` (library).
   * A Worker isolate is planned; formerly known as pine-worker.
   */
  "pynets-worker": {
    name: "pynets-worker",
    path: "workers/pynets-worker",
    defaultEnabled: false,
    tier: "planned",
    description:
      "PyneTS Worker isolate (formerly pine-worker). Not shippable yet — use @hoox-sh/pynets.",
    repo: "pynets-worker",
    aliases: ["pine-worker"],
    vars: {},
    services: [],
    infrastructure: {},
    middleware: [],
  },

  dashboard: {
    name: "dashboard",
    path: "workers/dashboard",
    defaultEnabled: true,
    vars: {
      DASHBOARD_USER: {
        type: "secret",
        description: "Dashboard admin username",
      },
      DASHBOARD_PASS: {
        type: "secret",
        description: "Dashboard admin password",
      },
      SESSION_SECRET: { type: "secret", description: "Session encryption key" },
      PYNE_API_KEY: {
        type: "secret",
        description: "Dashboard → pyne-worker X-API-Key (match API_KEY)",
        optional: true,
      },
    },
    services: [
      {
        binding: "D1_SERVICE",
        service: "d1-worker",
        description: "Database queries",
      },
      {
        binding: "AGENT_SERVICE",
        service: "agent-worker",
        description: "AI risk data",
      },
      {
        binding: "PYNE_SERVICE",
        service: "pyne-worker",
        description: "PYNE edge evaluate",
        optional: true,
      },
      {
        binding: "PYNE_AGENT_SERVICE",
        service: "pyne-agent-worker",
        description: "NL → PYNE agent chat",
        optional: true,
      },
    ],
    infrastructure: {
      kv: [{ binding: "CONFIG_KV", description: "Configuration" }],
      ai: true,
    },
    middleware: [],
  },
};

/** Map of worker-name -> list-of-workers-that-call-it (computed). */
export const CALLED_BY: Record<string, string[]> = deriveCalledBy(manifests);

/** The canonical registry of all worker manifests. */
export const WORKER_MANIFESTS: Record<string, WorkerManifest> = manifests;

/** List of all worker names in the registry. */
export const WORKER_NAMES: string[] = Object.keys(manifests).sort();

/**
 * Catalog entry for CLI worker enable/disable — one row per known worker.
 * `defaultEnabled` is the seed value when the worker is first added to config.
 */
export interface WorkerCatalogEntry {
  name: string;
  path: string;
  defaultEnabled: boolean;
  tier: WorkerTier;
  description?: string;
  repo?: string;
  aliases?: string[];
  /** False for `planned` workers that are not shippable yet. */
  available: boolean;
}

function catalogTier(m: WorkerManifest): WorkerTier {
  return m.tier ?? "core";
}

/** Full catalog of known workers with default enable flags (sorted by name). */
export const WORKER_CATALOG: WorkerCatalogEntry[] = WORKER_NAMES.map((name) => {
  const m = manifests[name]!;
  const tier = catalogTier(m);
  return {
    name: m.name,
    path: m.path,
    defaultEnabled: m.defaultEnabled,
    tier,
    description: m.description,
    repo: m.repo ?? m.name,
    aliases: m.aliases,
    available: tier !== "planned",
  };
});

/** Lookup defaultEnabled for a known worker; undefined if not in catalog. */
export function getWorkerDefaultEnabled(name: string): boolean | undefined {
  const canonical = resolveCatalogWorkerName(name);
  return canonical ? manifests[canonical]?.defaultEnabled : undefined;
}

/** Effective tier (`core` when omitted). Undefined if the name is unknown. */
export function getWorkerTier(name: string): WorkerTier | undefined {
  const canonical = resolveCatalogWorkerName(name);
  if (!canonical) return undefined;
  return catalogTier(manifests[canonical]!);
}

/**
 * Resolve a catalog name or alias (`pine-worker` → `pynets-worker`).
 * Returns undefined when the input is not in the catalog.
 */
export function resolveCatalogWorkerName(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (manifests[trimmed]) return trimmed;
  for (const [name, m] of Object.entries(manifests)) {
    if (m.aliases?.includes(trimmed)) return name;
  }
  return undefined;
}

/** True when the worker is catalogued but not shippable yet. */
export function isPlannedWorker(name: string): boolean {
  return getWorkerTier(name) === "planned";
}

/** Secret names declared on a manifest (`type: "secret"`). */
export function secretNamesFromManifest(manifest: WorkerManifest): string[] {
  return Object.entries(manifest.vars)
    .filter(([, def]) => def.type === "secret")
    .map(([n]) => n);
}

/** Required (non-optional) secret names declared on a manifest. */
export function requiredSecretNamesFromManifest(
  manifest: WorkerManifest
): string[] {
  return Object.entries(manifest.vars)
    .filter(([, def]) => def.type === "secret" && !def.optional)
    .map(([n]) => n);
}

/** Operator-facing explanation for a planned catalog stub. */
export function plannedWorkerMessage(name: string): string {
  const canonical = resolveCatalogWorkerName(name) ?? name;
  const m = manifests[canonical];
  const former = m?.aliases?.length
    ? ` (formerly ${m.aliases.join(", ")})`
    : "";
  return (
    m?.description ??
    `Worker "${canonical}"${former} is catalogued but not shippable yet.`
  );
}
