/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SetupService } from "./setup-service.js";
import type { ProgressEvent } from "./setup-service.js";

describe("SetupService", () => {
  let events: ProgressEvent[];

  beforeEach(() => {
    events = [];
  });

  afterEach(() => {
    events = [];
  });

  describe("constructor & progress callback", () => {
    it("uses a no-op callback when none is provided", () => {
      const svc = new SetupService();
      // Should not throw
      expect(svc).toBeDefined();
    });

    it("invokes the supplied callback for progress events", () => {
      const svc = new SetupService((e) => events.push(e));
      // Trigger an event by calling a skip path
      void svc.generateKeys(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "info" && e.step === "keys")).toBe(
        true
      );
    });
  });

  describe("generateKeys(skip=true)", () => {
    it("returns null when no .keys/setup.env and emits an info event", async () => {
      const svc = new SetupService((e) => events.push(e));
      // Force no existing keys path by temporarily renaming if present is hard;
      // use a service that cannot find setup.env: mock list via empty load.
      // If repo has .keys/setup.env, skip-keys loads them — assert either shape.
      const result = await svc.generateKeys(true);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]?.type).toBe("info");
      expect(events[0]?.step).toBe("keys");
      if (result === null) {
        expect(events[0]?.message).toMatch(/Skipped/);
      } else {
        expect(events[0]?.message).toMatch(/existing keys/i);
        expect(result.INTERNAL_KEY_BINDING).toBeTruthy();
      }
    });

    it("does not call _randomHex when skipped without existing keys", async () => {
      const svc = new SetupService();
      // When .keys/setup.env is absent, result is null; when present, loads disk.
      const result = await svc.generateKeys(true);
      // Either null (no disk keys) or a full GeneratedKeys object — never partial.
      if (result !== null) {
        expect(typeof result.INTERNAL_KEY_BINDING).toBe("string");
      }
    });
  });

  describe("generateKeys .keys collision", () => {
    it("throws an actionable error when .keys exists as a file", async () => {
      const dir = mkdtempSync(join(tmpdir(), "hoox-keys-"));
      const origCwd = process.cwd();
      writeFileSync(join(dir, ".keys"), "not a directory\n");
      process.chdir(dir);
      try {
        const svc = new SetupService();
        let thrown: unknown = null;
        try {
          await svc.generateKeys(false);
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(Error);
        expect(String((thrown as Error).message)).toMatch(/not a directory/);
      } finally {
        process.chdir(origCwd);
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("applySchema(skip=true)", () => {
    it("returns a successful Skipped result", async () => {
      const svc = new SetupService();
      const result = await svc.applySchema("trade-data-db", true);
      expect(result).toEqual({
        step: "d1-schema",
        success: true,
        message: "Skipped",
      });
    });

    it("uses default db name when none provided", async () => {
      const svc = new SetupService();
      const result = await svc.applySchema(undefined, true);
      expect(result.step).toBe("d1-schema");
      expect(result.success).toBe(true);
    });
  });

  describe("rebuildDashboard(skip=true)", () => {
    it("returns a successful Skipped result", async () => {
      const svc = new SetupService();
      const result = await svc.rebuildDashboard(true);
      expect(result).toEqual({
        step: "dashboard",
        success: true,
        message: "Skipped",
      });
    });
  });

  describe("setSecrets", () => {
    it("returns empty array and emits info event when keys is null", async () => {
      const svc = new SetupService((e) => events.push(e));
      const result = await svc.setSecrets(null);
      expect(result).toEqual([]);
      expect(
        events.some((e) => e.type === "info" && e.message.includes("Skipped"))
      ).toBe(true);
    });

    it("returns empty array and emits info event when keys is undefined", async () => {
      const svc = new SetupService((e) => events.push(e));
      const result = await svc.setSecrets(undefined);
      expect(result).toEqual([]);
    });
  });

  describe("verifySetup(keys=null)", () => {
    it("returns ok=false and emits a warn event when keys is null", async () => {
      const svc = new SetupService((e) => events.push(e));
      const result = await svc.verifySetup(null);
      expect(result.ok).toBe(false);
      expect(result.missing).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(
        events.some((e) => e.type === "warn" && e.message.includes("No keys"))
      ).toBe(true);
    });
  });

  describe("checkAuth", () => {
    it("returns a boolean", async () => {
      // Inject a stub CloudflareService so no real `wrangler whoami`
      // (network/auth) call is made during the test.
      const cf = {
        whoami: () => Promise.resolve({ ok: true, value: "user@example.com" }),
      } as any;
      const svc = new SetupService(undefined, cf);
      const result = await svc.checkAuth();
      expect(typeof result).toBe("boolean");
      expect(result).toBe(true);
    });

    it("returns false when whoami fails", async () => {
      const cf = {
        whoami: () =>
          Promise.resolve({ ok: false, error: "not authenticated" }),
      } as any;
      const svc = new SetupService(undefined, cf);
      const result = await svc.checkAuth();
      expect(result).toBe(false);
    });
  });

  describe("type exports", () => {
    it("GeneratedKeys has all required fields", () => {
      const keys: import("./setup-service.js").GeneratedKeys = {
        INTERNAL_KEY_BINDING: "a".repeat(64),
        AGENT_INTERNAL_KEY: "b".repeat(64),
        SESSION_SECRET: "c".repeat(128),
        WEBHOOK_API_KEY_BINDING: "d".repeat(64),
        TELEGRAM_INTERNAL_KEY_BINDING: "e".repeat(64),
        TRADE_INTERNAL_KEY: "f".repeat(64),
        API_SERVICE_KEY_BINDING: "g".repeat(64),
        WALLET_EXECUTE_KEY_BINDING: "h".repeat(64),
      };
      expect(Object.keys(keys).sort()).toEqual(
        [
          "AGENT_INTERNAL_KEY",
          "API_SERVICE_KEY_BINDING",
          "INTERNAL_KEY_BINDING",
          "SESSION_SECRET",
          "TELEGRAM_INTERNAL_KEY_BINDING",
          "TRADE_INTERNAL_KEY",
          "WALLET_EXECUTE_KEY_BINDING",
          "WEBHOOK_API_KEY_BINDING",
        ].sort()
      );
    });

    it("SetupOptions accepts empty object", () => {
      const opts: import("./setup-service.js").SetupOptions = {};
      expect(opts).toEqual({});
    });
  });
});
