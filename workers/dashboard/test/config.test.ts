/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, afterEach, describe, expect, test } from "bun:test";

const originalEnv = { ...process.env };

describe("dashboard config", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("uses fallback when SESSION_SECRET is missing", async () => {
    delete (process.env as { SESSION_SECRET?: string }).SESSION_SECRET;

    const mod = await import("../src/lib/config");
    expect(mod).toBeDefined();
  });

  test("allows AUTH_TYPE=none in development", async () => {
    process.env.AUTH_TYPE = "none";
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    try {
      const { assertProductionAuthConfigured } =
        await import("../src/lib/config");
      expect(() => assertProductionAuthConfigured()).not.toThrow();
    } finally {
      env.NODE_ENV = prevNodeEnv;
    }
  });

  test("resolves scoped internal auth keys with dashboard aliases", async () => {
    process.env.D1_INTERNAL_KEY = "d1-read-alias";
    process.env.TRADE_INTERNAL_KEY = "trade-exec-alias";
    process.env.TELEGRAM_INTERNAL_KEY = "telegram-alias";

    const { getInternalAuthKeys } = await import("../src/lib/config");
    const keys = getInternalAuthKeys();
    expect(keys.d1Read).toBe("d1-read-alias");
    expect(keys.tradeExecute).toBe("trade-exec-alias");
    expect(keys.telegram).toBe("telegram-alias");
  });

  test("rejects AUTH_TYPE=none in production", async () => {
    process.env.AUTH_TYPE = "none";
    const env = process.env as Record<string, string | undefined>;
    const prevNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "production";

    try {
      const { assertProductionAuthConfigured } =
        await import("../src/lib/config");
      expect(() => assertProductionAuthConfigured()).toThrow(/not permitted/);
    } finally {
      env.NODE_ENV = prevNodeEnv;
    }
  });

  test("resolveTradingViewWebhookUrl uses HOOX_URL and extracts prefix", async () => {
    process.env.HOOX_URL = "https://hoox.cryptolinx.workers.dev";
    delete process.env.HOOX_GATEWAY_URL;

    const {
      resolveTradingViewWebhookUrl,
      resolveHooxGatewayUrl,
      extractWorkersSubdomainPrefix,
    } = await import("../src/lib/config");

    expect(resolveHooxGatewayUrl()).toBe("https://hoox.cryptolinx.workers.dev");
    expect(
      extractWorkersSubdomainPrefix("https://hoox.cryptolinx.workers.dev")
    ).toBe("cryptolinx");

    const resolved = resolveTradingViewWebhookUrl();
    expect(resolved.resolved).toBe(true);
    expect(resolved.subdomainPrefix).toBe("cryptolinx");
    expect(resolved.url).toBe(
      "https://hoox.cryptolinx.workers.dev/webhook/tradingview"
    );
  });

  test("resolveTradingViewWebhookUrl derives from sibling worker URL", async () => {
    delete (process.env as { HOOX_URL?: string }).HOOX_URL;
    delete process.env.HOOX_GATEWAY_URL;
    process.env.D1_WORKER_URL = "https://d1-worker.myprefix.workers.dev";

    const { resolveTradingViewWebhookUrl } = await import("../src/lib/config");
    const resolved = resolveTradingViewWebhookUrl();
    expect(resolved.resolved).toBe(true);
    expect(resolved.gatewayUrl).toBe("https://hoox.myprefix.workers.dev");
    expect(resolved.url).toBe(
      "https://hoox.myprefix.workers.dev/webhook/tradingview"
    );
    expect(resolved.subdomainPrefix).toBe("myprefix");
  });
});
