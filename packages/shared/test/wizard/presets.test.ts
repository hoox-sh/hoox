/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import {
  PRESETS,
  resolveDependencies,
  INTEGRATIONS,
  BASE_WORKERS,
  BASE_SECRETS,
} from "../../src/wizard/presets";

describe("PRESETS", () => {
  it("has 3 presets", () => {
    expect(PRESETS.length).toBe(3);
  });

  it("minimal preset has hoox and d1-worker", () => {
    const minimal = PRESETS.find((p) => p.name === "minimal");
    expect(minimal).toBeDefined();
    expect(minimal!.workers).toContain("hoox");
    expect(minimal!.workers).toContain("d1-worker");
  });

  it("full preset has all workers", () => {
    const full = PRESETS.find((p) => p.name === "full");
    expect(full).toBeDefined();
    expect(full!.workers.length).toBeGreaterThan(3);
  });
});

describe("resolveDependencies", () => {
  it("returns same list if no dependencies", () => {
    expect(resolveDependencies(["hoox"])).toEqual(["hoox"]);
  });

  it("adds d1-worker when trade-worker is selected", () => {
    const resolved = resolveDependencies(["trade-worker"]);
    expect(resolved).toContain("trade-worker");
    expect(resolved).toContain("d1-worker");
  });

  it("handles transitive dependencies", () => {
    const resolved = resolveDependencies(["trade-worker", "agent-worker"]);
    expect(resolved).toContain("d1-worker");
  });

  it("does not duplicate entries", () => {
    const resolved = resolveDependencies(["trade-worker", "d1-worker"]);
    expect(resolved.filter((w) => w === "d1-worker").length).toBe(1);
  });
});

describe("INTEGRATIONS", () => {
  it("includes all expected integrations", () => {
    const keys = INTEGRATIONS.map((i) => i.key);
    expect(keys).toContain("exchange");
    expect(keys).not.toContain("binance");
    expect(keys).not.toContain("bybit");
    expect(keys).not.toContain("mexc");
    expect(keys).toContain("wallet");
    const wallet = INTEGRATIONS.find((i) => i.key === "wallet");
    expect(wallet?.optionalSecrets?.SOLANA_PRIVATE_KEY).toBeDefined();
    expect(wallet?.optionalSecrets?.JUPITER_API_KEY).toBeDefined();
    expect(keys).toContain("email");
    expect(keys).toContain("telegram");
    expect(keys).toContain("openai");
    expect(keys).toContain("anthropic");
    expect(keys).toContain("google-ai");
    expect(keys).toContain("pyne");
    expect(keys).toContain("pyne-agent");
  });
});

describe("BASE_WORKERS", () => {
  it("includes d1-worker, hoox, agent-worker, analytics-worker, PYNE satellites", () => {
    expect(Object.keys(BASE_WORKERS)).toContain("d1-worker");
    expect(Object.keys(BASE_WORKERS)).toContain("hoox");
    expect(Object.keys(BASE_WORKERS)).toContain("agent-worker");
    expect(Object.keys(BASE_WORKERS)).toContain("analytics-worker");
    expect(Object.keys(BASE_WORKERS)).toContain("pyne-worker");
    expect(Object.keys(BASE_WORKERS)).toContain("pyne-agent-worker");
  });
});

describe("BASE_SECRETS", () => {
  it("has secrets for hoox and agent-worker", () => {
    expect(BASE_SECRETS.hoox).toContain("WEBHOOK_API_KEY_BINDING");
    expect(BASE_SECRETS["agent-worker"]).toContain("INTERNAL_KEY_BINDING");
  });
});
