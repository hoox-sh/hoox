/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Open-core tenant entitlement types (verify-prep, NO enforcement).
 *
 * This module is intentionally thin: pure types + pure helpers only.
 * No fetch, no KV/D1, no Stripe, no secrets. It lives in the open core so
 * self-hosted single-tenant deployments keep working unchanged, while the
 * commercial layer can build `verifyTenant` (hx_live_…) on top of these
 * shapes (see OPEN_CORE_FEATURE_SPLIT.md: tenant billing/metering/quotas
 * are commercial; basic `TenantContext` stays open).
 *
 * Enforcement (cache lookup, quota checks, 401/402/429) does NOT live here.
 */

import type { TenantContext } from "./types";

/** Billable capability scopes — one account, one key format, per-service-kind. */
export type EntitlementScope =
  | "trade"
  | "signal"
  | "pyne:run"
  | "agent:chat"
  | "axis:stream";

/**
 * Tenant context enriched with commercial entitlement data.
 * Produced by the commercial `verifyTenant` hook; open self-host paths
 * simply never attach scopes and keep working as before.
 */
export interface EntitledContext extends TenantContext {
  /** Granted capability scopes for this tenant/key. */
  scopes: EntitlementScope[];
  /** Plan id from the console system-of-record (e.g. "edge", "pro"). */
  plan: string;
  /** Optional per-scope/meter numeric caps (e.g. { "pyne_calls": 500000 }). */
  limits?: Record<string, number>;
  /** True when the caller presented a hosted `hx_live_…` tenant key. */
  tenantPassthrough?: boolean;
}

/**
 * Pure scope check — no I/O.
 * Returns false for missing/empty scope lists (fail-closed, no throw).
 */
export function hasScope(
  ctx: Pick<EntitledContext, "scopes"> | null | undefined,
  scope: EntitlementScope
): boolean {
  if (!ctx || !Array.isArray(ctx.scopes)) return false;
  return ctx.scopes.includes(scope);
}

/**
 * Pure edge-cache key builder — no I/O, no secrets.
 * Takes an already-hashed key prefix (never the raw bearer) and returns
 * the KV/D1 lookup key (`hx:<hashPrefix>`, 60s TTL at the edge).
 */
export function verifyCacheKey(keyHashPrefix: string): string {
  const clean = (keyHashPrefix ?? "").trim();
  return `hx:${clean}`;
}
