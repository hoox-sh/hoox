/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { parse, type ParseError } from "jsonc-parser";
import type { WorkerManifest, ValidationError } from "./types.js";

function parseJsoncDocument(content: string): {
  value: unknown;
  errors: ParseError[];
} {
  const errors: ParseError[] = [];
  const value = parse(content, errors, { allowTrailingComma: true });
  return { value, errors };
}

/** Shape of a parsed wrangler.jsonc object — fields we read for validation. */
interface ParsedWrangler {
  vars?: Record<string, unknown>;
  services?: Array<{ binding: string; service: string }>;
}

/** Shape of a parsed root wrangler.jsonc — we only need per-worker secret lists. */
interface ParsedRootWrangler {
  workers?: Record<string, { secrets?: string[] }>;
}

/**
 * Validate a per-worker wrangler.jsonc against its manifest.
 * Returns an array of errors (empty = perfect match).
 */
export function validateWranglerJsonc(
  workerName: string,
  manifest: WorkerManifest,
  jsoncContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { value: parsed, errors: parseErrors } =
    parseJsoncDocument(jsoncContent);
  if (parseErrors.length > 0) {
    errors.push({
      worker: workerName,
      severity: "error",
      message: "Failed to parse wrangler.jsonc",
      file: "wrangler.jsonc",
    });
    return errors;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push({
      worker: workerName,
      severity: "error",
      message: "Failed to parse wrangler.jsonc — result is not a valid object",
      file: "wrangler.jsonc",
    });
    return errors;
  }

  const wrangler = parsed as ParsedWrangler;

  // Check vars
  const declaredVars = wrangler.vars ?? {};
  for (const [name, def] of Object.entries(manifest.vars)) {
    if (!(name in declaredVars)) {
      errors.push({
        worker: workerName,
        severity: "error",
        message: `Missing var: ${name} (${def.description})`,
        file: "wrangler.jsonc",
      });
    }
  }

  // Check naming convention for secret vars
  for (const [name, def] of Object.entries(manifest.vars)) {
    if (
      def.type === "secret" &&
      !name.endsWith("_BINDING") &&
      !name.endsWith("_SECRET") &&
      !name.startsWith("CLOUDFLARE_") &&
      name !== "TELEGRAM_SECRET_TOKEN" &&
      name !== "TELEGRAM_ALLOWED_CHAT_IDS" &&
      name !== "AUTHORIZED_CHAT_IDS" &&
      name !== "MAILGUN_API_KEY" &&
      name !== "EMAIL_SCAN_SUBJECT" &&
      name !== "DASHBOARD_USER" &&
      name !== "DASHBOARD_PASS" &&
      name !== "SESSION_SECRET" &&
      name !== "AGENT_INTERNAL_KEY" &&
      name !== "OPENAI_API_KEY" &&
      name !== "ANTHROPIC_API_KEY" &&
      name !== "GOOGLE_API_KEY"
    ) {
      errors.push({
        worker: workerName,
        severity: "warning",
        message: `Secret var "${name}" does not end with _BINDING or _SECRET suffix`,
        file: "wrangler.jsonc",
      });
    }
  }

  // Check services
  const declaredServices = wrangler.services ?? [];
  for (const expected of manifest.services) {
    const match = declaredServices.find(
      (s) => s.binding === expected.binding && s.service === expected.service
    );
    if (!match) {
      const declared = declaredServices.find(
        (s) => s.binding === expected.binding
      );
      if (declared) {
        errors.push({
          worker: workerName,
          severity: "error",
          message: `Service "${expected.binding}" points to "${declared.service}" but manifest expects "${expected.service}"`,
          file: "wrangler.jsonc",
        });
      } else {
        errors.push({
          worker: workerName,
          severity: "error",
          message: `Missing service binding: ${expected.binding} -> ${expected.service}`,
          file: "wrangler.jsonc",
        });
      }
    }
  }

  // Check no extra service bindings
  for (const declared of declaredServices) {
    const expected = manifest.services.find(
      (s) => s.binding === declared.binding
    );
    if (!expected) {
      errors.push({
        worker: workerName,
        severity: "warning",
        message: `Unexpected service binding: ${declared.binding}`,
        file: "wrangler.jsonc",
      });
    }
  }

  return errors;
}

/**
 * Validate root wrangler.jsonc secrets list against manifest.
 */
export function validateRootSecrets(
  workerName: string,
  manifest: WorkerManifest,
  rootJsoncContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { value: parsed, errors: parseErrors } =
    parseJsoncDocument(rootJsoncContent);
  if (parseErrors.length > 0) {
    errors.push({
      worker: workerName,
      severity: "error",
      message: "Failed to parse root wrangler.jsonc",
    });
    return errors;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    errors.push({
      worker: workerName,
      severity: "error",
      message:
        "Failed to parse root wrangler.jsonc — result is not a valid object",
    });
    return errors;
  }

  const rootWrangler = parsed as ParsedRootWrangler;
  const rootSecrets: string[] =
    rootWrangler.workers?.[workerName]?.secrets ?? [];
  const expectedSecrets = Object.entries(manifest.vars)
    .filter(([_, def]) => def.type === "secret")
    .map(([name]) => name);

  for (const expected of expectedSecrets) {
    if (!rootSecrets.includes(expected)) {
      errors.push({
        worker: workerName,
        severity: "error",
        message: `Secret "${expected}" missing from root wrangler.jsonc workers.${workerName}.secrets`,
        file: "wrangler.jsonc (root)",
      });
    }
  }

  return errors;
}

/**
 * Validate .dev.vars content against manifest.
 */
export function validateDevVars(
  workerName: string,
  manifest: WorkerManifest,
  devVarsContent: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Parse .env style file
  const vars = new Map<string, string>();
  for (const line of devVarsContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    vars.set(
      trimmed.substring(0, eqIdx).trim(),
      trimmed.substring(eqIdx + 1).trim()
    );
  }

  for (const [name, def] of Object.entries(manifest.vars)) {
    if (def.type !== "secret") continue;
    if (!vars.has(name)) {
      errors.push({
        worker: workerName,
        severity: "error",
        message: `Missing "${name}" in .dev.vars`,
        file: ".dev.vars",
      });
    }
  }

  return errors;
}

// ── Generate functions ───────────────────────────────────────────────

/** Wrangler producer binding name for a queue (matches deployed hoox-worker). */
function queueProducerBinding(queue: string): string {
  if (queue === "trade-execution") return "TRADE_QUEUE";
  return queue.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase();
}

/**
 * Generate a complete per-worker wrangler.jsonc from a manifest.
 */
export function generateWranglerJsonc(manifest: WorkerManifest): string {
  const parts: string[] = [];
  parts.push(`{`);

  // name
  parts.push(`  "name": "${manifest.name}",`);
  parts.push(`  "main": "src/index.ts",`);

  // vars
  const varKeys = Object.keys(manifest.vars);
  if (varKeys.length > 0) {
    parts.push(`  "vars": {`);
    for (const [i, name] of varKeys.entries()) {
      const def = manifest.vars[name];
      if (!def) continue;
      const comma = i < varKeys.length - 1 ? "," : "";
      const val =
        def.type === "secret"
          ? "__SECRET__"
          : JSON.stringify(def.default ?? "");
      parts.push(`    "${name}": ${val}${comma}`);
    }
    parts.push(`  },`);
  }

  // services
  if (manifest.services.length > 0) {
    parts.push(`  "services": [`);
    for (const [i, svc] of manifest.services.entries()) {
      const comma = i < manifest.services.length - 1 ? "," : "";
      parts.push(
        `    { "binding": "${svc.binding}", "service": "${svc.service}" }${comma}`
      );
    }
    parts.push(`  ],`);
  }

  // infrastructure
  const infra = manifest.infrastructure;

  // kv_namespaces
  if (infra.kv && infra.kv.length > 0) {
    parts.push(`  "kv_namespaces": [`); // ... etc
    for (const [i, binding] of infra.kv.entries()) {
      const comma = i < infra.kv.length - 1 ? "," : "";
      parts.push(`    { "binding": "${binding.binding}", "id": "" }${comma}`);
    }
    parts.push(`  ],`);
  }

  // d1_databases
  if (infra.d1 && infra.d1.length > 0) {
    parts.push(`  "d1_databases": [`);
    for (const [i, binding] of infra.d1.entries()) {
      const comma = i < infra.d1.length - 1 ? "," : "";
      parts.push(
        `    { "binding": "${binding.binding}", "database_name": "${binding.database}", "database_id": "" }${comma}`
      );
    }
    parts.push(`  ],`);
  }

  // r2_buckets
  if (infra.r2 && infra.r2.length > 0) {
    parts.push(`  "r2_buckets": [`);
    for (const [i, binding] of infra.r2.entries()) {
      const comma = i < infra.r2.length - 1 ? "," : "";
      parts.push(
        `    { "binding": "${binding.binding}", "bucket_name": "${binding.bucket}" }${comma}`
      );
    }
    parts.push(`  ],`);
  }

  // ai
  if (infra.ai) {
    parts.push(`  "ai": { "binding": "AI" },`);
  }

  // analytics_engine
  if (infra.analyticsEngine) {
    parts.push(
      `  "analytics_engine_datasets": [{ "binding": "ANALYTICS_ENGINE", "dataset": "hoox-analytics" }],`
    );
  }

  // vectorize
  if (infra.vectorize && infra.vectorize.length > 0) {
    parts.push(`  "vectorize": [`);
    for (const [i, binding] of infra.vectorize.entries()) {
      const comma = i < infra.vectorize.length - 1 ? "," : "";
      parts.push(
        `    { "binding": "${binding.binding}", "index_name": "${binding.index}" }${comma}`
      );
    }
    parts.push(`  ],`);
  }

  // queues — one object so JSON.parse keeps both producers and consumers
  if (infra.queues) {
    const producers = infra.queues.producer ?? [];
    const consumers = infra.queues.consumer ?? [];
    if (producers.length > 0 || consumers.length > 0) {
      const queueParts: string[] = [];
      if (producers.length > 0) {
        queueParts.push(`    "producers": [`);
        for (const [i, q] of producers.entries()) {
          const comma = i < producers.length - 1 ? "," : "";
          queueParts.push(
            `      { "queue": "${q}", "binding": "${queueProducerBinding(q)}" }${comma}`
          );
        }
        queueParts.push(consumers.length > 0 ? `    ],` : `    ]`);
      }
      if (consumers.length > 0) {
        queueParts.push(`    "consumers": [`);
        for (const [i, q] of consumers.entries()) {
          const comma = i < consumers.length - 1 ? "," : "";
          queueParts.push(`      { "queue": "${q}" }${comma}`);
        }
        queueParts.push(`    ]`);
      }
      parts.push(`  "queues": {`);
      parts.push(...queueParts);
      parts.push(`  },`);
    }
  }

  // durable_objects
  if (infra.durableObjects && infra.durableObjects.length > 0) {
    parts.push(`  "durable_objects": { "bindings": [`);
    for (const [i, doBinding] of infra.durableObjects.entries()) {
      const comma = i < infra.durableObjects.length - 1 ? "," : "";
      parts.push(
        `    { "name": "${doBinding.name}", "class_name": "${doBinding.className}" }${comma}`
      );
    }
    parts.push(`  ] },`);
  }

  parts.push(`}`);
  return parts.join("\n") + "\n";
}

/**
 * Generate a .dev.vars template from a manifest.
 */
export function generateDevVars(manifest: WorkerManifest): string {
  const lines: string[] = [];
  lines.push(`# ${manifest.name} — Environment Variables`);
  lines.push(`# Auto-generated from worker manifest schema`);
  lines.push(``);
  for (const [name, def] of Object.entries(manifest.vars)) {
    if (def.type === "secret") {
      lines.push(`${name}=placeholder_${name.toLowerCase()}`);
    }
  }
  lines.push(``);
  return lines.join("\n");
}

/**
 * Run all validators for a worker.
 */
export function validateAll(
  workerName: string,
  manifest: WorkerManifest,
  files: {
    wranglerJsonc: string;
    rootWranglerJsonc: string;
    devVars: string;
  }
): { worker: string; passed: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [
    ...validateWranglerJsonc(workerName, manifest, files.wranglerJsonc),
    ...validateRootSecrets(workerName, manifest, files.rootWranglerJsonc),
    ...validateDevVars(workerName, manifest, files.devVars),
  ];
  return {
    worker: workerName,
    passed: errors.filter((e) => e.severity === "error").length === 0,
    errors,
  };
}
