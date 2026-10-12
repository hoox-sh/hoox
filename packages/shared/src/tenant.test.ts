/**
 * Copyright (c) 2026 HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "bun:test";
import {
  effectiveTenantId,
  isTenantFlagOn,
  isTenantMode,
  scopeKey,
  scopeR2Key,
  tenantContextOf,
  tenantScope,
  withTenantId,
} from "./tenant";

describe("tenantScope", () => {
  it("is disabled without env (self-host default)", () => {
    expect(tenantScope(undefined)).toEqual({ enabled: false, tenantId: null });
    expect(tenantScope({})).toEqual({ enabled: false, tenantId: null });
    expect(tenantScope({ TENANT_ID: "abc" })).toEqual({
      enabled: false,
      tenantId: null,
    });
  });

  it("enables with flag + valid id", () => {
    expect(tenantScope({ TENANT_MODE: "true", TENANT_ID: "tenant-1" })).toEqual(
      { enabled: true, tenantId: "tenant-1" }
    );
    expect(tenantScope({ TENANT_MODE: "1", TENANT_ID: "a_b-c" })).toEqual({
      enabled: true,
      tenantId: "a_b-c",
    });
  });

  it("throws on flag without valid id (fail-closed)", () => {
    expect(() => tenantScope({ TENANT_MODE: "true" })).toThrow();
    expect(() => tenantScope({ TENANT_MODE: "1", TENANT_ID: "  " })).toThrow();
    expect(() =>
      tenantScope({ TENANT_MODE: "true", TENANT_ID: "evil/../x" })
    ).toThrow();
  });
});

describe("key scoping", () => {
  it("scopeKey is identity when off", () => {
    expect(scopeKey(undefined, "trade:kill_switch")).toBe("trade:kill_switch");
    expect(scopeKey({ TENANT_ID: "abc" }, "k")).toBe("k");
  });

  it("scopeKey namespaces when on", () => {
    const env = { TENANT_MODE: "true", TENANT_ID: "acme" };
    expect(scopeKey(env, "trade:kill_switch")).toBe("t/acme/trade:kill_switch");
    expect(scopeR2Key(env, "trade-reports/x.json")).toBe(
      "t-acme/trade-reports/x.json"
    );
  });

  it("scopeKey uses message tenant on shared path", () => {
    expect(scopeKey({}, "k", { tenantId: "m1" })).toBe("t/m1/k");
    expect(scopeKey({}, "k", { tenantId: "evil/../x" })).toBe("k");
    expect(scopeKey({}, "k", {})).toBe("k");
  });

  it("env wins over message when flag is on", () => {
    const env = { TENANT_MODE: "1", TENANT_ID: "env1" };
    expect(scopeKey(env, "k", { tenantId: "msg1" })).toBe("t/env1/k");
  });
});

describe("helpers", () => {
  it("isTenantFlagOn / isTenantMode", () => {
    expect(isTenantFlagOn({ TENANT_MODE: "true" })).toBe(true);
    expect(isTenantFlagOn({ TENANT_MODE: "yes" })).toBe(false);
    expect(isTenantMode({ TENANT_MODE: "true", TENANT_ID: "a" })).toBe(true);
    // invalid id never reports active
    expect(isTenantMode({ TENANT_MODE: "true", TENANT_ID: "!!" })).toBe(false);
    expect(isTenantMode(undefined)).toBe(false);
  });

  it("withTenantId spreads only when on", () => {
    expect(withTenantId(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(
      withTenantId({ TENANT_MODE: "true", TENANT_ID: "t1" }, { a: 1 })
    ).toEqual({ a: 1, tenantId: "t1" });
  });

  it("tenantContextOf builds shared context when on", () => {
    expect(tenantContextOf(undefined)).toBeNull();
    expect(tenantContextOf({ TENANT_MODE: "true", TENANT_ID: "t1" })).toEqual({
      tenantId: "t1",
    });
  });

  it("effectiveTenantId prefers env, falls back to message", () => {
    expect(effectiveTenantId(undefined, { tenantId: "m" })).toBe("m");
    expect(effectiveTenantId(undefined)).toBeNull();
    expect(
      effectiveTenantId(
        { TENANT_MODE: "true", TENANT_ID: "e" },
        { tenantId: "m" }
      )
    ).toBe("e");
  });
});
