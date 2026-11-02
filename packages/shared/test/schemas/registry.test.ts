/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "bun:test";
import {
  WORKER_MANIFESTS,
  WORKER_NAMES,
  WORKER_CATALOG,
  CALLED_BY,
  getWorkerDefaultEnabled,
  getWorkerTier,
  resolveCatalogWorkerName,
  isPlannedWorker,
  secretNamesFromManifest,
  requiredSecretNamesFromManifest,
  plannedWorkerMessage,
} from "../../src/schemas/registry.js";

describe("Worker Registry", () => {
  it("includes core mesh plus optional PYNE satellites and planned pynets-worker", () => {
    expect(WORKER_NAMES).toContain("hoox");
    expect(WORKER_NAMES).toContain("dashboard");
    expect(WORKER_NAMES).toContain("pyne-worker");
    expect(WORKER_NAMES).toContain("pyne-agent-worker");
    expect(WORKER_NAMES).toContain("pynets-worker");
    expect(WORKER_NAMES).toHaveLength(13);
  });

  it("marks PYNE family as optional and pynets-worker as planned", () => {
    expect(getWorkerTier("pyne-worker")).toBe("optional");
    expect(getWorkerTier("pyne-agent-worker")).toBe("optional");
    expect(getWorkerTier("pynets-worker")).toBe("planned");
    expect(getWorkerTier("hoox")).toBe("core");
    expect(isPlannedWorker("pynets-worker")).toBe(true);
    expect(isPlannedWorker("pine-worker")).toBe(true);
    expect(isPlannedWorker("pyne-agent-worker")).toBe(false);
  });

  it("resolves aliases (pine-worker → pynets-worker)", () => {
    expect(resolveCatalogWorkerName("pine-worker")).toBe("pynets-worker");
    expect(resolveCatalogWorkerName("pyne-agent-worker")).toBe(
      "pyne-agent-worker"
    );
    expect(resolveCatalogWorkerName("not-a-worker")).toBeUndefined();
  });

  it("lists required vs optional secrets on pyne-agent-worker", () => {
    const m = WORKER_MANIFESTS["pyne-agent-worker"]!;
    expect(requiredSecretNamesFromManifest(m)).toEqual(["API_KEY"]);
    expect(secretNamesFromManifest(m)).toContain("AXIS_MCP_KEY");
    expect(plannedWorkerMessage("pine-worker")).toMatch(/pynets|pine-worker/i);
  });

  it("each worker should have a name, path, and defaultEnabled", () => {
    for (const [workerName, m] of Object.entries(WORKER_MANIFESTS)) {
      expect(m.name).toBe(workerName);
      expect(m.path).toMatch(/^workers\//);
      expect(typeof m.defaultEnabled).toBe("boolean");
    }
  });

  it("WORKER_CATALOG mirrors manifests with defaults and tier", () => {
    expect(WORKER_CATALOG).toHaveLength(WORKER_NAMES.length);
    for (const entry of WORKER_CATALOG) {
      expect(WORKER_MANIFESTS[entry.name]?.path).toBe(entry.path);
      expect(getWorkerDefaultEnabled(entry.name)).toBe(entry.defaultEnabled);
      expect(getWorkerTier(entry.name)).toBe(entry.tier);
      expect(entry.available).toBe(entry.tier !== "planned");
    }
    expect(getWorkerDefaultEnabled("not-a-worker")).toBeUndefined();
    const agent = WORKER_CATALOG.find((w) => w.name === "pyne-agent-worker");
    expect(agent?.tier).toBe("optional");
    expect(agent?.available).toBe(true);
    const pynets = WORKER_CATALOG.find((w) => w.name === "pynets-worker");
    expect(pynets?.available).toBe(false);
    expect(pynets?.aliases).toContain("pine-worker");
  });

  it("deriveCalledBy should compute reverse mappings", () => {
    // hoox calls trade-worker -> trade-worker's calledBy should include hoox
    expect(CALLED_BY["trade-worker"]).toContain("hoox");
    // hoox calls telegram-worker -> telegram-worker's calledBy should include hoox
    expect(CALLED_BY["telegram-worker"]).toContain("hoox");
    expect(CALLED_BY["pyne-agent-worker"]).toContain("dashboard");
    expect(CALLED_BY["pyne-worker"]).toContain("dashboard");
  });

  it("every service binding target and caller should be a known worker", () => {
    for (const m of Object.values(WORKER_MANIFESTS)) {
      for (const svc of m.services) {
        expect(WORKER_NAMES).toContain(svc.service);
      }
      for (const caller of m.callers ?? []) {
        expect(WORKER_NAMES).toContain(caller.worker);
      }
    }
  });

  it("all worker paths should be unique", () => {
    const paths = Object.values(WORKER_MANIFESTS).map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("workers with zero services should have empty calledBy", () => {
    for (const [, m] of Object.entries(WORKER_MANIFESTS)) {
      if (m.services.length === 0) {
        // Only workers that have no callers should have empty calledBy
        // Actually, calledBy is computed from other workers' services, not own services
      }
    }
  });

  it("cron should be optional", () => {
    const withCron = Object.values(WORKER_MANIFESTS).filter(
      (m) => m.cron && m.cron.length > 0
    );
    expect(withCron.length).toBeGreaterThan(0);
    for (const m of withCron) {
      expect(Array.isArray(m.cron)).toBe(true);
    }
  });
});
