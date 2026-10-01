/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as clack from "@clack/prompts";
import {
  UpdateService,
  resolveUpdatePlan,
  buildUpdateCommand,
} from "./update-service.js";

function createMockPrereqs(
  overrides?: Partial<{
    outdated: boolean;
    current: string | undefined;
    minimum: string;
  }>
) {
  const defaults = {
    outdated: false,
    current: "4.0.0" as string | undefined,
    minimum: "3.88.0",
  };
  const config = { ...defaults, ...overrides };

  return {
    checkWranglerVersion: mock(() => Promise.resolve(config)),
    checkBun: mock(() => Promise.resolve({})),
    checkGit: mock(() => Promise.resolve({})),
    checkNode: mock(() => Promise.resolve({})),
    checkWrangler: mock(() => Promise.resolve({})),
    checkCloudflareAuth: mock(() => Promise.resolve({})),
    checkDocker: mock(() => Promise.resolve({})),
    checkRepository: mock(() => Promise.resolve({})),
    runAll: mock(() => Promise.resolve({ checks: [], allPassed: true })),
  };
}

describe("UpdateService", () => {
  afterEach(() => {
    mock.restore();
  });

  describe("checkAndPromptUpdate", () => {
    it("returns updated=false when wrangler is up to date", async () => {
      const mockPrereqs = createMockPrereqs({ outdated: false });
      const svc = new UpdateService(undefined, mockPrereqs as any);

      const result = await svc.checkAndPromptUpdate({ yes: true });

      expect(result.updated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("silent mode still reports up-to-date without throwing", async () => {
      const mockPrereqs = createMockPrereqs({ outdated: false });
      const svc = new UpdateService(undefined, mockPrereqs as any);
      const result = await svc.checkAndPromptUpdate({
        yes: true,
        silent: true,
      });
      expect(result.updated).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it("silent without --yes is check-only and never installs when outdated", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: true,
        current: "3.0.0",
      });
      const updateRunner = mock(() =>
        Promise.resolve({ exitCode: 0, stderr: "" })
      );
      const svc = new UpdateService(
        undefined,
        mockPrereqs as any,
        updateRunner
      );

      const result = await svc.checkAndPromptUpdate({
        yes: false,
        silent: true,
      });

      expect(result.updated).toBe(false);
      expect(result.error).toBeUndefined();
      expect(updateRunner).not.toHaveBeenCalled();
    });

    it("auto-updates when wrangler is outdated and --yes is set", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: true,
        current: "3.87.0",
      });
      // Stub the update runner so no real `bun update wrangler` (network)
      // install is performed during the test.
      const updateRunner = mock(() =>
        Promise.resolve({ exitCode: 0, stderr: "" })
      );
      const svc = new UpdateService(
        undefined,
        mockPrereqs as any,
        updateRunner
      );

      const result = await svc.checkAndPromptUpdate({ yes: true });

      expect(typeof result.updated).toBe("boolean");
      expect(updateRunner).toHaveBeenCalled();
    });

    it("skips update when user declines the prompt", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: true,
        current: "3.0.0",
        minimum: "3.88.0",
      });
      spyOn(clack, "confirm").mockImplementation(async () => false);
      const updateRunner = mock(() =>
        Promise.resolve({ exitCode: 0, stderr: "" })
      );
      // Force TTY path (no --yes) so promptUpdate runs
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });
      try {
        const svc = new UpdateService(
          undefined,
          mockPrereqs as any,
          updateRunner
        );
        // Stub checkLatestVersion via fetch
        const origFetch = globalThis.fetch;
        globalThis.fetch = mock(
          async () =>
            new Response(JSON.stringify({ version: "4.1.0" }), { status: 200 })
        ) as unknown as typeof fetch;

        const result = await svc.checkAndPromptUpdate({ yes: false });
        expect(result.updated).toBe(false);
        expect(updateRunner).not.toHaveBeenCalled();
        globalThis.fetch = origFetch;
      } finally {
        Object.defineProperty(process.stdout, "isTTY", {
          value: origIsTTY,
          configurable: true,
        });
      }
    });

    it("returns error when version check throws", async () => {
      const mockPrereqs = {
        ...createMockPrereqs(),
        checkWranglerVersion: mock(async () => {
          throw new Error("spawn failed");
        }),
      };
      const svc = new UpdateService(undefined, mockPrereqs as any);
      const result = await svc.checkAndPromptUpdate({ yes: true });
      expect(result.updated).toBe(false);
      expect(result.error).toContain("spawn failed");
    });

    it("reports failed bun update exit code", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: true,
        current: "3.0.0",
      });
      const updateRunner = mock(() =>
        Promise.resolve({ exitCode: 1, stderr: "network error\nmore" })
      );
      const svc = new UpdateService(
        undefined,
        mockPrereqs as any,
        updateRunner
      );
      const result = await svc.checkAndPromptUpdate({ yes: true });
      expect(result.updated).toBe(false);
      expect(result.error).toContain("network error");
    });
  });

  describe("updateWrangler", () => {
    it("returns result when called (does not throw)", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: false,
        current: "4.0.0",
      });
      const updateRunner = mock(() =>
        Promise.resolve({ exitCode: 0, stderr: "" })
      );
      const svc = new UpdateService(
        undefined,
        mockPrereqs as any,
        updateRunner
      );

      const result = await svc.updateWrangler();

      expect(typeof result.updated).toBe("boolean");
      expect(updateRunner).toHaveBeenCalled();
    });

    it("errors when wrangler is not installed", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: true,
        current: undefined,
      });
      const svc = new UpdateService(undefined, mockPrereqs as any);
      const result = await svc.updateWrangler();
      expect(result.updated).toBe(false);
      expect(result.error).toContain("not installed");
    });

    it("reports version unchanged when runner succeeds but version same", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: false,
        current: "4.0.0",
      });
      const updateRunner = mock(() =>
        Promise.resolve({ exitCode: 0, stderr: "" })
      );
      const svc = new UpdateService(
        undefined,
        mockPrereqs as any,
        updateRunner
      );
      const result = await svc.updateWrangler();
      // previous === new → updated false
      expect(result.updated).toBe(false);
      expect(result.newVersion).toBe("4.0.0");
    });

    it("reports runner throw as error", async () => {
      const mockPrereqs = createMockPrereqs({ current: "4.0.0" });
      const updateRunner = mock(async () => {
        throw new Error("ENOENT");
      });
      const svc = new UpdateService(
        undefined,
        mockPrereqs as any,
        updateRunner
      );
      const result = await svc.updateWrangler();
      expect(result.updated).toBe(false);
      expect(result.error).toContain("ENOENT");
    });
  });

  describe("checkLatestVersion", () => {
    it("returns a version string or null", async () => {
      const svc = new UpdateService();
      const version = await svc.checkLatestVersion();
      expect(version === null || typeof version === "string").toBe(true);
      if (typeof version === "string") {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }, 30000);

    it("returns null when registry responds non-ok", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = mock(
        async () => new Response("nope", { status: 500 })
      ) as unknown as typeof fetch;
      try {
        const svc = new UpdateService();
        expect(await svc.checkLatestVersion()).toBeNull();
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it("returns null when fetch throws", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = mock(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch;
      try {
        const svc = new UpdateService();
        expect(await svc.checkLatestVersion()).toBeNull();
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it("returns version from registry JSON", async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = mock(
        async () =>
          new Response(JSON.stringify({ version: "4.99.0" }), { status: 200 })
      ) as unknown as typeof fetch;
      try {
        const svc = new UpdateService();
        expect(await svc.checkLatestVersion()).toBe("4.99.0");
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  describe("default updateRunner", () => {
    it("spawns bun update wrangler when no runner injected", async () => {
      const mockPrereqs = createMockPrereqs({
        outdated: true,
        current: "3.0.0",
      });
      const realSpawn = Bun.spawn;
      (Bun as unknown as Record<string, unknown>).spawn = mock(() => ({
        stdout: new Blob([""]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        kill: mock(() => {}),
      }));

      try {
        // After successful update, version check still returns 3.0.0 → unchanged
        const svc = new UpdateService(undefined, mockPrereqs as any);
        const result = await svc.checkAndPromptUpdate({ yes: true });
        expect(typeof result.updated).toBe("boolean");
        expect(Bun.spawn).toHaveBeenCalled();
      } finally {
        (Bun as unknown as Record<string, unknown>).spawn = realSpawn;
      }
    });
  });

  describe("resolveUpdatePlan", () => {
    const temps: string[] = [];
    afterEach(() => {
      for (const t of temps.splice(0)) {
        try {
          rmSync(t, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    });

    it("resolves project mode at the monorepo root", () => {
      const root = mkdtempSync(join(tmpdir(), "hoox-upd-"));
      temps.push(root);
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "hoox" })
      );
      expect(resolveUpdatePlan(root)).toEqual({ mode: "project", cwd: root });
      expect(buildUpdateCommand(resolveUpdatePlan(root))).toEqual({
        cmd: ["bun", "update", "wrangler"],
        cwd: root,
      });
    });

    it("walks up from a nested worker dir to the monorepo root", () => {
      const root = mkdtempSync(join(tmpdir(), "hoox-upd-"));
      temps.push(root);
      const nested = join(root, "workers", "trade-worker");
      mkdirSync(nested, { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ name: "hoox" })
      );
      writeFileSync(
        join(nested, "package.json"),
        JSON.stringify({ name: "trade-worker" })
      );
      expect(resolveUpdatePlan(nested)).toEqual({
        mode: "project",
        cwd: root,
      });
    });

    it("resolves global mode outside the monorepo", () => {
      const outside = mkdtempSync(join(tmpdir(), "hoox-upd-"));
      temps.push(outside);
      writeFileSync(
        join(outside, "package.json"),
        JSON.stringify({ name: "some-user-project" })
      );
      const plan = resolveUpdatePlan(outside);
      expect(plan.mode).toBe("global");
      expect(buildUpdateCommand(plan)).toEqual({
        cmd: ["bun", "add", "-g", "wrangler@latest"],
        cwd: outside,
      });
    });
  });
});
