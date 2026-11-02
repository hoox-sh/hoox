/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Worker Manifest Schema — canonical definition of what each worker expects.
 */

/**
 * Placement in the HOOX stack.
 *
 * - `core` — mesh isolate; typically seeded by init/setup.
 * - `optional` — satellite isolate (PYNE family); enable/wire on demand.
 * - `planned` — catalogued for later; CLI explains it is not shippable yet.
 */
export type WorkerTier = "core" | "optional" | "planned";

export interface WorkerManifest {
  /** Worker name (e.g. "trade-worker") */
  name: string;
  /** Path relative to project root (e.g. "workers/trade-worker") */
  path: string;
  /**
   * Default for `workers.<name>.enabled` in the root wrangler.jsonc catalog.
   * Used by `hoox workers enable|disable` and when seeding missing workers.
   */
  defaultEnabled: boolean;
  /**
   * Stack placement. Omitted means `core`.
   * Optional satellites (pyne-worker, pyne-agent-worker) are enabled on demand.
   */
  tier?: WorkerTier;
  /** One-line description for enable/wire prompts and `hoox workers catalog`. */
  description?: string;
  /** GitHub repo slug under the hoox-sh org (defaults to `name`). */
  repo?: string;
  /** Alternate names (e.g. pynets-worker was pine-worker). */
  aliases?: string[];
  /** Vars the worker declares in its wrangler.jsonc `vars` section */
  vars: Record<string, VarDef>;
  /** Service bindings this worker calls */
  services: ServiceBindingDef[];
  /**
   * Incoming service bindings other workers should gain when this worker
   * is wired into the stack (reverse of `services`).
   */
  callers?: CallerBindingDef[];
  /** Infrastructure bindings this worker needs */
  infrastructure: InfraBindings;
  /** Middleware this worker imports from @hoox-sh/hoox-shared */
  middleware: string[];
  /** Cron triggers (empty array = none) */
  cron?: string[];
}

export interface VarDef {
  type: "secret" | "plaintext";
  description: string;
  /** Default value for plaintext vars (optional) */
  default?: string;
  /** When true, missing from root secrets / .dev.vars is a warning. */
  optional?: boolean;
}

export interface ServiceBindingDef {
  binding: string;
  service: string;
  description: string;
  /** When true, a missing binding is a warning (satellite / opt-in). */
  optional?: boolean;
}

/** Caller that should bind *to* this worker when it is wired into the stack. */
export interface CallerBindingDef {
  /** Logical worker that gains the service binding. */
  worker: string;
  binding: string;
  description: string;
}

export interface InfraBindings {
  kv?: KVBindingDef[];
  d1?: D1BindingDef[];
  r2?: R2BindingDef[];
  queues?: QueueBindingDef;
  ai?: boolean;
  vectorize?: VectorizeBindingDef[];
  analyticsEngine?: boolean;
  durableObjects?: DOBindingDef[];
  browser?: boolean;
}

export interface KVBindingDef {
  binding: string;
  description: string;
}

export interface D1BindingDef {
  binding: string;
  database: string;
  description?: string;
}

export interface R2BindingDef {
  binding: string;
  bucket: string;
  description?: string;
}

export interface QueueBindingDef {
  producer?: string[];
  consumer?: string[];
}

export interface VectorizeBindingDef {
  binding: string;
  index: string;
}

export interface DOBindingDef {
  name: string;
  className: string;
}

export interface ValidationError {
  worker: string;
  severity: "error" | "warning";
  message: string;
  file?: string;
}

export interface ValidationReport {
  worker: string;
  passed: boolean;
  errors: ValidationError[];
}
