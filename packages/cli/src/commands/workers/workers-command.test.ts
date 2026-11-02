/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import { registerWorkersCommand } from "./workers-command.js";

describe("workers enable/disable/catalog", () => {
  let tmpDir: string;
  let cwd: string;
  let stdout = "";
  let writeSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "hoox-workers-cmd-"));
    cwd = process.cwd();
    process.chdir(tmpDir);
    stdout = "";
    writeSpy = spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout += String(chunk);
      return true;
    });

    await writeFile(
      join(tmpDir, "wrangler.jsonc"),
      JSON.stringify(
        {
          global: { cloudflare_account_id: "acct" },
          workers: {
            "trade-worker": {
              enabled: true,
              path: "workers/trade-worker",
              secrets: [],
            },
            "email-worker": {
              enabled: true,
              path: "workers/email-worker",
              secrets: [],
            },
          },
        },
        null,
        2
      )
    );
  });

  afterEach(async () => {
    writeSpy.mockRestore();
    process.chdir(cwd);
    await rm(tmpDir, { recursive: true, force: true });
  });

  function buildProgram(): Command {
    const program = new Command();
    program.exitOverride();
    program.option("--json");
    program.option("--quiet");
    registerWorkersCommand(program);
    return program;
  }

  it("catalog lists known workers with defaults", async () => {
    const program = buildProgram();
    await program.parseAsync(["workers", "catalog", "--json"], {
      from: "user",
    });
    const parsed = JSON.parse(stdout) as {
      name: string;
      defaultEnabled: boolean;
    }[];
    expect(parsed.some((w) => w.name === "trade-worker")).toBe(true);
    expect(parsed.some((w) => w.name === "email-worker")).toBe(true);
    const email = parsed.find((w) => w.name === "email-worker");
    expect(email?.defaultEnabled).toBe(false);
    const agent = parsed.find((w) => w.name === "pyne-agent-worker") as
      { name: string; tier?: string; available?: boolean } | undefined;
    expect(agent?.tier).toBe("optional");
    expect(agent?.available).toBe(true);
    const pynets = parsed.find((w) => w.name === "pynets-worker") as
      { name: string; tier?: string; available?: boolean } | undefined;
    expect(pynets?.tier).toBe("planned");
    expect(pynets?.available).toBe(false);
  });

  it("disable flips enabled in wrangler.jsonc", async () => {
    const program = buildProgram();
    await program.parseAsync(["workers", "disable", "email-worker"], {
      from: "user",
    });
    const raw = await Bun.file(join(tmpDir, "wrangler.jsonc")).json();
    expect(raw.workers["email-worker"].enabled).toBe(false);
    expect(stdout).toContain("email-worker");
    expect(stdout).toContain("disabled");
  });

  it("enable seeds catalog workers missing from config", async () => {
    const program = buildProgram();
    await program.parseAsync(["workers", "enable", "report-worker"], {
      from: "user",
    });
    const raw = await Bun.file(join(tmpDir, "wrangler.jsonc")).json();
    expect(raw.workers["report-worker"].enabled).toBe(true);
    expect(raw.workers["report-worker"].path).toBe("workers/report-worker");
  });

  it("list --json includes catalog membership", async () => {
    const program = buildProgram();
    await program.parseAsync(["workers", "list", "--json"], { from: "user" });
    const parsed = JSON.parse(stdout) as {
      name: string;
      inCatalog: boolean;
      enabled: boolean;
    }[];
    expect(parsed.find((w) => w.name === "trade-worker")?.enabled).toBe(true);
    expect(parsed.find((w) => w.name === "report-worker")?.inCatalog).toBe(
      true
    );
  });
});
