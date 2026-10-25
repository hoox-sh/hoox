/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { redact, redactArgv, stripAnsi } from "./redact.ts";

describe("redact", () => {
  test("strips ansi and labeled secrets", () => {
    const raw = "\u001B[31mtoken=abcd1234\u001B[0m";
    const cleaned = redact(stripAnsi(raw));
    expect(cleaned.text).not.toContain("abcd1234");
    expect(cleaned.text).toContain("[REDACTED]");
    expect(cleaned.count).toBeGreaterThan(0);
  });

  test("redacts bearer tokens, key prefixes, and url userinfo", () => {
    const input = [
      "Authorization: Bearer abcdefghij.klmnop",
      "sk_live_abcdefghij",
      "https://user:s3cret@example.com/hook",
    ].join("\n");
    const cleaned = redact(input);
    expect(cleaned.text).not.toContain("abcdefghij");
    expect(cleaned.text).not.toContain("s3cret");
    expect(cleaned.count).toBeGreaterThanOrEqual(3);
  });

  test("redacts JSON and env secret values", () => {
    const secret = "hoox-session-secret-9f3c1a";
    // Catalog secrets, including names the suffix rule misses.
    const leaked = [
      "SESSION_SECRET",
      "CLOUDFLARE_API_TOKEN",
      "EXCHANGE_KEY_BINDING",
      "INTERNAL_KEY_BINDING",
      "EMAIL_PASS_BINDING",
      "API_SERVICE_KEY_BINDING",
      "TELEGRAM_INTERNAL_KEY_BINDING",
      "WALLET_EXECUTE_KEY_BINDING",
      "EXCHANGE_TESTNET_KEY_BINDING",
      "EMAIL_USER_BINDING",
      "EMAIL_HOST_BINDING",
      "TG_CHAT_ID_BINDING",
      "AUTHORIZED_CHAT_IDS",
      "TELEGRAM_ALLOWED_CHAT_IDS",
      "ALERT_WEBHOOK_URL",
      "REPORT_TELEGRAM_CHAT_ID",
    ];
    const shown = {
      PUBLIC_URL: "https://dashboard.example.test/health",
      SUBDOMAIN_PREFIX: "myapp",
      DASHBOARD_USER: "admin",
      CLOUDFLARE_ACCOUNT_ID: "acct-visible-001",
    };
    const doc: Record<string, string> = {};
    for (const name of leaked) doc[name] = secret;
    Object.assign(doc, shown);
    const input = [
      ...leaked.map((name) =>
        name === "CLOUDFLARE_API_TOKEN"
          ? `${name}=cf-${secret}`
          : `${name}=${secret}`
      ),
      `export DB_PASSWORD=${secret}`,
      `SUBDOMAIN_PREFIX=${shown.SUBDOMAIN_PREFIX}`,
      `DASHBOARD_USER=${shown.DASHBOARD_USER}`,
      `CLOUDFLARE_ACCOUNT_ID=${shown.CLOUDFLARE_ACCOUNT_ID}`,
      // config env show --json pretty-prints. MCP does not pass --quiet.
      JSON.stringify(
        {
          ...doc,
          CLOUDFLARE_API_TOKEN: `cf-${secret}`,
        },
        null,
        2
      ),
      JSON.stringify({ key: "notes", value: secret }),
      JSON.stringify({ key: "worker-id" }),
    ].join("\n");
    const cleaned = redact(input);
    expect(cleaned.text).not.toContain(secret);
    expect(cleaned.text).not.toContain(`cf-${secret}`);
    expect(cleaned.text).toContain(shown.PUBLIC_URL);
    expect(cleaned.text).toContain(
      `SUBDOMAIN_PREFIX=${shown.SUBDOMAIN_PREFIX}`
    );
    expect(cleaned.text).toContain(`DASHBOARD_USER=${shown.DASHBOARD_USER}`);
    expect(cleaned.text).toContain(
      `CLOUDFLARE_ACCOUNT_ID=${shown.CLOUDFLARE_ACCOUNT_ID}`
    );
    expect(cleaned.text).toContain(
      `"CLOUDFLARE_ACCOUNT_ID": "${shown.CLOUDFLARE_ACCOUNT_ID}"`
    );
    expect(cleaned.text).toContain('"DASHBOARD_USER": "admin"');
    expect(cleaned.text).toContain('{"key":"worker-id"}');
    expect(cleaned.text).toContain('{"key":"notes","value":"[REDACTED]"}');
    for (const name of leaked) {
      expect(cleaned.text).toContain(`${name}=[REDACTED]`);
      expect(cleaned.text).toContain(`"${name}": "[REDACTED]"`);
    }
    expect(cleaned.text).toContain("export DB_PASSWORD=[REDACTED]");
    expect(cleaned.count).toBeGreaterThanOrEqual(5);
  });

  test("redacts secret flag values in argv", () => {
    const shown = redactArgv([
      "pyne",
      "run",
      "strategy.pine",
      "--api-key",
      "sk_live_abcdefghij",
      "--url",
      "https://pyne.example",
    ]);
    expect(shown.argv).toEqual([
      "pyne",
      "run",
      "strategy.pine",
      "--api-key",
      "[REDACTED]",
      "--url",
      "https://pyne.example",
    ]);
    expect(shown.count).toBe(1);
  });
});
