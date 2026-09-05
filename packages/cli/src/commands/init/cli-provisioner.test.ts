/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unit tests for CLIProvisioner — wrangler-backed D1/KV provisioning.
 * Bun.spawn is mocked; no real Cloudflare calls.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { CLIProvisioner } from "./cli-provisioner";

const realSpawn = Bun.spawn;

type MockSpawnResult = {
  stdout: Blob;
  stderr: Blob;
  exited: Promise<number>;
};

function spawnResult(
  exitCode: number,
  stdout = "",
  stderr = ""
): MockSpawnResult {
  return {
    stdout: new Blob([stdout]),
    stderr: new Blob([stderr]),
    exited: Promise.resolve(exitCode),
  };
}

let spawnQueue: MockSpawnResult[] = [];
let spawnCalls: string[][] = [];
let spawnShouldThrow: Error | null = null;

function installSpawnMock(): void {
  const spawnMock = mock((cmd: string[]) => {
    spawnCalls.push([...cmd]);
    if (spawnShouldThrow) {
      const err = spawnShouldThrow;
      spawnShouldThrow = null;
      throw err;
    }
    return spawnQueue.shift() ?? spawnResult(1, "", "unexpected spawn call");
  });
  (Bun as Record<string, unknown>).spawn = spawnMock;
}

beforeEach(() => {
  spawnQueue = [];
  spawnCalls = [];
  spawnShouldThrow = null;
  installSpawnMock();
});

afterEach(() => {
  (Bun as Record<string, unknown>).spawn = realSpawn;
  mock.restore();
});

describe("CLIProvisioner", () => {
  describe("check", () => {
    it("returns expected resources without spawning", async () => {
      const provisioner = new CLIProvisioner();
      const result = await provisioner.check({
        d1Databases: ["hoox-db"],
        kvNamespaces: ["CONFIG_KV"],
        r2Buckets: [],
        queues: [],
      });
      expect(result.success).toBe(true);
      expect(result.created).toContain("D1:hoox-db");
      expect(result.created).toContain("KV:CONFIG_KV");
      expect(result.errors).toEqual([]);
      expect(spawnCalls.length).toBe(0);
    });

    it("maps empty plan to empty created list", async () => {
      const provisioner = new CLIProvisioner();
      const result = await provisioner.check({
        d1Databases: [],
        kvNamespaces: [],
        r2Buckets: [],
        queues: [],
      });
      expect(result.success).toBe(true);
      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("includes Vectorize indexes in the dry-run list", async () => {
      const provisioner = new CLIProvisioner();
      const result = await provisioner.check({
        d1Databases: [],
        kvNamespaces: [],
        r2Buckets: [],
        queues: [],
        vectorizeIndexes: ["hoox-rag-index"],
      });
      expect(result.created).toEqual(["Vectorize:hoox-rag-index"]);
    });

    it("lists multiple D1 and KV resources", async () => {
      const provisioner = new CLIProvisioner();
      const result = await provisioner.check({
        d1Databases: ["db-a", "db-b"],
        kvNamespaces: ["kv-1", "kv-2"],
        r2Buckets: [],
        queues: [],
      });
      expect(result.created).toEqual([
        "D1:db-a",
        "D1:db-b",
        "KV:kv-1",
        "KV:kv-2",
      ]);
    });
  });

  describe("provision", () => {
    it("creates D1 and KV resources on successful wrangler exits", async () => {
      spawnQueue.push(spawnResult(0, "Created db\n"));
      spawnQueue.push(spawnResult(0, "Created kv\n"));

      const provisioner = new CLIProvisioner();
      const result = await provisioner.provision({
        d1Databases: ["hoox-db"],
        kvNamespaces: ["CONFIG_KV"],
        r2Buckets: [],
        queues: [],
      });

      expect(result.success).toBe(true);
      expect(result.created).toEqual(["D1:hoox-db", "KV:CONFIG_KV"]);
      expect(result.errors).toEqual([]);
      expect(spawnCalls[0]).toEqual(["wrangler", "d1", "create", "hoox-db"]);
      expect(spawnCalls[1]).toEqual([
        "wrangler",
        "kv",
        "namespace",
        "create",
        "CONFIG_KV",
      ]);
    });

    it("records D1 failure when wrangler exits non-zero with stderr", async () => {
      spawnQueue.push(spawnResult(1, "", "permission denied"));
      spawnQueue.push(spawnResult(0));

      const provisioner = new CLIProvisioner();
      const result = await provisioner.provision({
        d1Databases: ["bad-db"],
        kvNamespaces: ["ok-kv"],
        r2Buckets: [],
        queues: [],
      });

      expect(result.success).toBe(false);
      expect(result.created).toEqual(["KV:ok-kv"]);
      expect(result.errors).toContain("D1:bad-db — permission denied");
    });

    it("falls back to exit code message when stderr is empty", async () => {
      spawnQueue.push(spawnResult(2, "", ""));
      spawnQueue.push(spawnResult(3, "", "  "));

      const provisioner = new CLIProvisioner();
      const result = await provisioner.provision({
        d1Databases: ["d1-a"],
        kvNamespaces: ["kv-a"],
        r2Buckets: [],
        queues: [],
      });

      expect(result.success).toBe(false);
      expect(result.created).toEqual([]);
      expect(result.errors).toContain("D1:d1-a — exit code 2");
      expect(result.errors).toContain("KV:kv-a — exit code 3");
    });

    it("captures thrown errors from Bun.spawn for D1 and KV", async () => {
      const provisioner = new CLIProvisioner();

      spawnShouldThrow = new Error("spawn EACCES");
      spawnQueue.push(spawnResult(0)); // never used for first D1
      // After throw recovery, next call is for KV — also throw
      // Install a custom mock that throws for both
      (Bun as Record<string, unknown>).spawn = mock(() => {
        throw new Error("spawn ENOENT");
      });

      const result = await provisioner.provision({
        d1Databases: ["db-x"],
        kvNamespaces: ["kv-x"],
        r2Buckets: [],
        queues: [],
      });

      expect(result.success).toBe(false);
      expect(result.created).toEqual([]);
      expect(result.errors.some((e) => e.includes("D1:db-x"))).toBe(true);
      expect(result.errors.some((e) => e.includes("KV:kv-x"))).toBe(true);
      expect(result.errors.every((e) => e.includes("spawn ENOENT"))).toBe(true);
    });

    it("provisions multiple D1 databases in order", async () => {
      spawnQueue.push(spawnResult(0));
      spawnQueue.push(spawnResult(0));
      spawnQueue.push(spawnResult(0));

      const provisioner = new CLIProvisioner();
      const result = await provisioner.provision({
        d1Databases: ["a", "b"],
        kvNamespaces: ["k"],
        r2Buckets: [],
        queues: [],
      });

      expect(result.success).toBe(true);
      expect(result.created).toEqual(["D1:a", "D1:b", "KV:k"]);
      expect(spawnCalls.length).toBe(3);
    });

    it("returns success with empty plan", async () => {
      const provisioner = new CLIProvisioner();
      const result = await provisioner.provision({
        d1Databases: [],
        kvNamespaces: [],
        r2Buckets: [],
        queues: [],
      });
      expect(result.success).toBe(true);
      expect(result.created).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(spawnCalls.length).toBe(0);
    });
  });
});
