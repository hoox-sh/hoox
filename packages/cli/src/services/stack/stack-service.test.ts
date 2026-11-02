/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  requireCatalogWorker,
  ensureWorkerInStack,
  wireCallerBindings,
} from "./stack-service.js";
import { CLIError } from "../../utils/errors.js";

describe("requireCatalogWorker", () => {
  it("resolves pyne-agent-worker", () => {
    expect(requireCatalogWorker("pyne-agent-worker")).toBe("pyne-agent-worker");
  });

  it("rejects planned pynets-worker and the pine-worker alias", () => {
    expect(() => requireCatalogWorker("pynets-worker")).toThrow(CLIError);
    expect(() => requireCatalogWorker("pine-worker")).toThrow(/pynets|pine/i);
  });

  it("rejects unknown names with a catalog hint", () => {
    expect(() => requireCatalogWorker("nope-worker")).toThrow(/Unknown worker/);
  });
});

describe("ensureWorkerInStack", () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "hoox-stack-"));
    cwd = process.cwd();
    process.chdir(tmpDir);
    await writeFile(
      join(tmpDir, "wrangler.jsonc"),
      JSON.stringify(
        {
          global: { cloudflare_account_id: "acct" },
          workers: {
            dashboard: {
              enabled: true,
              path: "workers/dashboard",
              secrets: [],
            },
          },
        },
        null,
        2
      )
    );
    await mkdir(join(tmpDir, "workers", "dashboard"), { recursive: true });
    await writeFile(
      join(tmpDir, "workers", "dashboard", "wrangler.jsonc"),
      JSON.stringify({ name: "dashboard", services: [] }, null, 2)
    );
  });

  afterEach(async () => {
    process.chdir(cwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("seeds, enables, and wires pyne-agent-worker with --yes", async () => {
    const result = await ensureWorkerInStack("pyne-agent-worker", {
      format: { quiet: true },
      yes: true,
      skipClone: true,
    });
    expect(result.name).toBe("pyne-agent-worker");
    expect(result.alreadyEnabled).toBe(false);
    expect(result.seeded).toBe(true);
    expect(result.wired).toBe(true);

    const raw = JSON.parse(
      await Bun.file(join(tmpDir, "wrangler.jsonc")).text()
    ) as {
      workers: { "pyne-agent-worker": { enabled: boolean; secrets: string[] } };
    };
    expect(raw.workers["pyne-agent-worker"].enabled).toBe(true);
    expect(raw.workers["pyne-agent-worker"].secrets).toContain("API_KEY");

    const dash = JSON.parse(
      await Bun.file(join(tmpDir, "workers/dashboard/wrangler.jsonc")).text()
    ) as { services: Array<{ binding: string; service: string }> };
    expect(dash.services).toEqual(
      expect.arrayContaining([
        { binding: "PYNE_AGENT_SERVICE", service: "pyne-agent-worker" },
      ])
    );
  });

  it("is a no-op when the worker is already enabled", async () => {
    await ensureWorkerInStack("pyne-agent-worker", {
      format: { quiet: true },
      yes: true,
      skipClone: true,
    });
    const again = await ensureWorkerInStack("pyne-agent-worker", {
      format: { quiet: true },
      yes: true,
      skipClone: true,
    });
    expect(again.alreadyEnabled).toBe(true);
    expect(again.seeded).toBe(false);
  });

  it("refuses without --yes in non-interactive mode", async () => {
    await expect(
      ensureWorkerInStack("pyne-agent-worker", {
        format: { json: true },
        yes: false,
        skipClone: true,
      })
    ).rejects.toThrow(/not enabled in this stack/i);
  });

  it("wireCallerBindings is idempotent", async () => {
    await ensureWorkerInStack("pyne-agent-worker", {
      format: { quiet: true },
      yes: true,
      skipClone: true,
    });
    const second = await wireCallerBindings("pyne-agent-worker", {
      quiet: true,
    });
    expect(second).toBe(false);
  });
});
