/**
 * Copyright (c) 2026 HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Opt-in tenant isolation for worker state.
 *
 * Self-hosted single-tenant deployments are unaffected: every helper below
 * is a no-op unless `TENANT_MODE` is explicitly enabled (`"true"` / `"1"`).
 * Setting `TENANT_ID` alone does NOT enable scoping — the flag is the switch.
 *
 * When enabled, `TENANT_ID` (required, `[A-Za-z0-9_-]{1,64}`) namespaces:
 * - KV keys and Durable Object names via {@link scopeKey}
 * - R2 object keys via {@link scopeR2Key} (`t-<id>/…`, R2-safe charset)
 * - queue / service payloads via {@link withTenantId}
 *
 * Misconfiguration fails loudly: resolving a scope with the flag on and an
 * invalid id throws. Message-carried ids (shared queue consumer) are
 * validated leniently instead — untrusted input must never throw.
 */

import type { TenantContext } from "./types";

export interface TenantEnv {
  TENANT_ID?: string;
  TENANT_MODE?: string;
}

export interface TenantScope {
  enabled: boolean;
  tenantId: string | null;
}

const TENANT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isTenantFlagOn(env: TenantEnv | undefined | null): boolean {
  const v = env?.TENANT_MODE;
  return v === "true" || v === "1";
}

/**
 * Resolve the tenant scope for an env. Throws when the flag is on but the
 * id is missing/invalid (fail-closed platform deploys). Returns disabled
 * without throwing when the flag is off (self-host default).
 */
export function tenantScope(env: TenantEnv | undefined | null): TenantScope {
  if (!isTenantFlagOn(env)) return { enabled: false, tenantId: null };
  const id = (env?.TENANT_ID ?? "").trim();
  if (!id || !TENANT_ID_RE.test(id)) {
    throw new Error(
      "TENANT_MODE is enabled but TENANT_ID is missing or invalid (expected [A-Za-z0-9_-], 1-64 chars)"
    );
  }
  return { enabled: true, tenantId: id };
}

/** True when tenant scoping is active (flag on + valid id). Never throws. */
export function isTenantMode(env: TenantEnv | undefined | null): boolean {
  try {
    return tenantScope(env).enabled;
  } catch {
    return false;
  }
}

/**
 * Effective tenant for a scope decision: the env tenant when the flag is on,
 * otherwise a message-carried id (shared queue consumer path), else null.
 * Lenient on message input — untrusted data never throws here.
 */
export function effectiveTenantId(
  env: TenantEnv | undefined | null,
  msg?: { tenantId?: unknown }
): string | null {
  if (isTenantFlagOn(env)) {
    // Flag on: env is authoritative, misconfiguration throws loudly.
    return tenantScope(env).tenantId;
  }
  const m = typeof msg?.tenantId === "string" ? msg.tenantId.trim() : "";
  return m && TENANT_ID_RE.test(m) ? m : null;
}

/** Namespace a KV key or DO name: `t/<id>/<key>` when scoped, else `key`. */
export function scopeKey(
  env: TenantEnv | undefined | null,
  key: string,
  msg?: { tenantId?: unknown }
): string {
  const id = effectiveTenantId(env, msg);
  return id ? `t/${id}/${key}` : key;
}

/** Namespace an R2 object key: `t-<id>/<key>` (colon-free for key guards). */
export function scopeR2Key(
  env: TenantEnv | undefined | null,
  key: string,
  msg?: { tenantId?: unknown }
): string {
  const id = effectiveTenantId(env, msg);
  return id ? `t-${id}/${key}` : key;
}

/** Attach `tenantId` to an outbound payload object when scoped. */
export function withTenantId<T extends object>(
  env: TenantEnv | undefined | null,
  obj: T
): T & { tenantId?: string } {
  const ts = tenantScope(env);
  return ts.enabled && ts.tenantId ? { ...obj, tenantId: ts.tenantId } : obj;
}

/** Build the shared {@link TenantContext} when scoped, else null. */
export function tenantContextOf(
  env: TenantEnv | undefined | null
): TenantContext | null {
  const ts = tenantScope(env);
  return ts.enabled && ts.tenantId ? { tenantId: ts.tenantId } : null;
}
